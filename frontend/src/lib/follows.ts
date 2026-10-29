import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { ApiError, followCreator, getFollowingStatus, unfollowCreator } from "@/lib/api";
import { getSessionKey, subscribe } from "@/lib/token-store";

export function followingStatusKey(sessionKey: number | null, username: string) {
  return ["following-status", sessionKey, username.toLowerCase()] as const;
}

export function isAlreadySettled(error: unknown, following: boolean): boolean {
  return error instanceof ApiError && error.status === (following ? 409 : 404);
}

// checks whether you follow this user
export function useFollowingStatus(username: string, enabled: boolean) {
  const sessionKey = useSyncExternalStore(subscribe, getSessionKey);
  return useQuery({
    queryKey: followingStatusKey(sessionKey, username),
    queryFn: () => getFollowingStatus(username),
    enabled: enabled && sessionKey !== null,
    retry: false,
  });
}

// follows or unfollows, then updates the button
export function useToggleFollow(username: string) {
  const queryClient = useQueryClient();
  const sessionKey = useSyncExternalStore(subscribe, getSessionKey);

  return useMutation({
    mutationFn: (follow: boolean) =>
      (follow ? followCreator(username) : unfollowCreator(username)).catch((error) => {
        if (!isAlreadySettled(error, follow)) throw error;
      }),
    onSuccess: (_result, follow) =>
      queryClient.setQueryData(followingStatusKey(sessionKey, username), { is_following: follow }),
  });
}