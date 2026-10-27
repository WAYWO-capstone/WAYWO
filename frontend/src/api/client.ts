// Shared request helper for the WAYWO backend. Every API call goes through `request`.
import type { TokenResponse } from "@/api/models";
import {
  accessTokenExpiresSoon,
  getSessionVersion,
  getTokens,
  renewTokens,
  type AuthTokens,
} from "@/lib/token-store";

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

// Uses the backend's `detail` as the message when the error body has one.
async function toApiError(response: Response): Promise<ApiError> {
  try {
    const payload: unknown = await response.json();
    if (
      typeof payload === "object" &&
      payload !== null &&
      "detail" in payload &&
      typeof payload.detail === "string"
    ) {
      return new ApiError(response.status, payload.detail);
    }
  } catch {
    // Not a JSON error body.
  }
  return new ApiError(response.status);
}

export function toAuthTokens(data: TokenResponse): AuthTokens {
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

// Shared so requests failing at the same time renew the tokens only once.
let renewing: Promise<void> | null = null;

// Gets a new token pair with the refresh token. Access tokens last 30 minutes,
// so long sessions would otherwise start failing with 401.
function renewAccessToken(previous: AuthTokens): Promise<void> {
  renewing ??= (async () => {
    const version = getSessionVersion();
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: previous.refreshToken }),
      });
      if (!response.ok) return;
      const data: TokenResponse = await response.json();
      renewTokens(toAuthTokens(data), previous, version);
    } catch {
      // The request that needed the token fails with 401 and reports it.
    }
  })().finally(() => {
    renewing = null;
  });
  return renewing;
}

export interface RequestOptions extends RequestInit {
  // Sent as the JSON body.
  json?: unknown;
  // Send the access token when signed in. Defaults to true.
  auth?: boolean;
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
  renewed = false,
): Promise<T> {
  const { json, auth = true, headers, ...init } = options;

  let tokens = auth ? getTokens() : null;
  if (tokens && accessTokenExpiresSoon(tokens)) {
    await renewAccessToken(tokens);
    tokens = getTokens();
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    body: json === undefined ? init.body : JSON.stringify(json),
    headers: {
      ...(json === undefined ? {} : { "Content-Type": "application/json" }),
      ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
      ...headers,
    },
  });

  // The token may have been revoked or expired early; renew it once and retry.
  if (response.status === 401 && tokens && !renewed) {
    await renewAccessToken(tokens);
    if (getTokens()?.accessToken !== tokens.accessToken) {
      return request<T>(path, options, true);
    }
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
