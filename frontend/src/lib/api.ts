// Calls to the WAYWO backend API

import { getSessionVersion, getTokens, renewTokens, type AuthTokens } from "@/lib/token-store";

const API_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/+$/, "");

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
  }
}

// Used when login is needed again
export class SessionExpiredError extends ApiError {
  constructor() {
    super(401);
    this.name = "SessionExpiredError";
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
  if (username.trim().toLowerCase() === "me") throw new ApiError(404);

  const response = await fetch(
    `${API_URL}/users/${encodeURIComponent(username)}`,
    { signal },
  );
  if (!response.ok) throw new ApiError(response.status);
  return response.json();
}

// Ignore responses from a session that has since changed
function currentSession(version: number): AuthTokens {
  const tokens = getTokens();
  if (getSessionVersion() !== version || !tokens) {
    throw new DOMException("The login session changed.", "AbortError");
  }
  return tokens;
}

let refreshInFlight: { version: number; promise: Promise<AuthTokens> } | null = null;

async function refreshSession(previous: AuthTokens, version: number): Promise<AuthTokens> {
  // Share one refresh request between pending calls
  if (refreshInFlight?.version === version) return refreshInFlight.promise;

  const promise = (async () => {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: previous.refreshToken }),
    });
    currentSession(version);
    if (response.status === 401) throw new SessionExpiredError();
    if (!response.ok) throw new ApiError(response.status);
    const data: TokenResponse = await response.json();
    if (typeof data.access_token !== "string" || !data.access_token ||
      typeof data.refresh_token !== "string" || !data.refresh_token) {
      throw new ApiError(502);
    }
    const tokens = { accessToken: data.access_token, refreshToken: data.refresh_token };
    if (!renewTokens(tokens, previous, version)) {
      throw new DOMException("The login session changed.", "AbortError");
    }
    return tokens;
  })();
  refreshInFlight = { version, promise };
  try {
    return await promise;
  } finally {
    if (refreshInFlight?.promise === promise) refreshInFlight = null;
  }
}

// Refresh an expired access tokenn and then retry once
async function authenticatedRequest(
  path: string,
  method = "GET",
  signal?: AbortSignal,
): Promise<Response> {
  const tokens = getTokens();
  if (!tokens) throw new SessionExpiredError();
  const version = getSessionVersion();
  const send = (accessToken: string) => fetch(`${API_URL}${path}`, {
    method, headers: { Authorization: `Bearer ${accessToken}` }, signal,
  });
  let response = await send(tokens.accessToken);
  const current = currentSession(version);
  if (response.status === 401) {
    // Another request may have already refreshed the token.
    const refreshed = current.accessToken !== tokens.accessToken
      ? current
      : await refreshSession(current, version);
    signal?.throwIfAborted();
    currentSession(version);
    response = await send(refreshed.accessToken);
    currentSession(version);
  }
  return response;
}

export async function getCurrentProfile(signal?: AbortSignal): Promise<PublicProfile> {
  const response = await authenticatedRequest("/users/me", "GET", signal);
  if (!response.ok) throw new ApiError(response.status);
  return response.json();
}

export async function getFollowingStatus(
  username: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const response = await authenticatedRequest(
    `/follows/${encodeURIComponent(username)}`,
    "GET",
    signal,
  );
  if (!response.ok) throw new ApiError(response.status);
  const data: { is_following: boolean } = await response.json();
  return data.is_following;
}

export async function setFollowing(username: string, following: boolean): Promise<boolean> {
  const response = await authenticatedRequest(
    `/follows/${encodeURIComponent(username)}`,
    following ? "POST" : "DELETE",
  );
  // If another tab already changed this read the saved state
  if ((following && response.status === 409) || (!following && response.status === 404)) {
    return getFollowingStatus(username);
  }
  if (!response.ok) throw new ApiError(response.status);
  // DELETE returns 204 without a body
  return following;
}