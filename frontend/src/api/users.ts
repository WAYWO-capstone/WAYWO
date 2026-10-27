// /users: public profiles and the signed-in user's own profile.
import { ApiError, request } from "@/api/client";
import type { AccountProfile, ProfileUpdate, PublicProfile } from "@/api/models";
import { getTokens } from "@/lib/token-store";

export function getPublicProfile(username: string, signal?: AbortSignal) {
  // /users/me belongs to the signed-in user
  if (username.trim().toLowerCase() === "me") {
    return Promise.reject(new ApiError(404));
  }
  return request<PublicProfile>(`/users/${encodeURIComponent(username)}`, {
    signal,
    auth: false,
  });
}

// The signed-in user's profile, for the header and account page.
export function getCurrentProfile(signal?: AbortSignal) {
  if (!getTokens()) return Promise.reject(new ApiError(401));
  return request<AccountProfile>("/users/me", { signal });
}

// Send only the profile fields being changed.
export function updateProfile(changes: ProfileUpdate) {
  return request<PublicProfile>("/users/me", { method: "PATCH", json: changes });
}

export function uploadProfilePicture(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return request<PublicProfile>("/users/me/picture", {
    method: "POST",
    body: formData,
  });
}
