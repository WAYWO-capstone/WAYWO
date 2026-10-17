// Calls to the WAYWO backend API

import type { AuthTokens } from "@/lib/token-store";
import { getTokens } from "@/lib/token-store";

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

export interface ProjectCategory {
  id: string;
  name: string;
  description: string;
}

export interface ProjectInput {
  title: string;
  summary: string;
  description: string;
  category_id: string;
  tags: string[];
}

export interface ProjectResult {
  id: string;
  title: string;
  last_autosaved_at: string | null;
}

export interface ProjectView extends ProjectResult {
  author_id: string;
  summary: string;
  description: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED";
  public: boolean;
  category: ProjectCategory;
  tags: { id: string; name: string }[];
  created_at: string;
  published_at: string | null;
  completed_at: string | null;
  author: { username: string; profile_picture_link: string | null };
}

async function projectRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const tokens = getTokens();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<T>;
}

export function getProjectCategories() {
  return projectRequest<ProjectCategory[]>("/projects/categories");
}

export function getProject(projectId: string) {
  return projectRequest<ProjectView>(`/projects/${projectId}`);
}

export function createProject(data: ProjectInput) {
  return projectRequest<ProjectResult>("/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function saveProjectDraft(projectId: string, data: ProjectInput) {
  return projectRequest<ProjectResult>(`/projects/${projectId}/draft`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function publishProject(projectId: string) {
  return projectRequest<ProjectResult>(`/projects/${projectId}/publish`, {
    method: "POST",
  });
}
