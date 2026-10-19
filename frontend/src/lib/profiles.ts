import { queryOptions, useQuery } from "@tanstack/react-query";
import { getPublicProfile } from "@/lib/api";

export function publicProfileOptions(username: string) {
  return queryOptions({
    // Reuse the cache for usernames that differ only by case.
    queryKey: ["public-profile", username.toLowerCase()] as const,
    // Pass cancellation through to fetch.
    queryFn: ({ signal }) => getPublicProfile(username, signal),
  });
}

export function usePublicProfile(username: string) {
  return useQuery(publicProfileOptions(username));
}
