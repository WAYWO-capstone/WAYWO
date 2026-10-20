import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { ApiError, getProjectCategories } from "@/lib/api";

export function requestError(error: Error) {
  if (error instanceof ApiError && error.status === 401) return "Your session has expired. Please log in again.";
  if (error instanceof ApiError && error.status === 403) return "You can only change your own projects.";
  if (error instanceof ApiError && error.status === 404) return "This project no longer exists.";
  if (error instanceof ApiError && error.status === 405) return "Deleting projects isn't available yet.";
  if (error instanceof ApiError && error.status === 422) return "Check the project details and category, then try again.";
  if (error instanceof TypeError) return "Can't reach the server. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

export function useProjectCategories() {
  return useQuery({ queryKey: ["project-categories"], queryFn: getProjectCategories });
}

// Disabling a field while saving drops its focus. Call the returned function
// before locking the form, and focus goes back there once it unlocks.
export function useRestoreFocus(locked: boolean) {
  const focused = useRef<Element | null>(null);

  useEffect(() => {
    if (locked) return;
    const element = focused.current;
    focused.current = null;
    // Don't take focus back if the user has moved on to something else.
    const nothingFocused = !document.activeElement || document.activeElement === document.body;
    if (element instanceof HTMLElement && element.isConnected && nothingFocused) element.focus();
  }, [locked]);

  return useCallback(() => {
    focused.current = document.activeElement;
  }, []);
}
