import { useQuery } from "@tanstack/react-query";
import { ApiError, getProjectCategories } from "@/lib/api";

export function requestError(error: Error) {
  if (error instanceof ApiError && error.status === 401) return "Your session has expired. Please log in again.";
  if (error instanceof ApiError && error.status === 403) return "You can only edit your own projects.";
  if (error instanceof ApiError && error.status === 404) return "This project no longer exists.";
  if (error instanceof ApiError && error.status === 422) return "Check the project details and category, then try again.";
  if (error instanceof TypeError) return "Can't reach the server. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

export function useProjectCategories() {
  return useQuery({ queryKey: ["project-categories"], queryFn: getProjectCategories });
}
