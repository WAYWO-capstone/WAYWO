import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ApiError } from "../src/api/client";
import type { ProjectInput } from "../src/api/models";
import { AutosaveQueue, type AutosaveOptions, type AutosaveState } from "../src/lib/autosave";
import { autosaveLabel, hasRequiredFields, shouldRetryAutosave } from "../src/lib/project-autosave";

interface Draft {
  title: string;
}

// A save the test resolves or rejects by hand.
function controlledSave() {
  const calls: { value: Draft; resolve: (savedAt: string) => void; reject: (error: Error) => void }[] = [];
  const save = vi.fn((value: Draft) => new Promise<string>((resolve, reject) => {
    calls.push({ value, resolve, reject });
  }));
  return { save, calls };
}

function queue(save: AutosaveOptions<Draft>["save"], options: Partial<AutosaveOptions<Draft>> = {}) {
  return new AutosaveQueue<Draft>({ initial: { title: "" }, saved: { title: "" }, save, delay: 1000, retryDelays: [2000, 5000], ...options });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AutosaveQueue", () => {
  test("saves a change once the user pauses, with the latest values", async () => {
    const save = vi.fn<AutosaveOptions<Draft>["save"]>(async () => "2026-10-20T12:00:00Z");
    const autosave = queue(save);

    autosave.update({ title: "B" });
    autosave.update({ title: "Bi" });
    autosave.update({ title: "Bird" });
    expect(autosave.state.status).toBe("pending");
    await vi.advanceTimersByTimeAsync(999);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ title: "Bird" }, {});
    expect(autosave.state).toMatchObject({ status: "idle", lastSavedAt: "2026-10-20T12:00:00Z" });
    expect(autosave.hasUnsavedChanges).toBe(false);
  });

  test("saves every field update, not only the first", async () => {
    const save = vi.fn<AutosaveOptions<Draft>["save"]>(async () => "2026-10-20T12:00:00Z");
    const autosave = queue(save);

    autosave.update({ title: "First" });
    await vi.advanceTimersByTimeAsync(1000);
    autosave.update({ title: "Second" });
    await vi.advanceTimersByTimeAsync(1000);

    expect(save.mock.calls.map(([value]) => value)).toEqual([{ title: "First" }, { title: "Second" }]);
  });

  test("never sends two saves at once, so an older save can't overwrite a newer one", async () => {
    const { save, calls } = controlledSave();
    const autosave = queue(save);

    autosave.update({ title: "Old" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(autosave.state.status).toBe("saving");

    // Typing while the first save is still running.
    autosave.update({ title: "New" });
    void autosave.flush();
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toHaveLength(1);

    calls[0].resolve("2026-10-20T12:00:00Z");
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toHaveLength(2);
    expect(calls[1].value).toEqual({ title: "New" });

    calls[1].resolve("2026-10-20T12:00:01Z");
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toHaveLength(2);
    expect(autosave.state).toMatchObject({ status: "idle", lastSavedAt: "2026-10-20T12:00:01Z" });
  });

  test("doesn't save when nothing changed", async () => {
    const save = vi.fn<AutosaveOptions<Draft>["save"]>(async () => "2026-10-20T12:00:00Z");
    const autosave = queue(save);

    autosave.update({ title: "Changed" });
    autosave.update({ title: "" });
    await vi.advanceTimersByTimeAsync(1000);

    expect(await autosave.flush()).toBe(true);
    expect(save).not.toHaveBeenCalled();
    expect(autosave.state.status).toBe("idle");
  });

  test("waits for the required fields before saving", async () => {
    const save = vi.fn<AutosaveOptions<Draft>["save"]>(async () => "2026-10-20T12:00:00Z");
    const autosave = queue(save, { canSave: (value) => value.title.trim() !== "" });

    autosave.update({ title: "   " });
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).not.toHaveBeenCalled();
    expect(autosave.state.status).toBe("incomplete");
    expect(await autosave.flush()).toBe(false);

    autosave.update({ title: "Ready" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  test("retries connection problems with longer and longer waits, keeping the changes", async () => {
    const save = vi.fn<AutosaveOptions<Draft>["save"]>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce("2026-10-20T12:00:00Z");
    const autosave = queue(save, { shouldRetry: shouldRetryAutosave });

    autosave.update({ title: "Offline" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(autosave.state).toMatchObject({ status: "error", retrying: true });
    expect(autosave.hasUnsavedChanges).toBe(true);

    await vi.advanceTimersByTimeAsync(1999);
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(3);
    expect(save).toHaveBeenLastCalledWith({ title: "Offline" }, {});
    expect(autosave.state.status).toBe("idle");
  });

  test("stops retrying after the last wait and lets the user retry", async () => {
    const save = vi.fn<AutosaveOptions<Draft>["save"]>().mockRejectedValue(new ApiError(503));
    const autosave = queue(save, { shouldRetry: shouldRetryAutosave });

    autosave.update({ title: "Down" });
    await vi.advanceTimersByTimeAsync(1000 + 2000 + 5000 + 60_000);
    expect(save).toHaveBeenCalledTimes(3);
    expect(autosave.state).toMatchObject({ status: "error", retrying: false });

    save.mockResolvedValueOnce("2026-10-20T12:00:00Z");
    expect(await autosave.retry()).toBe(true);
    expect(autosave.state.status).toBe("idle");
  });

  test.each([401, 403, 404, 409, 422])("doesn't retry a %i on its own", async (status) => {
    const save = vi.fn<AutosaveOptions<Draft>["save"]>().mockRejectedValue(new ApiError(status));
    const autosave = queue(save, { shouldRetry: shouldRetryAutosave });

    autosave.update({ title: "Rejected" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(autosave.state).toMatchObject({ status: "error", retrying: false });
    expect(autosave.state.error).toBeInstanceOf(ApiError);
    expect(autosave.hasUnsavedChanges).toBe(true);
  });

  test("the next change tries again after a failure", async () => {
    const save = vi.fn<AutosaveOptions<Draft>["save"]>()
      .mockRejectedValueOnce(new ApiError(409))
      .mockResolvedValueOnce("2026-10-20T12:00:00Z");
    const autosave = queue(save, { shouldRetry: shouldRetryAutosave });

    autosave.update({ title: "One" });
    await vi.advanceTimersByTimeAsync(1000);
    autosave.update({ title: "Two" });
    expect(autosave.state.status).toBe("pending");
    await vi.advanceTimersByTimeAsync(1000);

    expect(save).toHaveBeenLastCalledWith({ title: "Two" }, {});
    expect(autosave.state.status).toBe("idle");
  });

  test("flush saves right away and passes keepalive through", async () => {
    const save = vi.fn<AutosaveOptions<Draft>["save"]>(async () => "2026-10-20T12:00:00Z");
    const autosave = queue(save);

    autosave.update({ title: "Leaving" });
    expect(await autosave.flush({ keepalive: true })).toBe(true);
    expect(save).toHaveBeenCalledWith({ title: "Leaving" }, { keepalive: true });

    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  test("a new form is only saved once something is typed", async () => {
    const save = vi.fn<AutosaveOptions<Draft>["save"]>(async () => "2026-10-20T12:00:00Z");
    const autosave = queue(save, { saved: null });
    expect(autosave.state).toMatchObject({ status: "idle", isNew: true, lastSavedAt: null });

    expect(await autosave.flush()).toBe(true);
    expect(save).not.toHaveBeenCalled();

    autosave.update({ title: "Created" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(autosave.state).toMatchObject({ status: "idle", isNew: false });
  });

  test("tells subscribers about every state change", async () => {
    const save = vi.fn<AutosaveOptions<Draft>["save"]>(async () => "2026-10-20T12:00:00Z");
    const autosave = queue(save);
    const statuses: string[] = [];
    autosave.subscribe(() => statuses.push(autosave.state.status));

    autosave.update({ title: "Watched" });
    await vi.advanceTimersByTimeAsync(1000);

    expect(statuses).toEqual(["pending", "saving", "idle"]);
  });
});

describe("AutosaveQueue keeping work safe", () => {
  test("keeps unsaved values in the backup until they're saved", async () => {
    const { save, calls } = controlledSave();
    const persist = vi.fn();
    const autosave = queue(save, { persist });

    autosave.update({ title: "Typed" });
    expect(persist).toHaveBeenLastCalledWith({ title: "Typed" });
    await vi.advanceTimersByTimeAsync(1000);
    // Still in the backup while the request runs, in case the tab closes now.
    expect(persist).toHaveBeenLastCalledWith({ title: "Typed" });

    calls[0].resolve("2026-10-20T12:00:00Z");
    await vi.advanceTimersByTimeAsync(0);
    expect(persist).toHaveBeenLastCalledWith(null);
  });

  test("restored changes are saved once a page starts using the queue, not before", async () => {
    const save = vi.fn<AutosaveOptions<Draft>["save"]>(async () => "2026-10-20T12:00:00Z");
    const autosave = queue(save, { initial: { title: "Restored" }, saved: { title: "Server" } });
    expect(autosave.hasUnsavedChanges).toBe(true);

    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();

    autosave.reopen();
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledWith({ title: "Restored" }, {});
  });

  test("discard drops changes that weren't saved yet", async () => {
    const save = vi.fn<AutosaveOptions<Draft>["save"]>(async () => "2026-10-20T12:00:00Z");
    const persist = vi.fn();
    const autosave = queue(save, { persist });

    autosave.update({ title: "Never mind" });
    autosave.discard();
    expect(autosave.value).toEqual({ title: "" });
    expect(persist).toHaveBeenLastCalledWith(null);
    expect(await autosave.close()).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  test("a save already running when changes are discarded isn't followed by another", async () => {
    const { save, calls } = controlledSave();
    const autosave = queue(save);

    autosave.update({ title: "Sent" });
    await vi.advanceTimersByTimeAsync(1000);
    autosave.update({ title: "Sent, then more" });
    autosave.discard();

    calls[0].resolve("2026-10-20T12:00:00Z");
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toHaveLength(1);
    expect(autosave.value).toEqual({ title: "Sent" });
    expect(autosave.hasUnsavedChanges).toBe(false);
  });

  test("leaving the page saves right away and stops retrying", async () => {
    const save = vi.fn<AutosaveOptions<Draft>["save"]>().mockRejectedValue(new TypeError("Failed to fetch"));
    const autosave = queue(save, { shouldRetry: shouldRetryAutosave });

    autosave.update({ title: "Leaving" });
    expect(await autosave.close()).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
    expect(autosave.state).toMatchObject({ status: "error", retrying: false });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  test("says when a saved value still has empty required fields", async () => {
    const save = vi.fn<AutosaveOptions<Draft>["save"]>(async () => "2026-10-20T12:00:00Z");
    const autosave = queue(save, { isComplete: (value) => value.title !== "" , initial: { title: "Kept" }, saved: { title: "Kept" } });

    autosave.update({ title: "" });
    expect(autosave.state.status).toBe("pending");
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledWith({ title: "" }, {});
    expect(autosave.state.status).toBe("incomplete");
  });
});

describe("autosaveLabel", () => {
  const now = new Date("2026-10-20T12:10:00Z").getTime();
  const state = (changes: Partial<AutosaveState>): AutosaveState => ({ status: "idle", lastSavedAt: null, isNew: false, error: null, retrying: false, ...changes });

  test("says nothing was saved before the first save", () => {
    expect(autosaveLabel(state({ isNew: true }), now)).toBe("Not saved yet");
    expect(autosaveLabel(state({ isNew: true, status: "pending" }), now)).toBe("Not saved yet");
    expect(autosaveLabel(state({ isNew: true, status: "incomplete" }), now)).toBe("Not saved yet · add a title, summary and category");
  });

  test("only says saved once a save really happened", () => {
    expect(autosaveLabel(state({}), now)).toBeNull();
    expect(autosaveLabel(state({ lastSavedAt: "2026-10-20T12:09:50Z" }), now)).toBe("Last saved just now");
    expect(autosaveLabel(state({ lastSavedAt: "2026-10-20T12:07:00Z" }), now)).toBe("Last saved 3 minutes ago");
  });

  test("shows each save state", () => {
    expect(autosaveLabel(state({ status: "pending", lastSavedAt: "2026-10-20T12:07:00Z" }), now)).toBe("Unsaved changes");
    expect(autosaveLabel(state({ status: "saving" }), now)).toBe("Saving...");
    expect(autosaveLabel(state({ status: "error", retrying: true }), now)).toBe("Couldn't save, retrying...");
    expect(autosaveLabel(state({ status: "error" }), now)).toBe("Couldn't save");
    expect(autosaveLabel(state({ status: "incomplete" }), now)).toBe("Saved, except empty required fields");
  });
});

describe("hasRequiredFields", () => {
  const project: ProjectInput = { title: "Quilt", summary: "A warm quilt", description: "", category_id: "c1", tags: [] };

  test("needs a title, summary and category like the backend", () => {
    expect(hasRequiredFields(project)).toBe(true);
    expect(hasRequiredFields({ ...project, title: "  " })).toBe(false);
    expect(hasRequiredFields({ ...project, summary: "" })).toBe(false);
    expect(hasRequiredFields({ ...project, category_id: "" })).toBe(false);
  });
});
