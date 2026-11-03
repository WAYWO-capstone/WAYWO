import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { EditUpdateForm } from "@/components/projects/edit-update-form";
import { ApiError, getProject, getProjectUpdate } from "@/lib/api";
import { isAuthenticated } from "@/lib/token-store";

export const Route = createFileRoute("/edit-update")({
  validateSearch: (search: Record<string, unknown>) => ({
    projectId: typeof search.projectId === "string" ? search.projectId : "",
    updateId: typeof search.updateId === "string" ? search.updateId : "",
  }),
  beforeLoad: ({ search }) => {
    if (!isAuthenticated()) {
      throw redirect({ to: "/login", search: { redirect: `/edit-update?projectId=${search.projectId}&updateId=${search.updateId}` } });
    }
  },
  component: EditUpdatePage,
});

function EditUpdatePage() {
  const { projectId, updateId } = Route.useSearch();
  const enabled = Boolean(projectId && updateId);
  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    enabled,
  });
  const updateQuery = useQuery({
    queryKey: ["project-update", projectId, updateId],
    queryFn: () => getProjectUpdate(projectId, updateId),
    enabled,
  });

  if (projectQuery.isLoading || updateQuery.isLoading) {
    return <div className="flex flex-1 items-center justify-center gap-2 py-20 text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />Loading update...</div>;
  }

  const project = projectQuery.data;
  const update = updateQuery.data;
  if (!project || !update || !project.is_owner) {
    const failure = projectQuery.error ?? updateQuery.error;
    const status = failure instanceof ApiError ? failure.status : undefined;
    const message = !enabled || status === 404
      ? "This update was not found or you do not have access to it."
      : status === 401
        ? "Your session has expired. Log in again to edit this update."
        : project && update
          ? "You can only edit your own updates."
          : "Could not load this update. Check your connection and try again.";

    return <div role="alert" className="mx-auto flex w-full max-w-7xl items-center gap-2 px-6 py-16 text-destructive"><CircleAlert className="size-5" />{message}</div>;
  }

  return <EditUpdateForm key={update.id} project={project} update={update} />;
}
