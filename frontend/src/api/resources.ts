import { api, unwrap } from "@/api/client";
import type { ProjectResource } from "@/api/models";

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
