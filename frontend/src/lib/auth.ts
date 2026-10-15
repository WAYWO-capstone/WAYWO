// React hooks for login state

import { useMutation } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { login } from "@/lib/api";
import { isAuthenticated, saveTokens, subscribe } from "@/lib/token-store";

interface LoginInput {
  email: string;
  password: string;
  remember: boolean;
}

export function useIsAuthenticated() {
  return useSyncExternalStore(subscribe, isAuthenticated);
}

export function useLogin() {
  return useMutation({
    mutationFn: ({ email, password }: LoginInput) =>
      login(email.trim(), password),
    onSuccess: (tokens, { remember }) => saveTokens(tokens, remember),
  });
}

export function safeRedirect(path: string | undefined): string {
  return path?.startsWith("/") && !path.startsWith("//") ? path : "/";
}