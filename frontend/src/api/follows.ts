// /follows: following and unfollowing creators.
import { request } from "@/api/client";
import type { CreatorFollow, FollowingStatus } from "@/api/models";

function followPath(username: string) {
  return `/follows/${encodeURIComponent(username)}`;
}

export function getFollowingStatus(username: string) {
  return request<FollowingStatus>(followPath(username));
}

export function followCreator(username: string) {
  return request<CreatorFollow>(followPath(username), { method: "POST" });
}

export function unfollowCreator(username: string) {
  return request<void>(followPath(username), { method: "DELETE" });
}
