import { useQueryClient } from "@tanstack/react-query";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useState, type SubmitEvent } from "react";
import { AutosaveIndicator, RestoredChangesNotice } from "@/components/projects/autosave-indicator";
import { ProjectDiscardDialog } from "@/components/projects/project-discard-changes-dialog";
import { ProjectFormFields } from "@/components/projects/project-form-fields";
import { Button } from "@/components/ui/button";
import { deleteProject, publishProject } from "@/api/projects";
import type { ProjectInput, ProjectView } from "@/api/models";
import { useAutosave } from "@/lib/autosave";
import { restorableDraftBackup } from "@/lib/draft-backup";
import {
  autosaveError,
  createProjectAutosave,
  hasRequiredFields,
  markProjectSaved,
} from "@/lib/project-autosave";
import { requestError, useProjectCategories, useRestoreFocus } from "@/lib/project-form";

const emptyProject: ProjectInput = { title: "", summary: "", description: "", category_id: "", tags: [] };

function toProjectInput(project: ProjectView): ProjectInput {
  return {
    title: project.title,
    summary: project.summary,
    description: project.description,
    category_id: project.category.id,
    tags: project.tags.map((tag) => tag.name),
  };
}

export function CreateProjectForm({ project }: { project?: ProjectView }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const categories = useProjectCategories();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [{ autosave, draft, restored }] = useState(() => {
    const draft = { id: project?.id ?? null };
    const initial = project ? toProjectInput(project) : emptyProject;
    const backup = restorableDraftBackup(project?.id ?? null, project ? initial : null, project?.last_autosaved_at ?? null);
    const autosave = createProjectAutosave({
      projectId: project?.id ?? null,
      initial,
      restored: backup?.value,
      lastSavedAt: project?.last_autosaved_at,
      onCreate: (projectId) => {
        draft.id = projectId;
        void navigate({ to: "/create-project", search: { projectId }, replace: true });
      },
      onSave: (projectId) => markProjectSaved(queryClient, projectId),
    });
    return { autosave, draft, restored: backup !== null };
  });
  const blocker = useBlocker({
    shouldBlockFn: ({ action }) => action === "BACK" && (draft.id !== null || autosave.hasUnsavedChanges),
    withResolver: true,
    enableBeforeUnload: false,
  });
  const rememberFocus = useRestoreFocus(saving !== null);
  const [projectData, setProjectData] = useState(() => autosave.value);
  const [showRestored, setShowRestored] = useState(restored);
  const autosaveState = useAutosave(autosave);
  const autosaveFailure = autosaveState?.status === "error" && autosaveState.error ? autosaveError(autosaveState.error) : "";

  function change(next: ProjectInput) {
    setProjectData(next);
    setError("");
    autosave.update(next);
  }

  function discardRestored() {
    autosave.discard();
    setProjectData(autosave.value);
    setShowRestored(false);
  }

  async function confirmCancel() {
    autosave.discard();
    // Wait for an in-flight save, including first draft creation, before deleting.
    await autosave.flush();
    if (draft.id) await deleteProject(draft.id);
    autosave.discard();
    if (blocker.status === "blocked") blocker.reset();
    await navigate({ to: "/projects" });
  }

  function changeDiscardDialog(open: boolean) {
    if (!open && blocker.status === "blocked") blocker.reset();
    setDiscardDialogOpen(open);
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!projectData.category_id) {
      setError("Choose a category for your project.");
      return;
    }
    // Spaces pass the browser's required check but not the backend's.
    if (!hasRequiredFields(projectData)) {
      setError("Fill in the title and summary before saving.");
      return;
    }
    const shouldPublish = (event.submitter as HTMLButtonElement | null)?.value === "publish";
    rememberFocus();
    setSaving(shouldPublish ? "publish" : "draft");
    try {
      if (!(await autosave.flush())) return;
      const projectId = draft.id;
      if (!projectId) return;
      if (!shouldPublish) {
        await navigate({ to: "/projects" });
        return;
      }
      await publishProject(projectId);
      await navigate({ to: "/view-project", search: { projectId } });
    } catch (cause) {
      setError(requestError(cause instanceof Error ? cause : new Error("Request failed")));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 sm:py-10">
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{draft.id ? "Edit your draft" : "Create a project"}</h1>
        {autosaveState && <AutosaveIndicator state={autosaveState} onRetry={() => void autosave.retry()} />}
      </div>
      <form onSubmit={(event) => void submit(event)} className="mt-8">
        <ProjectFormFields
          value={projectData}
          onChange={change}
          categories={categories}
          disabled={saving !== null}
          hint="Your project is saved as a private draft as you write. Publish it when you’re ready. You can mark it completed later from the project page."
        />

        {showRestored && <RestoredChangesNotice onDiscard={discardRestored} />}
        {(error || autosaveFailure) && <p role="alert" className="mt-6 flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"><CircleAlert className="size-4 shrink-0" />{error || autosaveFailure}</p>}
        <div className="mt-8 flex flex-col-reverse items-stretch justify-end gap-3 border-t pt-5 sm:flex-row sm:items-center sm:gap-4">
          <Button type="button" variant="ghost" disabled={saving !== null} onClick={() => setDiscardDialogOpen(true)} className="h-11 px-5">Cancel</Button>
          <ProjectDiscardDialog
            open={discardDialogOpen || blocker.status === "blocked"}
            onOpenChange={changeDiscardDialog}
            onConfirm={confirmCancel}
            deletesDraft
            destination="projects"
          />
          <Button type="submit" name="intent" value="draft" variant="outline" disabled={saving !== null || categories.isLoading || categories.isError} className="h-11 px-5">{saving === "draft" ? <><LoaderCircle className="size-4 animate-spin" />Saving...</> : "Save as draft"}</Button>
          <Button type="submit" name="intent" value="publish" disabled={saving !== null || categories.isLoading || categories.isError} className="h-11 px-7 font-semibold">{saving === "publish" ? <><LoaderCircle className="size-4 animate-spin" />Publishing...</> : "Publish"}</Button>
        </div>
      </form>
    </div>
  );
}
