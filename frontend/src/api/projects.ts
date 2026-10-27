// /projects: creating, editing and publishing projects.
import { request } from "@/api/client";
import type {
  DraftProject,
  OwnedProject,
  ProjectCategory,
  ProjectInput,
  ProjectResult,
  ProjectView,
} from "@/api/models";

export function getProjectCategories() {
  return request<ProjectCategory[]>("/projects/categories");
}

export function getProject(projectId: string) {
  return request<ProjectView>(`/projects/${projectId}`);
}

export function getMyDrafts() {
  return request<DraftProject[]>("/projects/mine/drafts");
}

export function getMyPublishedProjects() {
  return request<OwnedProject[]>("/projects/mine/published");
}

export function createProject(data: ProjectInput, options?: { keepalive?: boolean }) {
  return request<ProjectResult>("/projects", {
    method: "POST",
    json: data,
    keepalive: options?.keepalive,
  });
}

export function saveProjectDraft(projectId: string, data: ProjectInput) {
  return request<ProjectResult>(`/projects/${projectId}/draft`, {
    method: "PATCH",
    json: data,
  });
}

export function updateProject(projectId: string, data: ProjectInput) {
  return request<ProjectResult>(`/projects/${projectId}`, {
    method: "PATCH",
    json: data,
  });
}

export function autosaveProject(
  projectId: string,
  data: Partial<ProjectInput>,
  options?: { keepalive?: boolean },
) {
  return request<ProjectResult>(`/projects/${projectId}/autosave`, {
    method: "PATCH",
    json: data,
    keepalive: options?.keepalive,
  });
}

export function deleteProject(projectId: string) {
  return request<void>(`/projects/${projectId}`, { method: "DELETE" });
}

export function publishProject(projectId: string) {
  return request<ProjectResult>(`/projects/${projectId}/publish`, { method: "POST" });
}

export function unpublishProject(projectId: string) {
  return request<ProjectResult>(`/projects/${projectId}/unpublish`, { method: "POST" });
}

export function updateProjectStatus(projectId: string, status: ProjectView["status"]) {
  return request<ProjectResult>(`/projects/${projectId}/status`, {
    method: "PATCH",
    json: { status },
  });
}
