// /users: public profiles and the signed-in user's own profile.
import { ApiError, api, publicApi, unwrap } from "@/api/client";
import type { ProfilePictureUpload, ProfileUpdate } from "@/api/models";
import { getTokens } from "@/lib/token-store";

export function getPublicProfile(username: string, signal?: AbortSignal) {
  // /users/me belongs to the signed-in user
  if (username.trim().toLowerCase() === "me") {
    return Promise.reject(new ApiError(404));
  }
  return unwrap(
    publicApi.GET("/users/{username}", { params: { path: { username } }, signal }),
  );
}

// The signed-in user's profile, for the header and account page.
export function getCurrentProfile(signal?: AbortSignal) {
  if (!getTokens()) return Promise.reject(new ApiError(401));
  return unwrap(api.GET("/users/me", { signal }));
}

// Send only the profile fields being changed.
export function updateProfile(changes: ProfileUpdate) {
  return unwrap(api.PATCH("/users/me", { body: changes }));
}

export function uploadProfilePicture(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return unwrap(
    api.POST("/users/me/picture", {
      // The schema types the file as a string; it is sent as FormData.
      body: formData as unknown as ProfilePictureUpload,
    }),
  );
}
