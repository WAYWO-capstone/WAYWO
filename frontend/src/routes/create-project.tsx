import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { CreateProjectForm } from "@/components/projects/create-project-form";
import { useCurrentProfile } from "@/lib/auth";
import { ApiError } from "@/api/client";
import { getProject } from "@/api/projects";
import { isAuthenticated } from "@/lib/token-store";

export const Route = createFileRoute("/create-project")({
  validateSearch: (search: Record<string, unknown>): { projectId?: string } =>
    typeof search.projectId === "string" ? { projectId: search.projectId } : {},
  beforeLoad: ({ search }) => {
    if (!isAuthenticated()) {
      const destination = search.projectId ? `/create-project?projectId=${encodeURIComponent(search.projectId)}` : "/create-project";
      throw redirect({ to: "/login", search: { redirect: destination } });
    }
  },
  component: CreateProjectPage,
});

function CreateProjectPage() {
  const { projectId } = Route.useSearch();
  // On a reload, the initial ID is available and the saved draft is loaded
  const [resumeId] = useState(projectId ?? null);
  return resumeId ? <ResumeProject projectId={resumeId} /> : <CreateProjectForm />;
}

function ResumeProject({ projectId }: { projectId: string }) {
  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
  });
  const profileQuery = useCurrentProfile();

  if (projectQuery.isPending || profileQuery.isPending) {
    return <div className="flex flex-1 items-center justify-center gap-2 py-20 text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />Loading draft...</div>;
  }

  const project = projectQuery.data;
  const isOwner = Boolean(project && profileQuery.data?.username === project.author.username);
  if (!project || !isOwner || project.status !== "DRAFT" || project.public) {
    const status = projectQuery.error instanceof ApiError ? projectQuery.error.status : undefined;
    const message = !project || status === 404
      ? "This draft was not found or you do not have access to it."
      : project.status !== "DRAFT" || project.public
        ? "This project is no longer a private draft. Open it from your projects page."
        : "You can only resume your own drafts.";
    return <div role="alert" className="mx-auto flex w-full max-w-7xl items-center gap-2 px-6 py-16 text-destructive"><CircleAlert className="size-5" />{message}</div>;
  }

  return <CreateProjectForm key={project.id} project={project} />;
}
