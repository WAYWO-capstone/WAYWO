import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Bookmark, CircleAlert, LoaderCircle } from "lucide-react";
import { getProject, type ProjectView } from "@/lib/api";

const previewProject: ProjectView = {
  id: "preview-project",
  author_id: "preview-author",
  title: "Handmade Crochet Tote Bag",
  summary: "A sturdy everyday bag made from recycled cotton yarn.",
  description: "This sample project shows how the project details appear here. I designed a simple tote shape, tested a few stitch patterns, and chose recycled cotton yarn for durability.",
  status: "ACTIVE",
  public: true,
  category: { id: "preview-category", name: "Crochet", description: "Crochet projects" },
  tags: [
    { id: "preview-tag-1", name: "crochet" },
    { id: "preview-tag-2", name: "handmade" },
  ],
  created_at: "2026-05-12T12:00:00Z",
  last_autosaved_at: null,
  published_at: "2026-05-13T12:00:00Z",
  completed_at: null,
  author: { username: "Anna Ji", profile_picture_link: null },
};

export const Route = createFileRoute("/view-project")({
  validateSearch: (search: Record<string, unknown>) => ({
    projectId: typeof search.projectId === "string" ? search.projectId : undefined,
  }),
  component: ViewProjectPage,
});

function statusLabel(status: ProjectView["status"]) {
  if (status === "COMPLETED") return "Completed";
  if (status === "DRAFT") return "Draft";
  return "Active";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function ViewProjectPage() {
  const { projectId } = Route.useSearch();
  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId!),
    enabled: Boolean(projectId),
  });
  const project = projectId ? projectQuery.data : previewProject;

  if (projectId && projectQuery.isLoading) {
    return <div className="flex flex-1 items-center justify-center gap-2 py-20 text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />Loading project...</div>;
  }

  if (projectQuery.isError || !project) {
    return <div role="alert" className="mx-auto flex w-full max-w-7xl items-center gap-2 px-6 py-16 text-destructive"><CircleAlert className="size-5" />Could not load this project. Check the link and try again.</div>;
  }

  return (
    <div className="flex-1 bg-white">
      <div className="relative flex h-36 items-center justify-center bg-[#f8ede1] text-sm text-brand-mahogany/80 sm:h-44">
        <span>[project banner image]</span>
        {!projectId && <span className="absolute top-3 right-4 rounded-full bg-white/80 px-3 py-1 text-xs font-medium">Sample preview</span>}
      </div>

      <section className="mx-auto max-w-7xl px-5 py-5 sm:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <h1 className="text-3xl font-bold tracking-tight text-brand-mahogany sm:text-4xl">{project.title}</h1>
              <p className="text-lg font-semibold text-brand-garnet">{project.summary}</p>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {project.author.profile_picture_link ? (
                <img src={project.author.profile_picture_link} alt="" className="size-8 rounded-full object-cover" />
              ) : (
                <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-brand-garnet/10 text-xs font-semibold text-brand-garnet">
                  {project.author.username.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="text-sm font-semibold text-brand-garnet">by {project.author.username}</span>
              <span className={`ml-2 rounded-full px-5 py-1.5 text-sm font-medium ${project.status === "ACTIVE" ? "bg-[#c9e9b9] text-[#173d18]" : project.status === "COMPLETED" ? "bg-[#d9e8f1] text-[#173d3e]" : "bg-[#f3e4c7] text-[#604a25]"}`}>
                {statusLabel(project.status)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:pr-2">
            <button type="button" aria-label="Notifications" title="Notifications" className="flex size-11 items-center justify-center rounded-md border border-[#ead7c7] bg-[#fbf0e4] text-brand-mahogany hover:bg-[#f6e4d2]">
              <Bell className="size-5" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Save project" title="Save project" className="flex size-11 items-center justify-center rounded-md border border-[#ead7c7] bg-[#fbf0e4] text-brand-mahogany hover:bg-[#f6e4d2]">
              <Bookmark className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      <nav aria-label="Project sections" className="border-b border-[#d9c8bc]">
        <div className="mx-auto flex max-w-7xl gap-10 px-5 sm:px-8">
          <span aria-current="page" className="border-b-2 border-brand-garnet px-2 py-3 text-base font-semibold text-brand-mahogany">Activity</span>
          <span className="px-2 py-3 text-base font-semibold text-brand-mahogany">Knowledge</span>
          <span className="px-2 py-3 text-base font-semibold text-brand-mahogany">Discussion</span>
        </div>
      </nav>

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-8 sm:px-8 lg:grid-cols-[240px_minmax(0,1fr)_240px] lg:gap-8">
        <aside className="h-fit min-h-[340px] rounded-lg border border-[#eadfd6] bg-[#fffdfa] p-4">
          <h2 className="text-lg font-bold text-brand-mahogany">Description</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">{project.description || "No description provided."}</p>

          <h3 className="mt-7 text-lg font-bold text-brand-mahogany">Details</h3>
          <p className="mt-3 text-sm font-semibold text-brand-garnet">Category: <span className="font-normal">{project.category.name}</span></p>
          <p className="mt-4 text-sm font-semibold text-brand-garnet">Started: <span className="font-normal">{formatDate(project.created_at)}</span></p>

          <h3 className="mt-6 text-lg font-bold text-brand-mahogany">Tags</h3>
          {project.tags.length ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {project.tags.map((tag) => <li key={tag.id} className="rounded-full border border-[#eadfd6] px-3 py-1 text-xs text-brand-mahogany">{tag.name}</li>)}
            </ul>
          ) : <p className="mt-2 text-sm text-muted-foreground">No tags</p>}
        </aside>

        <section aria-labelledby="updates-heading" className="min-h-[420px] rounded-lg border border-[#eadfd6] bg-white p-4">
          <h2 id="updates-heading" className="text-lg font-bold text-brand-mahogany">Updates</h2>
        </section>

        <aside aria-labelledby="resources-heading" className="min-h-[320px] rounded-lg border border-[#eadfd6] bg-white p-4">
          <h2 id="resources-heading" className="text-lg font-bold text-brand-mahogany">Resources</h2>
        </aside>
      </div>
    </div>
  );
}
