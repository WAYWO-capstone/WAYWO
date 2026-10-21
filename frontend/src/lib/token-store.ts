// Saves, reads and removes the login tokens in the browser.

const ACCESS_TOKEN_KEY = "waywo.access_token";
const REFRESH_TOKEN_KEY = "waywo.refresh_token";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const listeners = new Set<() => void>();

// Changes on login/logout so old requests can be ignored.
let sessionVersion = 0;

function removeTokens() {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem(ACCESS_TOKEN_KEY);
    storage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function getTokens(): AuthTokens | null {
  for (const storage of [localStorage, sessionStorage]) {
    const accessToken = storage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = storage.getItem(REFRESH_TOKEN_KEY);

    if (accessToken && refreshToken) {
      return { accessToken, refreshToken };
    }
  }

  return null;
}

function storeTokens(tokens: AuthTokens, remember: boolean) {
  removeTokens();

  // Remember me keeps tokens in localStorage.
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  storage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);

  listeners.forEach((listener) => listener());
}

export function saveTokens(tokens: AuthTokens, remember: boolean) {
  sessionVersion += 1;
  storeTokens(tokens, remember);
}

export function getSessionVersion(): number {
  return sessionVersion;
}

// Renew tokens without changing the session or Remember me choice.
export function renewTokens(
  tokens: AuthTokens,
  previous: AuthTokens,
  version: number,
): boolean {
  const current = getTokens();

  if (
    sessionVersion !== version ||
    !current ||
    current.accessToken !== previous.accessToken ||
    current.refreshToken !== previous.refreshToken
  ) {
    return false;
  }

  const remember =
    localStorage.getItem(REFRESH_TOKEN_KEY) === previous.refreshToken;

  storeTokens(tokens, remember);
  return true;
}

export function clearTokens() {
  sessionVersion += 1;
  removeTokens();
  listeners.forEach((listener) => listener());
}

// Decode expiry for local checks; the backend verifies the token.
function tokenPayload(jwt: string): { sub?: unknown; exp?: unknown } | null {
  try {
    const payload = jwt
      .split(".")[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

// marginMs treats a token that expires within that time as already expired.
function isExpired(jwt: string, marginMs = 0): boolean {
  const payload = tokenPayload(jwt);

  return (
    payload === null ||
    (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now() + marginMs)
  );
}

// True when the access token is expired or about to be, so it should be renewed first.
export function accessTokenExpiresSoon(tokens: AuthTokens): boolean {
  return isExpired(tokens.accessToken, 30_000);
}

// Id of the signed-in user, read from the token, or null when signed out.
export function getTokenUserId(): string | null {
  const tokens = getTokens();
  const sub = tokens ? tokenPayload(tokens.refreshToken)?.sub : null;
  return typeof sub === "string" ? sub : null;
}

export function isAuthenticated(): boolean {
  const tokens = getTokens();
  return tokens !== null && !isExpired(tokens.refreshToken);
}

// Keep private caches separate between login sessions.
export function getSessionKey(): number | null {
  return isAuthenticated() ? sessionVersion : null;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}