// /follows: following and unfollowing creators.
import { api, unwrap } from "@/api/client";

const followParams = (username: string) => ({ path: { username } });

export function getFollowingStatus(username: string) {
  return unwrap(api.GET("/follows/{username}", { params: followParams(username) }));
}

export function getFollowedCreators() {
  return unwrap(api.GET("/follows/following"));
}

export function getPublicFollowing(username: string) {
  return unwrap(api.GET("/users/{username}/following", { params: followParams(username) }));
}

export function followCreator(username: string) {
  return unwrap(api.POST("/follows/{username}", { params: followParams(username) }));
}

export function unfollowCreator(username: string) {
  return unwrap(api.DELETE("/follows/{username}", { params: followParams(username) }));
}
