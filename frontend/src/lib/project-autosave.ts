// Autosave for project drafts, shared by the create and edit pages.
import type { QueryClient } from "@tanstack/react-query";
import { ApiError, autosaveProject, createProject, getMyDrafts, type ProjectInput } from "@/lib/api";
import { AutosaveQueue, type AutosaveState } from "@/lib/autosave";
import { writeDraftBackup } from "@/lib/draft-backup";
import { requestError } from "@/lib/project-form";

const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export function formatSavedAt(savedAt: string, now: number) {
  const minutes = Math.round((new Date(savedAt).getTime() - now) / 60_000);
  if (minutes > -1) return "just now";
  if (minutes > -60) return relativeTime.format(minutes, "minute");
  if (minutes > -60 * 24) return relativeTime.format(Math.round(minutes / 60), "hour");
  return relativeTime.format(Math.round(minutes / (60 * 24)), "day");
}

// The backend rejects a project without these, so a new draft waits for them.
export function hasRequiredFields(project: ProjectInput) {
  return Boolean(project.title.trim() && project.summary.trim() && project.category_id);
}

// An existing draft still saves while a required field is empty: the empty field
// is left out, so the server keeps its last value and everything else is saved.
export function savableFields(project: ProjectInput): Partial<ProjectInput> {
  return {
    ...(project.title.trim() ? { title: project.title } : {}),
    ...(project.summary.trim() ? { summary: project.summary } : {}),
    ...(project.category_id ? { category_id: project.category_id } : {}),
    description: project.description,
    tags: project.tags,
  };
}

// Only connection problems and server errors are worth retrying on their own.
export function shouldRetryAutosave(error: Error) {
  return error instanceof TypeError || (error instanceof ApiError && error.status >= 500);
}

export function autosaveError(error: Error) {
  if (error instanceof ApiError && error.status === 401) return "Your session has expired. Log in again: your unsaved changes are kept on this device and come back when you reopen this project.";
  if (error instanceof ApiError && error.status === 409) return "This project is no longer a private draft, so it can't be autosaved. Refresh the page.";
  return requestError(error);
}

export function autosaveLabel(state: AutosaveState, now: number) {
  if (state.status === "saving") return "Saving...";
  if (state.status === "error") return state.retrying ? "Couldn't save, retrying..." : "Couldn't save";
  if (state.status === "incomplete") {
    return state.isNew ? "Not saved yet · add a title, summary and category" : "Saved, except empty required fields";
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

// A draft created by a request whose answer never arrived.
async function findCreatedDraft(value: ProjectInput) {
  const drafts = await getMyDrafts();
  const recent = Date.now() - 24 * 60 * 60_000;
  return drafts
    .filter((draft) => draft.title === value.title.trim() && draft.summary === value.summary.trim() && new Date(draft.created_at).getTime() > recent)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

const outcomeUnknown = (error: unknown) => error instanceof TypeError || (error instanceof ApiError && error.status >= 500);

interface ProjectAutosaveOptions {
  projectId: string | null;
  // What the server has (or the empty form on the create page).
  initial: ProjectInput;
  // Unsaved changes from a backup, shown and saved in place of initial.
  restored?: ProjectInput;
  lastSavedAt?: string | null;
  // Called once the first save has created the draft.
  onCreate?: (projectId: string) => void;
  onSave?: (projectId: string) => void;
}

// Creates the draft on the first save, then autosaves it.
export function createProjectAutosave({ projectId, initial, restored, lastSavedAt, onCreate, onSave }: ProjectAutosaveOptions) {
  let id = projectId;
  // A restored create page may come from a create whose answer was lost when the tab closed.
  let maybeCreated = !projectId && restored !== undefined;

  async function create(value: ProjectInput, options: { keepalive?: boolean }) {
    if (maybeCreated) {
      const existing = await findCreatedDraft(value);
      if (existing) return autosaveProject(existing.id, value, options);
    }
    try {
      return await createProject(value, options);
    } catch (error) {
      maybeCreated = outcomeUnknown(error);
      throw error;
    }
  }

  return new AutosaveQueue<ProjectInput>({
    initial: restored ?? initial,
    saved: projectId ? initial : null,
    blank: initial,
    lastSavedAt,
    canSave: (value) => id !== null || hasRequiredFields(value),
    isComplete: hasRequiredFields,
    persist: (value) => writeDraftBackup(id, value),
    // Retrying a create could make a second draft, so only updates retry on their own.
    shouldRetry: (error) => id !== null && shouldRetryAutosave(error),
    save: async (value, options) => {
      const result = id ? await autosaveProject(id, savableFields(value), options) : await create(value, options);
      const created = id === null;
      id = result.id;
      if (created) {
        writeDraftBackup(null, null);
        onCreate?.(result.id);
      }
      onSave?.(result.id);
      // A new draft hasn't been autosaved yet, so the server has no time for it.
      return result.last_autosaved_at ?? new Date().toISOString();
    },
  });
}

interface Handoff {
  queue: AutosaveQueue<ProjectInput>;
  focus: { id: string; start: number | null; end: number | null } | null;
  // A tag typed but not added yet.
  pendingTag: string;
}

// The create page moves to the edit page once its draft exists.
// The edit page takes over the same queue so saves stay in order and nothing typed is lost.
const handoffs = new Map<string, Handoff>();

export function handOffProjectAutosave(projectId: string, queue: AutosaveQueue<ProjectInput>) {
  const active = document.activeElement;
  const focus = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
    ? { id: active.id, start: active.selectionStart, end: active.selectionEnd }
    : null;
  const tagInput = document.getElementById("project-tags");
  const pendingTag = tagInput instanceof HTMLInputElement ? tagInput.value : "";
  handoffs.set(projectId, { queue, focus: focus?.id ? focus : null, pendingTag });
}

export function getHandedOffAutosave(projectId: string) {
  return handoffs.get(projectId);
}

export function releaseHandedOffAutosave(projectId: string) {
  handoffs.delete(projectId);
}
