import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { EditProjectForm } from "@/components/projects/edit-project-form";
import { useCurrentProfile } from "@/lib/auth";
import { ApiError } from "@/api/client";
import { getProject } from "@/api/projects";
import { isAuthenticated } from "@/lib/token-store";

export const Route = createFileRoute("/edit-project")({
  validateSearch: (search: Record<string, unknown>) => ({
    projectId: typeof search.projectId === "string" ? search.projectId : "",
  }),
  beforeLoad: ({ search }) => {
    if (!isAuthenticated()) {
      throw redirect({ to: "/login", search: { redirect: `/edit-project?projectId=${search.projectId}` } });
    }
  },
  component: EditProjectPage,
});

function EditProjectPage() {
  const { projectId } = Route.useSearch();
  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    enabled: Boolean(projectId),
  });
  const profileQuery = useCurrentProfile();

  if (projectQuery.isLoading || profileQuery.isLoading) {
    return <div className="flex flex-1 items-center justify-center gap-2 py-20 text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />Loading project...</div>;
  }

  const project = projectQuery.data;
  const isOwner = Boolean(project && profileQuery.data?.username === project.author.username);
  if (!project || !isOwner) {
    const status = projectQuery.error instanceof ApiError ? projectQuery.error.status : undefined;
    const message = !projectId || status === 404
      ? "This project was not found or you do not have access to it."
      : status === 401
        ? "Your session has expired. Log in again to edit this project."
        : project
          ? "You can only edit your own projects."
          : "Could not load this project. Check your connection and try again.";

    return <div role="alert" className="mx-auto flex w-full max-w-7xl items-center gap-2 px-6 py-16 text-destructive"><CircleAlert className="size-5" />{message}</div>;
  }

  return <EditProjectForm key={project.id} project={project} />;
}
