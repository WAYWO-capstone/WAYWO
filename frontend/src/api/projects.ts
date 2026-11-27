// /projects: creating, editing and publishing projects.
import { api, unwrap } from "@/api/client";
import type { DraftProject, ProjectInput, ProjectStatus } from "@/api/models";

const projectPath = (projectId: string) => ({ path: { project_id: projectId } });

export function getProjectCategories() {
  return unwrap(api.GET("/projects/categories"));
}

export function getProject(projectId: string) {
  return unwrap(api.GET("/projects/{project_id}", { params: projectPath(projectId) }));
}

export async function getMyDrafts() {
  // The backend only returns drafts here.
  return (await unwrap(api.GET("/projects/mine/drafts"))) as DraftProject[];
}

export function getMyPublishedProjects() {
  return unwrap(api.GET("/projects/mine/published"));
}

export function getMyArchivedProjects() {
  return unwrap(api.GET("/projects/mine/archived"));
}

export function createProject(data: ProjectInput, options?: { keepalive?: boolean }) {
  return unwrap(api.POST("/projects", { body: data, keepalive: options?.keepalive }));
}

export function saveProjectDraft(projectId: string, data: ProjectInput) {
  return unwrap(
    api.PATCH("/projects/{project_id}/draft", { params: projectPath(projectId), body: data }),
  );
}

export function updateProject(projectId: string, data: ProjectInput) {
  return unwrap(
    api.PATCH("/projects/{project_id}", { params: projectPath(projectId), body: data }),
  );
}

export function autosaveProject(
  projectId: string,
  data: Partial<ProjectInput>,
  options?: { keepalive?: boolean },
) {
  return unwrap(
    api.PATCH("/projects/{project_id}/autosave", {
      params: projectPath(projectId),
      body: data,
      keepalive: options?.keepalive,
    }),
  );
}

export async function deleteProject(projectId: string): Promise<void> {
  await unwrap(api.DELETE("/projects/{project_id}", { params: projectPath(projectId) }));
}

export function publishProject(projectId: string) {
  return unwrap(api.POST("/projects/{project_id}/publish", { params: projectPath(projectId) }));
}

export function archiveProject(projectId: string) {
  return unwrap(api.POST("/projects/{project_id}/archive", { params: projectPath(projectId) }));
}

export function restoreProject(projectId: string) {
  return unwrap(api.POST("/projects/{project_id}/restore", { params: projectPath(projectId) }));
}

export function updateProjectStatus(projectId: string, status: ProjectStatus) {
  return unwrap(
    api.PATCH("/projects/{project_id}/status", {
      params: projectPath(projectId),
      body: { status },
    }),
  );
}
