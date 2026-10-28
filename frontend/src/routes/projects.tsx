import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleAlert, FolderOpen, Globe2, LoaderCircle, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, getMyDrafts, getMyPublishedProjects } from "@/lib/api";

export const Route = createFileRoute("/projects")({
  component: ProjectsPage,
});

type ProjectList = "published" | "drafts";

function ProjectsPage() {
  const [list, setList] = useState<ProjectList>("published");
  const projectsQuery = useQuery({
    queryKey: ["my-projects", list],
    queryFn: async () =>
      list === "drafts" ? getMyDrafts() : getMyPublishedProjects(),
  });

  const isUnauthorized = projectsQuery.error instanceof ApiError && projectsQuery.error.status === 401;
  const heading = list === "drafts" ? "Draft projects" : "Published projects";

  return (
    <section className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <Link
          to="/create-project"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Plus aria-hidden="true" className="size-4" /> Create project
        </Link>
      </div>
      <div role="group" aria-label="Choose projects to view" className="mt-8 flex flex-wrap gap-4">
        <Button
          type="button"
          variant={list === "published" ? "default" : "outline"}
          aria-pressed={list === "published"}
          className="h-12 px-5"
          onClick={() => setList("published")}
        >
          <Globe2 aria-hidden="true" /> Published projects
        </Button>
        <Button
          type="button"
          variant={list === "drafts" ? "default" : "outline"}
          aria-pressed={list === "drafts"}
          className="h-12 px-5"
          onClick={() => setList("drafts")}
        >
          <FolderOpen aria-hidden="true" /> Draft projects
        </Button>
      </div>

      <section aria-labelledby="project-list-heading" className="mt-10">
        <h2 id="project-list-heading" className="text-xl font-semibold">{heading}</h2>
        {projectsQuery.isPending ? (
          <div role="status" className="flex items-center gap-2 py-12 text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> Loading projects...
          </div>
        ) : projectsQuery.isError ? (
          <div role="alert" className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-5">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <CircleAlert aria-hidden="true" className="size-5" />
              {isUnauthorized ? "Sign in to view your projects." : "Could not load your projects."}
            </p>
            {isUnauthorized ? (
              <Link to="/login" className="mt-3 inline-block text-sm font-semibold text-primary underline">Go to login</Link>
            ) : (
              <button type="button" onClick={() => void projectsQuery.refetch()} className="mt-3 text-sm font-semibold text-primary underline">Try again</button>
            )}
          </div>
        ) : projectsQuery.data.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed px-6 py-14 text-center">
            <FolderOpen aria-hidden="true" className="mx-auto size-9 text-muted-foreground/70" />
            <p className="mt-4 font-semibold">No {list === "drafts" ? "draft" : "published"} projects yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {list === "drafts" ? "Projects you save as drafts will appear here." : "Projects you publish will appear here."}
            </p>
          </div>
        ) : (
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projectsQuery.data.map((project) => (
              <li key={project.id} className="rounded-xl border bg-card">
                <Link
                  to="/view-project"
                  search={{ projectId: project.id }}
                  aria-label={`View full project: ${project.title}`}
                  className="block rounded-xl p-5 outline-none focus-visible:ring-3 focus-visible:ring-ring"
                >
                  <p className="text-xs font-medium text-muted-foreground">{project.category.name}</p>
                  <h3 className="mt-2 text-lg font-bold">{project.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{project.summary}</p>
                  <p className="mt-4 text-xs font-medium text-brand-rust">
                    {list === "drafts" ? "Draft" : project.status === "COMPLETED" ? "Completed" : "Published"}
                  </p>
                  <span className="mt-4 inline-block text-sm font-semibold text-primary underline underline-offset-4">
                    View full project
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
