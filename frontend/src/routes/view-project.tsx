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
import { PartialStatusChangeError, statusChangeError, statusChangeSteps } from "@/lib/project-status";


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
      let published = false;
      try {
        for (const step of statusChangeSteps(project.status, nextStatus)) {
          if (step.type === "publish") {
            await publishProject(projectId);
            published = true;
          } else if (step.type === "unpublish") await unpublishProject(projectId);
          else await updateProjectStatus(projectId, step.status);
        }
      } catch (cause) {
        if (published) throw new PartialStatusChangeError("Published, but the status was not updated", { cause });
        throw cause;
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
      statusError={statusMutation.error ? statusChangeError(statusMutation.error) : null}
      onStatusChange={(status) => statusMutation.mutateAsync(status)}
      onDeleted={async () => {
        await navigate({ to: "/projects" });
        queryClient.removeQueries({ queryKey: ["project", projectId] });
        await queryClient.invalidateQueries({ queryKey: ["my-projects"] });
      }}
    />
  );
}
