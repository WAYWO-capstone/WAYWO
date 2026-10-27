// Project updates: the history timeline on a project.
import { api, unwrap } from "@/api/client";

export const UPDATE_PAGE_SIZE = 20;

export function getProjectHistory(projectId: string, offset = 0) {
  return unwrap(
    api.GET("/projects/{project_id}/history", {
      params: {
        path: { project_id: projectId },
        query: { limit: UPDATE_PAGE_SIZE, offset },
      },
    }),
  );
}
