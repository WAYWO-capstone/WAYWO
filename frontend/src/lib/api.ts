// Calls to the WAYWO backend API

import type { AuthTokens } from "@/lib/token-store";
import wretch from "wretch";
import { queryStringAddon } from "wretch/addons";

const API_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/+$/, "");

export class ApiError extends Error {
  readonly status: number;

  constructor(
    status: number,
    message = `Request failed with status ${status}`,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function getErrorDetail(message: string): string | undefined {
  try {
    const payload: unknown = JSON.parse(message);

    if (
      typeof payload === "object" &&
      payload !== null &&
      "detail" in payload &&
      typeof payload.detail === "string"
    ) {
      return payload.detail;
    }
  } catch {
    // Not a JSON error body.
  }

  return undefined;
}

export const api = wretch(API_URL)
  .options({ credentials: "include" })
  .addon(queryStringAddon);

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

export async function register(RegisterationInput: {
  username: string;
  email: string;
  password: string;
}) {
  return api
    .url("/auth/register")
    .post(RegisterationInput)
    .res((res) => {
      if (!res.ok) throw new ApiError(res.status);
      return res.json();
    })
    .catch((err: unknown) => {
      if (err instanceof ApiError) throw err;

      if (
        err instanceof Error &&
        "status" in err &&
        typeof err.status === "number"
      ) {
        throw new ApiError(
          err.status,
          getErrorDetail(err.message) ?? err.message,
        );
      }

      throw new Error("Network error or server is unreachable.");
    });
}

// Public profile fields returned by the backend
export interface PublicProfile {
  username: string;
  bio: string | null;
  profile_picture_link: string | null;
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
