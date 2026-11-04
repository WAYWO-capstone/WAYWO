// /auth: sign-in, registration and account credentials.
import { api, publicApi, toAuthTokens, unwrap } from "@/api/client";
import type { EmailUpdate, PasswordUpdate, RegistrationInput } from "@/api/models";
import type { AuthTokens } from "@/lib/token-store";

export async function login(
  identifier: string,
  password: string,
): Promise<AuthTokens> {
  const data = await unwrap(
    publicApi.POST("/auth/login", { body: { login: identifier, password } }),
  );
  return toAuthTokens(data);
}

export function register(input: RegistrationInput) {
  return unwrap(publicApi.POST("/auth/register", { body: input }));
}

// Updates the email after checking the current password.
export function updateEmail(changes: EmailUpdate) {
  return unwrap(api.PATCH("/auth/email", { body: changes }));
}

export async function updatePassword(changes: PasswordUpdate): Promise<void> {
  await unwrap(api.PATCH("/auth/password", { body: changes }));
}
