// Project updates: the history timeline on a project.
import { request } from "@/api/client";
import type { UpdateHistoryPage } from "@/api/models";

export const UPDATE_PAGE_SIZE = 20;

export function getProjectHistory(projectId: string, offset = 0) {
  const query = new URLSearchParams({
    limit: String(UPDATE_PAGE_SIZE),
    offset: String(offset),
  });
  return request<UpdateHistoryPage>(`/projects/${projectId}/history?${query}`);
}
