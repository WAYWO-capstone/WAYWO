// Saves form values in the background, one request at a time.
import { useEffect, useSyncExternalStore } from "react";

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
  lastSavedAt?: string | null;
  // Saves the value and returns the time it was saved.
  save: (value: T, options: SaveOptions) => Promise<string>;
  canSave?: (value: T) => boolean;
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

  // Before the first save, an untouched form has nothing worth saving.
  private isDirty() {
    return !sameValue(this.latest, this.saved ?? this.options.initial);
  }

  private canSave(value: T) {
    return this.options.canSave?.(value) ?? true;
  }

  // Picks the state for the latest value and schedules a save if needed.
  private settle(changes: Partial<AutosaveState> = {}) {
    this.clearTimer();
    if (!this.isDirty()) {
      this.set({ ...changes, status: "idle", error: null, retrying: false });
    } else if (!this.canSave(this.latest)) {
      this.set({ ...changes, status: "incomplete", error: null, retrying: false });
    } else {
      this.set({ ...changes, status: "pending", error: null, retrying: false });
      this.timer = setTimeout(() => void this.flush(), this.options.delay ?? 1000);
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
      this.attempt = 0;
      // Changes made while this request was running get their own save.
      this.settle({ lastSavedAt: savedAt, isNew: false });
      return true;
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error("Autosave failed");
      const retryIn = this.options.shouldRetry?.(error) ? (this.options.retryDelays ?? [2000, 5000, 10000])[this.attempt] : undefined;
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
export function useAutosave<T>(queue: AutosaveQueue<T> | null) {
  const state = useSyncExternalStore(queue?.subscribe ?? noSubscribe, () => queue?.state ?? null);

  useEffect(() => {
    if (!queue) return;
    const saveOnExit = () => void queue.flush({ keepalive: true });
    window.addEventListener("pagehide", saveOnExit);
    return () => {
      window.removeEventListener("pagehide", saveOnExit);
      void queue.flush();
    };
  }, [queue]);

  return state;
}
