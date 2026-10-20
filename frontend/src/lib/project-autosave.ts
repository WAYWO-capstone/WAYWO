// Autosave for project drafts, shared by the create and edit pages.
import type { QueryClient } from "@tanstack/react-query";
import { ApiError, autosaveProject, createProject, type ProjectInput } from "@/lib/api";
import { AutosaveQueue, type AutosaveState } from "@/lib/autosave";
import { requestError } from "@/lib/project-form";

const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export function formatSavedAt(savedAt: string, now: number) {
  const minutes = Math.round((new Date(savedAt).getTime() - now) / 60_000);
  if (minutes > -1) return "just now";
  if (minutes > -60) return relativeTime.format(minutes, "minute");
  if (minutes > -60 * 24) return relativeTime.format(Math.round(minutes / 60), "hour");
  return relativeTime.format(Math.round(minutes / (60 * 24)), "day");
}

// The backend rejects a project without these, so autosave waits for them.
export function hasRequiredFields(project: ProjectInput) {
  return Boolean(project.title.trim() && project.summary.trim() && project.category_id);
}

// Only connection problems and server errors are worth retrying on their own.
export function shouldRetryAutosave(error: Error) {
  return error instanceof TypeError || (error instanceof ApiError && error.status >= 500);
}

export function autosaveError(error: Error) {
  if (error instanceof ApiError && error.status === 409) return "This project is no longer a private draft, so it can't be autosaved. Refresh the page.";
  return requestError(error);
}

export function autosaveLabel(state: AutosaveState, now: number) {
  if (state.status === "saving") return "Saving...";
  if (state.status === "error") return state.retrying ? "Couldn't save, retrying..." : "Couldn't save";
  if (state.status === "incomplete") {
    return state.isNew ? "Not saved yet · add a title, summary and category" : "Unsaved changes · fill in the required fields to save";
  }
  if (state.isNew) return "Not saved yet";
  if (state.status === "pending") return "Unsaved changes";
  return state.lastSavedAt ? `Last saved ${formatSavedAt(state.lastSavedAt, now)}` : null;
}

// Pages showing this project reload it the next time they're opened.
export function markProjectSaved(queryClient: QueryClient, projectId: string) {
  void queryClient.invalidateQueries({ queryKey: ["project", projectId], refetchType: "none" });
  void queryClient.invalidateQueries({ queryKey: ["my-projects"], refetchType: "none" });
}

interface ProjectAutosaveOptions {
  projectId: string | null;
  initial: ProjectInput;
  lastSavedAt?: string | null;
  // Called once the first save has created the draft.
  onCreate?: (projectId: string) => void;
  onSave?: (projectId: string) => void;
}

// Creates the draft on the first save, then autosaves it.
export function createProjectAutosave({ projectId, initial, lastSavedAt, onCreate, onSave }: ProjectAutosaveOptions) {
  let id = projectId;
  return new AutosaveQueue<ProjectInput>({
    initial,
    saved: projectId ? initial : null,
    lastSavedAt,
    canSave: hasRequiredFields,
    shouldRetry: shouldRetryAutosave,
    save: async (value, options) => {
      const result = id ? await autosaveProject(id, value, options) : await createProject(value, options);
      const created = id === null;
      id = result.id;
      if (created) onCreate?.(result.id);
      onSave?.(result.id);
      // A new draft hasn't been autosaved yet, so the server has no time for it.
      return result.last_autosaved_at ?? new Date().toISOString();
    },
  });
}

interface Handoff {
  queue: AutosaveQueue<ProjectInput>;
  focus: { id: string; start: number | null; end: number | null } | null;
}

// The create page moves to the edit page once its draft exists.
// The edit page takes over the same queue so saves stay in order and nothing typed is lost.
const handoffs = new Map<string, Handoff>();

export function handOffProjectAutosave(projectId: string, queue: AutosaveQueue<ProjectInput>) {
  const active = document.activeElement;
  const focus = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
    ? { id: active.id, start: active.selectionStart, end: active.selectionEnd }
    : null;
  handoffs.set(projectId, { queue, focus: focus?.id ? focus : null });
}

export function getHandedOffAutosave(projectId: string) {
  return handoffs.get(projectId);
}

export function releaseHandedOffAutosave(projectId: string) {
  handoffs.delete(projectId);
}
