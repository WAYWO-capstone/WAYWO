import { ArrowRight, Check, FolderOpen, ImageOff } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

// Fields used by the project cards.
export interface ProfileProject {
  id: string;
  title: string;
  description: string;
  category: string;
  status: "active" | "completed";
  imageUrl: string | null;
  imagePosition?: string;
  createdAt: string;
  href?: string;
}

type Filter = "all" | ProfileProject["status"];
type Sort = "newest" | "oldest";

export function ProfileProjects({ projects }: {
  projects: readonly ProfileProject[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const resultsId = useId();
  // Keep tab counts based on the full list.
  const counts = {
    all: projects.length,
    active: projects.filter((p) => p.status === "active").length,
    completed: projects.filter((p) => p.status === "completed").length,
  };
  // Filter first so sorting leaves the original list alone.
  const visible = projects
    .filter((p) => filter === "all" || p.status === filter)
    .sort((a, b) => {
      const difference = (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0);
      return sort === "newest" ? difference : -difference;
    });

  return (
    <section aria-labelledby="projects-heading" className="mt-7">
      <h2 id="projects-heading" className="text-2xl font-bold tracking-tight">Projects</h2>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b">
        <div role="group" aria-label="Filter projects" className="flex gap-4 sm:gap-8">
          {([
            ["all", "All projects"], ["active", "Active"], ["completed", "Completed"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              aria-controls={resultsId}
              onClick={() => setFilter(value)}
              className={cn(
                "-mb-px flex min-h-11 items-center gap-1.5 border-b-2 border-transparent pb-2 text-sm outline-none hover:text-brand-rust focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring sm:gap-2 sm:text-base",
                filter === value && "border-primary font-bold",
              )}
            >
              {label}
              <span className="min-w-7 rounded-full bg-[#f5e4cf] px-2 py-0.5 text-center text-sm text-brand-mahogany">
                {counts[value]}
              </span>
            </button>
          ))}
        </div>
        <label className="mb-2 ml-auto text-sm text-muted-foreground">
          <span className="sr-only">Sort projects</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            className="min-h-9 rounded-md border bg-background py-1.5 pr-3 pl-2 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>
      <div id={resultsId} className="pt-6">
        <p role="status" className="sr-only">{visible.length} {filter === "all" ? "" : `${filter} `}projects shown.</p>
        {visible.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((project) => <ProjectCard key={project.id} project={project} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed px-6 py-16 text-center">
            <FolderOpen aria-hidden="true" className="mx-auto size-9 text-brand-rust/70" />
            <p className="mt-4 font-semibold">
              {filter === "all" ? "No projects yet" : `No ${filter} projects yet`}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Check back later to see what this creator is making.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function ProjectCard({ project }: { project: ProfileProject }) {
  const [imageFailed, setImageFailed] = useState(false);
  const completed = project.status === "completed";
  const content = (
    <>
      <div className="flex aspect-[2.7/1] items-center justify-center overflow-hidden bg-[#f3eadf]">
        {project.imageUrl && !imageFailed ? (
          <img src={project.imageUrl} alt="" loading="lazy" style={{ objectPosition: project.imagePosition }} onError={() => setImageFailed(true)} className="h-full w-full object-cover transition-transform duration-200 motion-safe:group-hover:scale-105" />
        ) : <ImageOff aria-hidden="true" className="size-8 text-muted-foreground/60" />}
      </div>
      <div className="p-3.5">
        <p className="text-xs text-brand-rust">{project.category}</p>
        <h3 className="mt-1 text-base leading-snug font-bold">{project.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-foreground/85">{project.description}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", completed ? "bg-[#f5e4cf] text-[#674832]" : "bg-[#d0ebb9] text-[#244b15]")}>
            {completed ? <Check aria-hidden="true" className="size-3.5" /> : <span aria-hidden="true" className="size-1.5 rounded-full bg-[#65a834]" />}
            {completed ? "Completed" : "Active"}
          </span>
          <ArrowRight aria-hidden="true" className="size-4 text-primary" />
        </div>
      </div>
    </>
  );
  return (
    <article className="group overflow-hidden rounded-xl border bg-card">
      {project.href ? <a href={project.href} className="block h-full outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset">{content}</a> : content}
    </article>
  );
}
