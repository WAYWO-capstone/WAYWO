// Typed clients for the WAYWO backend. Paths, parameters, bodies and responses
// are checked against the generated OpenAPI types (`schema.gen.ts`).
import createClient from "openapi-fetch";
import type { TokenResponse } from "@/api/models";
import type { paths } from "@/api/schema.gen";
import {
  accessTokenExpiresSoon,
  getSessionVersion,
  getTokens,
  renewTokens,
  type AuthTokens,
} from "@/lib/token-store";

// openapi-fetch builds a Request, which needs a full URL outside the browser.
const API_URL = new URL(
  import.meta.env.VITE_API_URL ?? "/api",
  globalThis.location?.origin ?? "http://localhost",
).href.replace(/\/+$/, "");

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
function toApiError(status: number, body: unknown): ApiError {
  if (
    typeof body === "object" &&
    body !== null &&
    "detail" in body &&
    typeof body.detail === "string"
  ) {
    return new ApiError(status, body.detail);
  }
  return new ApiError(status);
}

interface ApiResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

// Returns the response data, or throws an ApiError when the request failed.
export async function unwrap<T>(pending: Promise<ApiResult<T>>): Promise<T> {
  const { data, error, response } = await pending;
  if (!response.ok) throw toApiError(response.status, error);
  return data as T;
}

export function toAuthTokens(data: TokenResponse): AuthTokens {
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

// Requests sent without the access token. `fetch` is looked up on each call
// so tests can replace it.
export const publicApi = createClient<paths>({
  baseUrl: API_URL,
  fetch: (request) => fetch(request),
});

// Shared so requests failing at the same time renew the tokens only once.
let renewing: Promise<void> | null = null;

// Gets a new token pair with the refresh token. Access tokens last 30 minutes,
// so long sessions would otherwise start failing with 401.
function renewAccessToken(previous: AuthTokens): Promise<void> {
  renewing ??= (async () => {
    const version = getSessionVersion();
    try {
      const { data } = await publicApi.POST("/auth/refresh", {
        body: { refresh_token: previous.refreshToken },
      });
      if (data) renewTokens(toAuthTokens(data), previous, version);
    } catch {
      // The request that needed the token fails with 401 and reports it.
    }
  })().finally(() => {
    renewing = null;
  });
  return renewing;
}

// Sends the request with the access token, renewing it when it expires soon
// or the backend rejects it.
async function authFetch(request: Request): Promise<Response> {
  // Read the body once so the request can be sent again after a renewal.
  const body = request.body ? await request.arrayBuffer() : undefined;
  const send = (tokens: AuthTokens | null) => {
    const attempt = new Request(request, { body });
    if (tokens) attempt.headers.set("Authorization", `Bearer ${tokens.accessToken}`);
    return fetch(attempt);
  };

  let tokens = getTokens();
  if (tokens && accessTokenExpiresSoon(tokens)) {
    await renewAccessToken(tokens);
    tokens = getTokens();
  }

  const response = await send(tokens);

  // The token may have been revoked or expired early; renew it once and retry.
  if (response.status === 401 && tokens) {
    await renewAccessToken(tokens);
    const renewed = getTokens();
    if (renewed && renewed.accessToken !== tokens.accessToken) return send(renewed);
  }
  return response;
}

// Requests sent as the signed-in user, when there is one.
export const api = createClient<paths>({ baseUrl: API_URL, fetch: authFetch });
