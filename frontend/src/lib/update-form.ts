import { ApiError } from "@/api/client";
import type {
  ProjectUpdate,
  UpdateReferenceCreate,
  UpdateReferenceReason,
  UpdateType,
} from "@/api/models";
import type { ProjectUpdateChanges } from "@/api/updates";
import dayjs from "dayjs";
import relativeTime from 'dayjs/plugin/relativeTime'
import localizedFormat from 'dayjs/plugin/localizedFormat'
dayjs.extend(relativeTime);
dayjs.extend(localizedFormat)

export interface UpdateFormValues {
  title: string;
  body: string;
  type: UpdateType;
  references: UpdateReferenceCreate[];
}

function editableReferenceReason(
  reason: NonNullable<ProjectUpdate["outgoing_references"]>[number]["reason"],
): UpdateReferenceReason {
  if (reason === "SOLVES" || reason === "PARTIALLY_SOLVES" || reason === "RELATED_TO") {
    return reason;
  }
  throw new Error(`Unexpected outgoing update reference reason: ${reason}`);
}

export function toUpdateFormValues(update: ProjectUpdate): UpdateFormValues {
  return {
    title: update.title,
    body: update.body,
    type: update.type,
    references: (update.outgoing_references ?? []).map((reference) => ({
      target_update_id: reference.linked_update_id,
      reason: editableReferenceReason(reference.reason),
    })),
  };
}

// Only what the user changed, so a save can't overwrite anything else.
export function updateChanges(saved: UpdateFormValues, current: UpdateFormValues): ProjectUpdateChanges {
  const changes: ProjectUpdateChanges = {};
  const title = current.title.trim();
  const body = current.body.trim();
  if (title !== saved.title.trim()) changes.title = title;
  if (body !== saved.body.trim()) changes.body = body;
  if (current.type !== saved.type) changes.type = current.type;
  const savedReferences = saved.references
    .map(({ target_update_id, reason }) => `${target_update_id}:${reason}`)
    .sort();
  const currentReferences = current.references
    .map(({ target_update_id, reason }) => `${target_update_id}:${reason}`)
    .sort();
  if (JSON.stringify(savedReferences) !== JSON.stringify(currentReferences)) {
    changes.references = current.references;
  }
  return changes;
}

// A new update's two timestamps are set separately, so they differ slightly.
const EDIT_THRESHOLD_MS = 1000;

export function wasEdited(update: Pick<ProjectUpdate, "created_at" | "updated_at">) {
  return new Date(update.updated_at).getTime() - new Date(update.created_at).getTime() > EDIT_THRESHOLD_MS;
}

// Format a date for display in an update item. Relative time is used.
// Assumed that timestamp is in the past.
export function formatUpdateDateRelative(value: string) {
  return dayjs().from(dayjs(value), true) + " ago";
}

// Format a date for display in an update item. Absolute time is used, with the user's locale.
// LLLL corresponds to "Tuesday, June 6, 2023 8:30 PM" in en-US. https://day.js.org/docs/en/display/format#localized-formats
export function formatUpdateDateAbsolute(value: string) {
  return dayjs(value).format("LLLL");
}

export function updateRequestError(error: Error) {
  if (error instanceof ApiError && error.status === 401) return "Your session has expired. Please log in again.";
  if (error instanceof ApiError && error.status === 403) return "You can only change your own updates.";
  if (error instanceof ApiError && error.message === "Referenced update not found") return "A linked update is no longer available. Refresh the form and try again.";
  if (error instanceof ApiError && error.status === 404) return "This update no longer exists.";
  if (error instanceof ApiError && error.message === "Duplicate update reference") return "An update can only be linked once.";
  if (error instanceof ApiError && error.message === "Invalid update reference") return "An update cannot be linked to itself.";
  if (error instanceof ApiError && error.message === "Solve references must link SOLUTION updates to PROBLEM updates") {
    return "Solve relationships require a Solution update linked to a Problem update. Check the update type and relationship reason.";
  }
  if (error instanceof ApiError && error.status === 422) return "Check the update details, then try again.";
  if (error instanceof TypeError) return "Can't reach the server. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

// The create form starts with no type chosen
export interface NewUpdateFormValues {
  title: string;
  body: string;
  type: UpdateType | null;
  references: UpdateReferenceCreate[];
}

type UpdateValidationValues = Pick<NewUpdateFormValues, "title" | "body" | "type">;
export type UpdateFieldErrors = Partial<Record<keyof UpdateValidationValues, string>>;

export const MIN_UPDATE_TITLE_LENGTH = 3;

// The one set of rules for both creating and editing an update.
export function validateUpdate(values: UpdateValidationValues): UpdateFieldErrors {
  const errors: UpdateFieldErrors = {};
  if (values.title.trim().length < MIN_UPDATE_TITLE_LENGTH) errors.title = `Title needs at least ${MIN_UPDATE_TITLE_LENGTH} characters`;
  if (!values.type) errors.type = "Choose an update type";
  if (!values.body.trim()) errors.body = "Add a description";
  return errors;
}

// Where focus goes when a field is invalid, in the order the fields appear.
const fieldFocusTargets: [keyof UpdateFieldErrors, string][] = [
  ["title", "#update-title"],
  ["type", "input[name='update-type']"],
  ["body", "#update-body"],
];

// Returns whether there was an invalid field to focus.
export function focusFirstInvalidField(form: HTMLFormElement, errors: UpdateFieldErrors) {
  const firstInvalid = fieldFocusTargets.find(([field]) => errors[field]);
  if (firstInvalid) form.querySelector<HTMLElement>(firstInvalid[1])?.focus();
  return firstInvalid !== undefined;
}

export function createUpdateRequestError(error: Error) {
  if (error instanceof ApiError && error.status === 403) return "You can only add updates to your own projects.";
  if (error instanceof ApiError && error.message === "Referenced update not found") return "A linked update is no longer available. Refresh the form and try again.";
  if (error instanceof ApiError && error.status === 404) return "This project no longer exists.";
  return updateRequestError(error);
}
