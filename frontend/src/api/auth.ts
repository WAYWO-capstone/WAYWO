// /auth: sign-in, registration and account credentials.
import { request, toAuthTokens } from "@/api/client";
import type {
  EmailUpdate,
  PasswordUpdate,
  RegistrationInput,
  TokenResponse,
  UserResponse,
} from "@/api/models";
import type { AuthTokens } from "@/lib/token-store";

export async function login(
  identifier: string,
  password: string,
): Promise<AuthTokens> {
  const data = await request<TokenResponse>("/auth/login", {
    method: "POST",
    json: { login: identifier, password },
    auth: false,
  });
  return toAuthTokens(data);
}

export function register(input: RegistrationInput) {
  return request<UserResponse>("/auth/register", {
    method: "POST",
    json: input,
    auth: false,
  });
}

// Updates the email after checking the current password.
export function updateEmail(changes: EmailUpdate) {
  return request<UserResponse>("/auth/email", { method: "PATCH", json: changes });
}

export function updatePassword(changes: PasswordUpdate) {
  return request<void>("/auth/password", { method: "PATCH", json: changes });
}
