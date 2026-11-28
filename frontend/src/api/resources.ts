import { api, unwrap } from "@/api/client";
import type { ProjectResource, ProjectResourceLink } from "@/api/models";

const projectPath = (projectId: string) => ({ path: { project_id: projectId } });

export function getProjectResources(projectId: string): Promise<ProjectResource[]> {
  return unwrap(api.GET("/projects/{project_id}/resources", { params: projectPath(projectId) }));
}

export function attachResource(
  projectId: string,
  uploadId: string,
  title?: string,
): Promise<ProjectResource> {
  return unwrap(
    api.POST("/projects/{project_id}/resources", {
      params: projectPath(projectId),
      body: { upload_id: uploadId, title },
    }),
  );
}

export function getProjectResourceLinks(
  projectId: string,
): Promise<ProjectResourceLink[]> {
  return unwrap(
    api.GET("/projects/{project_id}/resources/links", {
      params: projectPath(projectId),
    }),
  );
}

export function createProjectResourceLink(
  projectId: string,
  title: string,
  url: string,
): Promise<ProjectResourceLink> {
  return unwrap(
    api.POST("/projects/{project_id}/resources/links", {
      params: projectPath(projectId),
      body: { title, url },
    }),
  );
}
