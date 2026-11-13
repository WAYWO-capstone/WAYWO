// Project updates: the history timeline on a project.
import { api, ApiError, unwrap } from "@/api/client";
import type { UpdateType } from "@/api/models";

export const UPDATE_PAGE_SIZE = 20;

const updatePath = (projectId: string, updateId: string) => ({
  path: { project_id: projectId, update_id: updateId },
});

export function getProjectHistory(projectId: string, offset = 0) {
  return unwrap(
    api.GET("/projects/{project_id}/updates", {
      params: {
        path: { project_id: projectId },
        query: { limit: UPDATE_PAGE_SIZE, offset },
      },
    }),
  );
}

// The API has no endpoint for reading one update yet, so look through the
// project's history. Missing updates fail with 404, as such an endpoint would.
export async function getProjectUpdate(projectId: string, updateId: string) {
  let offset = 0;
  while (true) {
    const page = await getProjectHistory(projectId, offset);
    const update = page.items.find((item) => item.id === updateId);
    if (update) return update;
    offset += page.items.length;
    if (page.items.length === 0 || offset >= page.total) throw new ApiError(404);
  }
}

export interface NewProjectUpdate {
  title: string;
  body: string;
  type: UpdateType;
}

export function createProjectUpdate(projectId: string, update: NewProjectUpdate) {
  return unwrap(
    api.POST("/projects/{project_id}/updates", {
      params: { path: { project_id: projectId } },
      body: update,
    }),
  );
}

export interface ProjectUpdateChanges {
  title?: string;
  body?: string;
  type?: UpdateType;
}

export function updateProjectUpdate(projectId: string, updateId: string, changes: ProjectUpdateChanges) {
  return unwrap(
    api.PATCH("/projects/{project_id}/updates/{update_id}", {
      params: updatePath(projectId, updateId),
      body: changes,
    }),
  );
}

export function deleteProjectUpdate(projectId: string, updateId: string) {
  return unwrap(
    api.DELETE("/projects/{project_id}/updates/{update_id}", {
      params: updatePath(projectId, updateId),
    }),
  );
}
