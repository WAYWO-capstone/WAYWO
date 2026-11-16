import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { ApiError } from "@/api/client";
import {
  followCreator,
  getFollowedCreators,
  getFollowingStatus,
  getPublicFollowing,
  unfollowCreator,
} from "@/api/follows";
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

export function useFollowedCreators() {
  const sessionKey = useSyncExternalStore(subscribe, getSessionKey);
  return useQuery({
    queryKey: ["followed-creators", sessionKey] as const,
    queryFn: getFollowedCreators,
    enabled: sessionKey !== null,
    retry: false,
  });
}

export function usePublicFollowing(username: string) {
  return useQuery({
    queryKey: ["public-following", username.toLowerCase()] as const,
    queryFn: () => getPublicFollowing(username),
    enabled: username.length > 0,
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
    onSuccess: (_result, follow) => {
      queryClient.setQueryData(followingStatusKey(sessionKey, username), {
        is_following: follow,
      });
      void queryClient.invalidateQueries({
        queryKey: ["public-profile", username.toLowerCase()],
        exact: true,
      });
    },
  });
}