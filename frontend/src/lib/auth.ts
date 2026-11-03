// React hooks for login state

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";

import { login, register } from "@/api/auth";
import { getCurrentProfile } from "@/api/users";
import type { RegistrationInput } from "@/api/models";

import {
  clearTokens,
  getSessionKey,
  isAuthenticated,
  saveTokens,
  subscribe,
} from "@/lib/token-store";

interface LoginInput {
  identifier: string;
  password: string;
  remember: boolean;
}

export function useIsAuthenticated() {
  return useSyncExternalStore(subscribe, isAuthenticated);
}
export function useCurrentProfile() {
  const sessionKey = useSyncExternalStore(subscribe, getSessionKey);

  return useQuery({
    queryKey: ["current-profile", sessionKey],
    queryFn: ({ signal }) => getCurrentProfile(signal),
    enabled: sessionKey !== null,
    gcTime: 0,
    retry: false,
  });
}


export function useLogin() {
  return useMutation({
    mutationFn: ({ identifier, password }: LoginInput) =>
      login(identifier.trim(), password),
    onSuccess: (tokens, { remember }) => saveTokens(tokens, remember),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: ({ username, email, password }: RegistrationInput) =>
      register({ username: username.trim(), email: email.trim(), password }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return () => {
    clearTokens();
    queryClient.clear();
    void navigate({ to: "/login" });
  };
}
export function safeRedirect(path: string | undefined): string {
  return path?.startsWith("/") && !path.startsWith("//") ? path : "/";
}
