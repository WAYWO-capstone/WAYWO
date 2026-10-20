import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { ProjectDetail } from "@/components/projects/project-detail";
import {
  ApiError,
  getProject,
  publishProject,
  unpublishProject,
  updateProjectStatus,
  type ProjectView,
} from "@/lib/api";
import { previewProject, previewUpdates } from "@/temp-mock-data";


export const Route = createFileRoute("/view-project")({
  validateSearch: (search: Record<string, unknown>) => ({
    projectId: typeof search.projectId === "string" ? search.projectId : undefined,
  }),
  component: ViewProjectPage,
});

function ViewProjectPage() {
  const { projectId } = Route.useSearch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId!),
    enabled: Boolean(projectId),
  });
  const project = projectId ? projectQuery.data : previewProject;
  const statusMutation = useMutation({
    mutationFn: async (nextStatus: ProjectView["status"]) => {
      if (!projectId || !project) throw new Error("Project is not loaded");
      if (nextStatus === project.status) return;
      if (nextStatus === "DRAFT") {
        await unpublishProject(projectId);
      } else if (project.status === "DRAFT") {
        await publishProject(projectId);
        if (nextStatus === "COMPLETED") {
          await updateProjectStatus(projectId, "COMPLETED");
        }
      } else {
        await updateProjectStatus(projectId, nextStatus);
      }
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["my-projects"] }),
      ]);
    },
  });
  const isOwner = Boolean(projectId && project?.is_owner);

  if (projectId && projectQuery.isLoading) {
    return <div className="flex flex-1 items-center justify-center gap-2 py-20 text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />Loading project...</div>;
  }

  if (projectQuery.isError || !project) {
    const status = projectQuery.error instanceof ApiError ? projectQuery.error.status : undefined;
    const message = status === 401
      ? "Your session has expired. Log in again to view this project."
      : status === 404
        ? "This project was not found or you do not have access to it."
        : status
          ? `Could not load this project (server returned ${status}).`
          : "Could not load this project. Check your connection and try again.";

    return <div role="alert" className="mx-auto flex w-full max-w-7xl items-center gap-2 px-6 py-16 text-destructive"><CircleAlert className="size-5" />{message}</div>;
  }

  return (
    <ProjectDetail
      project={project}
      isPreview={!projectId}
      previewUpdates={previewUpdates}
      isOwner={isOwner}
      isSavingStatus={statusMutation.isPending}
      statusUpdateFailed={statusMutation.isError}
      onStatusChange={(status) => statusMutation.mutateAsync(status)}
      onDeleted={async () => {
        await navigate({ to: "/projects" });
        queryClient.removeQueries({ queryKey: ["project", projectId] });
        await queryClient.invalidateQueries({ queryKey: ["my-projects"] });
      }}
    />
  );
}
