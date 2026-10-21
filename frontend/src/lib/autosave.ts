// Saves form values in the background, one request at a time.
import { useEffect, useEffectEvent, useSyncExternalStore } from "react";

export type AutosaveStatus = "idle" | "pending" | "incomplete" | "saving" | "error";

export interface AutosaveState {
  status: AutosaveStatus;
  // Server time of the last real save, null until one happens.
  lastSavedAt: string | null;
  // True while nothing exists on the server yet (first save creates it).
  isNew: boolean;
  error: Error | null;
  retrying: boolean;
}

export interface SaveOptions {
  // Lets the request finish after the tab is closed.
  keepalive?: boolean;
}

export interface AutosaveOptions<T> {
  initial: T;
  // What the server currently has, or null when nothing has been created yet.
  saved: T | null;
  // What an untouched new form looks like, when initial holds restored changes.
  blank?: T;
  lastSavedAt?: string | null;
  // Saves the value and returns the time it was saved.
  save: (value: T, options: SaveOptions) => Promise<string>;
  canSave?: (value: T) => boolean;
  // False while the value is saved except for fields the server won't accept yet.
  isComplete?: (value: T) => boolean;
  // Keeps unsaved values somewhere that survives the page closing; null clears it.
  persist?: (value: T | null) => void;
  shouldRetry?: (error: Error) => boolean;
  delay?: number;
  retryDelays?: number[];
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export class AutosaveQueue<T> {
  state: AutosaveState;
  private latest: T;
  private saved: T | null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  // Every save is chained on this, so two requests are never in flight at once
  // and an older save can't land after a newer one.
  private chain: Promise<unknown> = Promise.resolve();
  private attempt = 0;
  // Set once the page is left: no more automatic retries nobody would see.
  private closed = false;
  // Set by discard so a save already running doesn't bring the discarded changes back.
  private discarded = false;
  private listeners = new Set<() => void>();
  private readonly options: AutosaveOptions<T>;

  constructor(options: AutosaveOptions<T>) {
    this.options = options;
    this.latest = options.initial;
    this.saved = options.saved;
    this.state = {
      status: "idle",
      lastSavedAt: options.lastSavedAt ?? null,
      isNew: options.saved === null,
      error: null,
      retrying: false,
    };
  }

  get value() {
    return this.latest;
  }

  get hasUnsavedChanges() {
    return this.isDirty();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  // Call on every change but onyl saves once the user pauses.
  update(value: T) {
    this.latest = value;
    this.attempt = 0;
    this.discarded = false;
    this.persist();
    // The running save checks for newer changes when it finishes.
    if (this.state.status === "saving") return;
    this.settle();
  }

  // Saves the latest value now
  // Resolves to false if it couldn't be saved
  flush(options: SaveOptions = {}): Promise<boolean> {
    this.clearTimer();
    const run = this.chain.then(() => this.saveLatest(options));
    this.chain = run;
    return run;
  }

  retry() {
    this.attempt = 0;
    return this.flush();
  }

  // Drops changes that haven't been saved yet.
  discard() {
    this.discarded = true;
    this.latest = this.saved ?? this.blank;
    this.persist();
    this.settle();
  }

  // Saves what's left once when the page is left, without retrying afterwards.
  close() {
    this.closed = true;
    return this.flush();
  }

  // Called when a page starts using the queue (and again when the edit page takes it over
  // from the create page). Kept out of the constructor so a queue React throws away
  // (StrictMode builds state twice) never saves.
  reopen() {
    this.closed = false;
    // Restored changes are saved like any other change.
    if (this.state.status === "idle" && this.isDirty()) this.settle();
  }

  private get blank() {
    return this.options.blank ?? this.options.initial;
  }

  // Before the first save, an untouched form has nothing worth saving.
  private isDirty() {
    return !sameValue(this.latest, this.saved ?? this.blank);
  }

  private persist() {
    this.options.persist?.(this.isDirty() ? this.latest : null);
  }

  private canSave(value: T) {
    return this.options.canSave?.(value) ?? true;
  }

  // Picks the state for the latest value and schedules a save if needed.
  private settle(changes: Partial<AutosaveState> = {}) {
    this.clearTimer();
    const complete = this.options.isComplete?.(this.latest) ?? true;
    if (!this.isDirty()) {
      this.set({ ...changes, status: complete ? "idle" : "incomplete", error: null, retrying: false });
    } else if (!this.canSave(this.latest)) {
      this.set({ ...changes, status: "incomplete", error: null, retrying: false });
    } else {
      this.set({ ...changes, status: "pending", error: null, retrying: false });
      // Once the page is left there's no pause to wait for.
      this.timer = setTimeout(() => void this.flush(), this.closed ? 0 : this.options.delay ?? 1000);
    }
  }

  private async saveLatest(options: SaveOptions): Promise<boolean> {
    this.clearTimer();
    const value = this.latest;
    if (!this.isDirty()) {
      this.settle();
      return true;
    }
    if (!this.canSave(value)) {
      this.set({ status: "incomplete", error: null, retrying: false });
      return false;
    }

    this.set({ status: "saving", error: null, retrying: false });
    try {
      const savedAt = await this.options.save(value, options);
      this.saved = value;
      if (this.discarded) this.latest = value;
      this.attempt = 0;
      this.persist();
      // Changes made while this request was running get their own save.
      this.settle({ lastSavedAt: savedAt, isNew: false });
      return true;
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error("Autosave failed");
      const retryIn = !this.closed && this.options.shouldRetry?.(error) ? (this.options.retryDelays ?? [2000, 5000, 10000])[this.attempt] : undefined;
      this.set({ status: "error", error, retrying: retryIn !== undefined });
      if (retryIn !== undefined) {
        this.attempt += 1;
        this.timer = setTimeout(() => void this.flush(), retryIn);
      }
      return false;
    }
  }

  private clearTimer() {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private set(changes: Partial<AutosaveState>) {
    this.state = { ...this.state, ...changes };
    this.listeners.forEach((listener) => listener());
  }
}

const noSubscribe = () => () => {};

// Follows the queue's state and saves pending changes when the page is left.
// onClosed runs once that last save is done.
export function useAutosave<T>(queue: AutosaveQueue<T> | null, onClosed?: () => void) {
  const state = useSyncExternalStore(queue?.subscribe ?? noSubscribe, () => queue?.state ?? null);
  const closed = useEffectEvent(() => onClosed?.());

  useEffect(() => {
    if (!queue) return;
    queue.reopen();
    const saveOnExit = () => void queue.flush({ keepalive: true });
    window.addEventListener("pagehide", saveOnExit);
    return () => {
      window.removeEventListener("pagehide", saveOnExit);
      void queue.close().then(closed);
    };
  }, [queue]);

  return state;
}
