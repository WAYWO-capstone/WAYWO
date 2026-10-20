// Calls to the WAYWO backend API
import wretch from "wretch";
import { queryStringAddon } from "wretch/addons";
import { getTokens, type AuthTokens } from "@/lib/token-store";

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

function getErrorDetail(message: string): string | undefined {
  try {
    const payload: unknown = JSON.parse(message);

    if (
      typeof payload === "object" &&
      payload !== null &&
      "detail" in payload &&
      typeof payload.detail === "string"
    ) {
      return payload.detail;
    }
  } catch {
    // Not a JSON error body.
  }

  return undefined;
}

export const api = wretch(API_URL)
  .options({ credentials: "include" })
  .addon(queryStringAddon);

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

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  };
}

export async function register(RegisterationInput: {
  username: string;
  email: string;
  password: string;
}) {
  return api
    .url("/auth/register")
    .post(RegisterationInput)
    .res((res) => {
      if (!res.ok) throw new ApiError(res.status);
      return res.json();
    })
    .catch((err: unknown) => {
      if (err instanceof ApiError) throw err;

      if (
        err instanceof Error &&
        "status" in err &&
        typeof err.status === "number"
      ) {
        throw new ApiError(
          err.status,
          getErrorDetail(err.message) ?? err.message,
        );
      }

      throw new Error("Network error or server is unreachable.");
    });
}

// Public profile fields returned by the backend
export interface PublicProfile {
  username: string;
  bio: string | null;
  profile_picture_link: string | null;
}

export interface AccountProfile extends PublicProfile {
  email: string;
}

export async function getPublicProfile(
  username: string,
  signal?: AbortSignal,
): Promise<PublicProfile> {
  // /users/me belongs to the signed-in user
  if (username.trim().toLowerCase() === "me") {
    throw new ApiError(404);
  }

  const response = await fetch(
    `${API_URL}/users/${encodeURIComponent(username)}`,
    { signal },
  );

  if (!response.ok) throw new ApiError(response.status);

  return response.json();
}

// Load the signed-in user's profile for the header.
export async function getCurrentProfile(
  signal?: AbortSignal,
): Promise<AccountProfile> {
  const tokens = getTokens();
  if (!tokens) throw new ApiError(401);

  const response = await fetch(`${API_URL}/users/me`, {
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
    },
    signal,
  });

  if (!response.ok) throw new ApiError(response.status);

  return response.json();
}

export interface ProfileUpdate {
  bio?: string | null;
}

// send only the profile fields being changed
export async function updateProfile(
  changes: ProfileUpdate,
): Promise<PublicProfile> {
  const tokens = getTokens();
  if (!tokens) throw new ApiError(401);

  const response = await fetch(`${API_URL}/users/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokens.accessToken}`,
    },
    body: JSON.stringify(changes),
  });

  if (!response.ok) throw new ApiError(response.status);

  return response.json();
}

// send image using existing login token
export async function uploadProfilePicture(
  file: File,
): Promise<PublicProfile> {
  const tokens = getTokens();
  if (!tokens) throw new ApiError(401);

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/users/me/picture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) throw new ApiError(response.status);

  return response.json();
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

export interface DraftProject {
  id: string;
  title: string;
  summary: string;
  status: "DRAFT";
  category: ProjectCategory;
  created_at: string;
}

export interface OwnedProject {
  id: string;
  title: string;
  summary: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED";
  public: boolean;
  category: ProjectCategory;
  created_at: string;
  published_at: string | null;
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

export function getMyDrafts() {
  return projectRequest<DraftProject[]>("/projects/mine/drafts");
}

export function getMyPublishedProjects() {
  return projectRequest<OwnedProject[]>("/projects/mine/published");
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

export function unpublishProject(projectId: string) {
  return projectRequest<ProjectResult>(`/projects/${projectId}/unpublish`, {
    method: "POST",
  });
}

export function updateProjectStatus(
  projectId: string,
  status: ProjectView["status"],
) {
  return projectRequest<ProjectResult>(`/projects/${projectId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
