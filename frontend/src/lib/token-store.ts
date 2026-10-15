// Saves, reads and removes the login tokens in the browser.
// Tracks whether the user is logged in.

const ACCESS_TOKEN_KEY = "waywo.access_token";
const REFRESH_TOKEN_KEY = "waywo.refresh_token";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const listeners = new Set<() => void>();

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
    if (accessToken && refreshToken) return { accessToken, refreshToken };
  }
  return null;
}

export function saveTokens(tokens: AuthTokens, remember: boolean) {
  removeTokens();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  storage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  listeners.forEach((listener) => listener());
}

function isExpired(jwt: string): boolean {
  try {
    const payload = JSON.parse(
      atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return typeof payload.exp === "number" && payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function isAuthenticated(): boolean {
  const tokens = getTokens();
  return tokens !== null && !isExpired(tokens.refreshToken);
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}