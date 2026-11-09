import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { CreateUpdateForm } from "@/components/projects/create-update-form";
import { ApiError } from "@/api/client";
import { getProject } from "@/api/projects";
import { isAuthenticated } from "@/lib/token-store";

export const Route = createFileRoute("/add-update")({
  validateSearch: (search: Record<string, unknown>) => ({
    projectId: typeof search.projectId === "string" ? search.projectId : "",
  }),
  beforeLoad: ({ search }) => {
    if (!isAuthenticated()) {
      throw redirect({ to: "/login", search: { redirect: `/add-update?projectId=${search.projectId}` } });
    }
  },
  component: AddUpdatePage,
});

function AddUpdatePage() {
  const { projectId } = Route.useSearch();
  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    enabled: Boolean(projectId),
  });

  if (projectQuery.isLoading) {
    return <div className="flex flex-1 items-center justify-center gap-2 py-20 text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />Loading project...</div>;
  }

  const project = projectQuery.data;
  if (!project || !project.is_owner) {
    const status = projectQuery.error instanceof ApiError ? projectQuery.error.status : undefined;
    const message = !projectId || status === 404
      ? "This project was not found or you do not have access to it."
      : status === 401
        ? "Your session has expired. Log in again to add an update."
        : project
          ? "You can only add updates to your own projects."
          : "Could not load this project. Check your connection and try again.";

    return <div role="alert" className="mx-auto flex w-full max-w-7xl items-center gap-2 px-6 py-16 text-destructive"><CircleAlert className="size-5" />{message}</div>;
  }

  return <CreateUpdateForm projectId={project.id} />;
}
