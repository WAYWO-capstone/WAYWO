import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CircleAlert, LoaderCircle } from "lucide-react";
import { useEffect, useState, type SubmitEvent } from "react";
import { AutosaveIndicator, RestoredChangesNotice } from "@/components/projects/autosave-indicator";
import { ProjectFormFields } from "@/components/projects/project-form-fields";
import { Button } from "@/components/ui/button";
import { updateProject } from "@/api/projects";
import type { ProjectInput, ProjectView } from "@/api/models";
import { useAutosave } from "@/lib/autosave";
import { restorableDraftBackup } from "@/lib/draft-backup";
import {
  autosaveError,
  createProjectAutosave,
  formatSavedAt,
  getHandedOffAutosave,
  hasRequiredFields,
  markProjectSaved,
  releaseHandedOffAutosave,
} from "@/lib/project-autosave";
import { requestError, useProjectCategories, useRestoreFocus } from "@/lib/project-form";
import { statusClasses, statusLabel } from "@/lib/project-status";

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
  // Set when the create page just made this draft and is handing over its autosave.
  const [handoff] = useState(() => getHandedOffAutosave(project.id));
  // Only private drafts can be autosaved
  // published projects are saved by hand
  const [{ autosave, restored }] = useState(() => {
    if (!isDraft) return { autosave: null, restored: false };
    if (handoff) return { autosave: handoff.queue, restored: false };
    const initial = toProjectInput(project);
    // Changes that didn't reach the server last time (closed tab, expired session).
    const backup = restorableDraftBackup(project.id, initial, project.last_autosaved_at);
    const queue = createProjectAutosave({
      projectId: project.id,
      initial,
      restored: backup?.value,
      lastSavedAt: project.last_autosaved_at,
      onSave: (projectId) => markProjectSaved(queryClient, projectId),
    });
    return { autosave: queue, restored: backup !== null };
  });
  // The project page may have loaded before the last save finished, so reload it.
  const autosaveState = useAutosave(autosave, () => {
    void queryClient.invalidateQueries({ queryKey: ["project", project.id] });
    void queryClient.invalidateQueries({ queryKey: ["my-projects"] });
  });
  const [showRestored, setShowRestored] = useState(restored);
  const [savedData, setSavedData] = useState(() => toProjectInput(project));
  const [projectData, setProjectData] = useState(() => autosave?.value ?? savedData);
  // Published projects show when they were saved in this session.
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<"save" | "close" | null>(null);
  const rememberFocus = useRestoreFocus(saving !== null);
  const hasChanges = autosave ? autosave.hasUnsavedChanges : JSON.stringify(projectData) !== JSON.stringify(savedData);
  const autosaveFailure = autosaveState?.status === "error" && autosaveState.error ? autosaveError(autosaveState.error) : "";

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Put the cursor back where it was on the create page.
  useEffect(() => {
    const focus = handoff?.focus;
    const element = focus ? document.getElementById(focus.id) : null;
    if (focus && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      element.focus();
      element.setSelectionRange(focus.start, focus.end);
    }
    return () => releaseHandedOffAutosave(project.id);
  }, [handoff, project.id]);

  function change(next: ProjectInput) {
    setProjectData(next);
    setError("");
    autosave?.update(next);
  }

  function discardRestored() {
    autosave?.discard();
    if (autosave) setProjectData(autosave.value);
    setShowRestored(false);
  }

  // Changes already autosaved stay saved; Cancel drops the ones that aren't yet.
  function cancel() {
    autosave?.discard();
    void navigate({ to: "/view-project", search: { projectId: project.id } });
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const shouldClose = (event.submitter as HTMLButtonElement | null)?.value === "close";
    // Spaces pass the browser's required check but not the backend's.
    if (!hasRequiredFields(projectData)) {
      setError("Fill in the title, summary and category before saving.");
      return;
    }
    rememberFocus();
    setSaving(shouldClose ? "close" : "save");
    try {
      if (autosave) {
        // Saves right away instead of waiting for the next autosave.
        if (!(await autosave.flush())) return;
      } else {
        await updateProject(project.id, projectData);
        setSavedData(projectData);
        setSavedAt(new Date().toISOString());
        setNow(Date.now());
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", project.id] }),
        queryClient.invalidateQueries({ queryKey: ["my-projects"] }),
      ]);

      if (shouldClose) {
        await navigate({ to: "/view-project", search: { projectId: project.id } });
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
          {autosave && autosaveState
            ? <AutosaveIndicator state={autosaveState} onRetry={() => void autosave.retry()} />
            : savedAt && <span role="status" className="text-sm text-muted-foreground">Last saved {formatSavedAt(savedAt, now)}</span>}
        </div>
      </div>
      <form onSubmit={(event) => void submit(event)} className="mt-8">
        <ProjectFormFields
          value={projectData}
          onChange={change}
          categories={categories}
          disabled={saving !== null}
          pendingTag={handoff?.pendingTag}
          hint={isDraft
            ? "This draft saves automatically as you edit it. Publish it when you’re ready from the project page."
            : "This project is published. Changes you save here are visible to everyone right away."}
        />

        {showRestored && <RestoredChangesNotice onDiscard={discardRestored} />}
        {(error || autosaveFailure) && <p role="alert" className="mt-6 flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"><CircleAlert className="size-4 shrink-0" />{error || autosaveFailure}</p>}
        <div className="mt-8 flex flex-col-reverse items-stretch justify-end gap-3 border-t pt-5 sm:flex-row sm:items-center sm:gap-4">
          <Button type="button" variant="ghost" disabled={saving !== null} onClick={cancel} className="h-11 px-5">Cancel</Button>
          <Button type="submit" name="intent" value="close" variant="outline" disabled={saving !== null || (!hasChanges && !autosave) || categories.isLoading || categories.isError} className="h-11 px-5">{saving === "close" ? <><LoaderCircle className="size-4 animate-spin" />Saving...</> : "Save & close"}</Button>
          <Button type="submit" name="intent" value="save" disabled={saving !== null || !hasChanges || categories.isLoading || categories.isError} className="h-11 px-7 font-semibold">{saving === "save" ? <><LoaderCircle className="size-4 animate-spin" />Saving...</> : "Save changes"}</Button>
        </div>
      </form>
    </div>
  );
}
