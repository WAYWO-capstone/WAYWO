// Calls to the WAYWO backend API
import { getTokens, type AuthTokens } from "@/lib/token-store";

const API_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/+$/, "");

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
  }
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
}

export async function login(
  identifier: string,
  password: string,
): Promise<AuthTokens> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login: identifier, password }),
  });

  if (!response.ok) throw new ApiError(response.status);

  const data: TokenResponse = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  };
}

// Public profile fields returned by the backend
export interface PublicProfile {
  username: string;
  bio: string | null;
  profile_picture_link: string | null;
}

export interface AccountProfile extends PublicProfile {
  email: string;
}

export async function getPublicProfile(
  username: string,
  signal?: AbortSignal,
): Promise<PublicProfile> {
  // /users/me belongs to the signed-in user
  if (username.trim().toLowerCase() === "me") {
    throw new ApiError(404);
  }

  const response = await fetch(
    `${API_URL}/users/${encodeURIComponent(username)}`,
    { signal },
  );

  if (!response.ok) throw new ApiError(response.status);

  return response.json();
}

// Load the signed-in user's profile for the header.
export async function getCurrentProfile(
  signal?: AbortSignal,
): Promise<AccountProfile> {
  const tokens = getTokens();
  if (!tokens) throw new ApiError(401);

  const response = await fetch(`${API_URL}/users/me`, {
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
    },
    signal,
  });

  if (!response.ok) throw new ApiError(response.status);

  return response.json();
}