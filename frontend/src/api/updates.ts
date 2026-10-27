// Project updates: the history timeline on a project.
import { ApiError, request } from "@/api/client";
import type { ProjectUpdate, UpdateHistoryPage, UpdateType } from "@/api/models";

export const UPDATE_PAGE_SIZE = 20;

export function getProjectHistory(projectId: string, offset = 0) {
  const query = new URLSearchParams({
    limit: String(UPDATE_PAGE_SIZE),
    offset: String(offset),
  });
  return request<UpdateHistoryPage>(`/projects/${projectId}/updates?${query}`);
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

export interface ProjectUpdateChanges {
  title?: string;
  body?: string;
  type?: UpdateType;
}

export function updateProjectUpdate(projectId: string, updateId: string, changes: ProjectUpdateChanges) {
  return request<ProjectUpdate>(`/projects/${projectId}/updates/${updateId}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}

export function deleteProjectUpdate(projectId: string, updateId: string) {
  return request<void>(`/projects/${projectId}/updates/${updateId}`, {
    method: "DELETE",
  });
}
