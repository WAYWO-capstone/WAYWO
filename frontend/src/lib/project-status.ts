import { ApiError } from "@/api/client";
import type { ProjectView } from "@/api/models";

export function statusLabel(status: ProjectView["status"]) {
  if (status === "COMPLETED") return "Completed";
  if (status === "DRAFT") return "Draft";
  return "Active";
}

export function statusClasses(status: ProjectView["status"]) {
  if (status === "ACTIVE") return "bg-[#c9e9b9] text-[#173d18]";
  if (status === "COMPLETED") return "bg-[#d9e8f1] text-[#173d3e]";
  return "bg-[#f3e4c7] text-[#604a25]";
}
export type StatusChangeStep =
  | { type: "publish" }
  | { type: "unpublish" }
  | { type: "set-status"; status: "ACTIVE" | "COMPLETED" };

// Changing a project status can require multiple steps, e.g. Draft -> Completed requires publishing first, then marking completed. This function returns the steps required to change from one status to another.
export function statusChangeSteps(
  current: ProjectView["status"],
  next: ProjectView["status"],
): StatusChangeStep[] {
  if (current === next) return [];
  if (next === "DRAFT") return [{ type: "unpublish" }];
  if (current === "DRAFT") {
    return next === "COMPLETED"
      ? [{ type: "publish" }, { type: "set-status", status: "COMPLETED" }]
      : [{ type: "publish" }];
  }
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
