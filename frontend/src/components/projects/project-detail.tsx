import { Link } from "@tanstack/react-router";
import { Bell, Bookmark, Pencil } from "lucide-react";
import { DeleteProjectDialog } from "@/components/projects/delete-project-dialog";
import { ProjectStatusControl } from "@/components/projects/project-status-control";
import type { ProjectView } from "@/lib/api";

interface ProjectDetailProps {
  project: ProjectView;
  isPreview: boolean;
  isOwner: boolean;
  isSavingStatus: boolean;
  statusUpdateFailed: boolean;
  onStatusChange: (status: ProjectView["status"]) => Promise<void>;
  onDeleted: () => Promise<void>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ProjectDetail({
  project,
  isPreview,
  isOwner,
  isSavingStatus,
  statusUpdateFailed,
  onStatusChange,
  onDeleted,
}: ProjectDetailProps) {
  return (
    <div className="flex-1 bg-white">
      <div className="relative flex h-36 items-center justify-center bg-[#f8ede1] text-sm text-brand-mahogany/80 sm:h-44">
        <span>[project banner image]</span>
        {isPreview && <span className="absolute top-3 right-4 rounded-full bg-white/80 px-3 py-1 text-xs font-medium">Sample preview</span>}
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
              <ProjectStatusControl
                status={project.status}
                isOwner={isOwner}
                isSaving={isSavingStatus}
                hasError={statusUpdateFailed}
                onChange={onStatusChange}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 sm:pr-2">
            {isOwner && (
              <Link to="/edit-project" search={{ projectId: project.id }} className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50">
                <Pencil className="size-4" aria-hidden="true" />Edit project
              </Link>
            )}
            {isOwner && <DeleteProjectDialog project={project} onDeleted={onDeleted} />}
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
