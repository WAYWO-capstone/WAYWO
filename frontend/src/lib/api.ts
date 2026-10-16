// Calls to the WAYWO backend API

import type { AuthTokens } from "@/lib/token-store";
import wretch from "wretch";
import { queryStringAddon } from "wretch/addons";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
  }
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
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
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
    .catch((err) => {
      if (err instanceof ApiError) {
        throw err;
      } else {
        throw new Error("Network error or server is unreachable.");
      }
    });
}
