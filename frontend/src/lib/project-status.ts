import { ApiError } from "@/api/client";
import type { ProjectView } from "@/api/models";

export function statusLabel(status: ProjectView["status"]) {
  if (status === "COMPLETED") return "Completed";
  if (status === "DRAFT") return "Draft";
  if (status === "ARCHIVED") return "Archived";
  return "Active";
}

export function statusClasses(status: ProjectView["status"]) {
  if (status === "ACTIVE") return "bg-[#c9e9b9] text-[#173d18]";
  if (status === "COMPLETED") return "bg-[#d9e8f1] text-[#173d3e]";
  if (status === "ARCHIVED") return "bg-[#e8dce8] text-[#49364b]";
  return "bg-[#f3e4c7] text-[#604a25]";
}

export function archivedAtLabel(archivedAt: string | null) {
  if (!archivedAt) return null;
  const date = new Date(archivedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `Archived on ${date}`;
}
export type StatusChangeStep =
  | { type: "publish" }
  | { type: "set-status"; status: Exclude<ProjectView["status"], "DRAFT" | "ARCHIVED"> };

// Changing a project status can require multiple steps, e.g. Draft -> Completed requires publishing first, then marking completed. This function returns the steps required to change from one status to another.
export function statusChangeSteps(
  current: ProjectView["status"],
  next: ProjectView["status"],
): StatusChangeStep[] {
  if (current === next) return [];
  if (next === "DRAFT" || next === "ARCHIVED") throw new Error("Use the archive action for published projects");
  if (current === "DRAFT") {
    return next === "COMPLETED"
      ? [{ type: "publish" }, { type: "set-status", status: "COMPLETED" }]
      : [{ type: "publish" }];
  }
  if (current === "ARCHIVED") throw new Error("Restore an archived project before changing its status");
  return [{ type: "set-status", status: next }];
}

// Error for indicating the error failing halfway through the multi-step stauts change. 
export class PartialStatusChangeError extends Error {}

export function statusChangeError(error: Error) {
  if (error instanceof PartialStatusChangeError) return "Your project was published but couldn't be marked completed. Please try again.";
  if (error instanceof ApiError && error.status === 401) return "Your session has expired. Please log in again.";
  if (error instanceof ApiError && error.status === 403) return "You can only change the status of your own projects.";
  if (error instanceof ApiError && error.status === 404) return "This project no longer exists.";
  if (error instanceof ApiError && error.status === 409) return "This status change isn't allowed right now. Refresh the page and try again.";
  if (error instanceof TypeError) return "Can't reach the server. Check your connection and try again.";
  return "Could not update the project status. Please try again.";
}
