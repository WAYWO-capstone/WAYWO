import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CircleAlert, LoaderCircle } from "lucide-react";
import { useEffect, useState, type SubmitEvent } from "react";
import { ProjectFormFields } from "@/components/projects/project-form-fields";
import { Button } from "@/components/ui/button";
import {
  autosaveProject,
  updateProject,
  type ProjectInput,
  type ProjectView,
} from "@/lib/api";
import { requestError, useProjectCategories } from "@/lib/project-form";
import { statusClasses, statusLabel } from "@/lib/project-status";

const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function formatSavedAt(savedAt: string, now: number) {
  const minutes = Math.round((new Date(savedAt).getTime() - now) / 60_000);
  if (minutes > -1) return "just now";
  if (minutes > -60) return relativeTime.format(minutes, "minute");
  if (minutes > -60 * 24) return relativeTime.format(Math.round(minutes / 60), "hour");
  return relativeTime.format(Math.round(minutes / (60 * 24)), "day");
}

function toProjectInput(project: ProjectView): ProjectInput {
  return {
    title: project.title,
    summary: project.summary,
    description: project.description,
    category_id: project.category.id,
    tags: project.tags.map((tag) => tag.name),
  };
}

export function EditProjectForm({ project }: { project: ProjectView }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const categories = useProjectCategories();
  const isDraft = project.status === "DRAFT" && !project.public;
  const [savedData, setSavedData] = useState(() => toProjectInput(project));
  const [projectData, setProjectData] = useState(savedData);
  // Autosave timestamp is only available for drafts, so only show for drafts
  const [savedAt, setSavedAt] = useState(isDraft ? project.last_autosaved_at : null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<"save" | "close" | null>(null);
  const hasChanges = JSON.stringify(projectData) !== JSON.stringify(savedData);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const shouldClose = (event.submitter as HTMLButtonElement | null)?.value === "close";
    setSaving(shouldClose ? "close" : "save");
    try {
      const result = isDraft
        ? await autosaveProject(project.id, projectData)
        : await updateProject(project.id, projectData);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", project.id] }),
        queryClient.invalidateQueries({ queryKey: ["my-projects"] }),
      ]);

      if (shouldClose) {
        await navigate({ to: "/view-project", search: { projectId: project.id } });
      } else {
        setSavedData(projectData);
        setSavedAt(isDraft ? result.last_autosaved_at : new Date().toISOString());
        setNow(Date.now());
      }
    } catch (cause) {
      setError(requestError(cause instanceof Error ? cause : new Error("Request failed")));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 sm:py-10">
      <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />Back to projects
      </Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Edit project</h1>
        <div className="flex items-center gap-4">
          <span className={`rounded-full px-4 py-1.5 text-sm font-semibold ${statusClasses(project.status)}`}>{statusLabel(project.status)}</span>
          {savedAt && <span role="status" className="text-sm text-muted-foreground">Last saved {formatSavedAt(savedAt, now)}</span>}
        </div>
      </div>
      <form onSubmit={(event) => void submit(event)} className="mt-8">
        <ProjectFormFields
          value={projectData}
          onChange={setProjectData}
          categories={categories}
          hint={isDraft
            ? "This project is still a draft. Save your changes here, then publish when you’re ready from the project page."
            : "This project is published. Changes you save here are visible to everyone right away."}
        />

        {error && <p role="alert" className="mt-6 flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"><CircleAlert className="size-4 shrink-0" />{error}</p>}
        <div className="mt-8 flex flex-col-reverse items-stretch justify-end gap-3 border-t pt-5 sm:flex-row sm:items-center sm:gap-4">
          <Button type="button" variant="ghost" disabled={saving !== null} onClick={() => void navigate({ to: "/view-project", search: { projectId: project.id } })} className="h-11 px-5">Cancel</Button>
          <Button type="submit" name="intent" value="close" variant="outline" disabled={saving !== null || !hasChanges || categories.isLoading || categories.isError} className="h-11 px-5">{saving === "close" ? <><LoaderCircle className="size-4 animate-spin" />Saving...</> : "Save & close"}</Button>
          <Button type="submit" name="intent" value="save" disabled={saving !== null || !hasChanges || categories.isLoading || categories.isError} className="h-11 px-7 font-semibold">{saving === "save" ? <><LoaderCircle className="size-4 animate-spin" />Saving...</> : "Save changes"}</Button>
        </div>
      </form>
    </div>
  );
}
