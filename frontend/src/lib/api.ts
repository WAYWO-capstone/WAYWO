// Calls to the WAYWO backend API

import type { AuthTokens } from "@/lib/token-store";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

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
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}