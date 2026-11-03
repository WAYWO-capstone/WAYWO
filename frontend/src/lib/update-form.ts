import { ApiError } from "@/api/client";
import type { ProjectUpdate, UpdateType } from "@/api/models";
import type { ProjectUpdateChanges } from "@/api/updates";

export interface UpdateFormValues {
  title: string;
  body: string;
  type: UpdateType;
}

export function toUpdateFormValues(update: ProjectUpdate): UpdateFormValues {
  return { title: update.title, body: update.body, type: update.type };
}

export function hasRequiredUpdateFields(values: UpdateFormValues) {
  return values.title.trim() !== "" && values.body.trim() !== "";
}

// Only what the user changed, so a save can't overwrite anything else.
export function updateChanges(saved: UpdateFormValues, current: UpdateFormValues): ProjectUpdateChanges {
  const changes: ProjectUpdateChanges = {};
  const title = current.title.trim();
  const body = current.body.trim();
  if (title !== saved.title.trim()) changes.title = title;
  if (body !== saved.body.trim()) changes.body = body;
  if (current.type !== saved.type) changes.type = current.type;
  return changes;
}

// A new update's two timestamps are set separately, so they differ slightly.
const EDIT_THRESHOLD_MS = 1000;

export function wasEdited(update: Pick<ProjectUpdate, "created_at" | "updated_at">) {
  return new Date(update.updated_at).getTime() - new Date(update.created_at).getTime() > EDIT_THRESHOLD_MS;
}

export function formatUpdateDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function updateRequestError(error: Error) {
  if (error instanceof ApiError && error.status === 401) return "Your session has expired. Please log in again.";
  if (error instanceof ApiError && error.status === 403) return "You can only change your own updates.";
  if (error instanceof ApiError && error.status === 404) return "This update no longer exists.";
  if (error instanceof ApiError && error.status === 422) return "Check the update details, then try again.";
  if (error instanceof TypeError) return "Can't reach the server. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}
