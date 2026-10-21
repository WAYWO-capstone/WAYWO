import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { AutosaveIndicator, RestoredChangesNotice } from "@/components/projects/autosave-indicator";
import { ProjectFormFields } from "@/components/projects/project-form-fields";
import { Button } from "@/components/ui/button";
import {
  getProject,
  publishProject,
  type ProjectInput,
} from "@/lib/api";
import { useAutosave } from "@/lib/autosave";
import { restorableDraftBackup } from "@/lib/draft-backup";
import {
  autosaveError,
  createProjectAutosave,
  handOffProjectAutosave,
  hasRequiredFields,
  markProjectSaved,
} from "@/lib/project-autosave";
import { requestError, useProjectCategories, useRestoreFocus } from "@/lib/project-form";

const emptyProject: ProjectInput = { title: "", summary: "", description: "", category_id: "", tags: [] };

export function CreateProjectForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const categories = useProjectCategories();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const rememberFocus = useRestoreFocus(saving !== null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  // Set while publishing runs, so creating the draft doesn't send user to edit page.
  const publishing = useRef(false);
  const [{ autosave, draft, restored }] = useState(() => {
    const draft = { id: null as string | null };
    // A project started earlier that never got saved (closed tab, expired session).
    const backup = restorableDraftBackup(null, null, null);
    const autosave = createProjectAutosave({
      projectId: null,
      initial: emptyProject,
      restored: backup?.value,
      onCreate: (projectId) => {
        draft.id = projectId;
        setCreatedId(projectId);
      },
      onSave: (projectId) => markProjectSaved(queryClient, projectId),
    });
    return { autosave, draft, restored: backup !== null };
  });
  const [projectData, setProjectData] = useState(() => autosave.value);
  const [showRestored, setShowRestored] = useState(restored);
  const autosaveState = useAutosave(autosave);
  const autosaveFailure = autosaveState?.status === "error" && autosaveState.error ? autosaveError(autosaveState.error) : "";

  // Once the first autosave has created the draft, keep editing it on the edit page.
  useEffect(() => {
    if (!createdId || publishing.current) return;
    let cancelled = false;
    void (async () => {
      try {
        // Loaded first so the edit page opens without a loading screen.
        await queryClient.fetchQuery({ queryKey: ["project", createdId], queryFn: () => getProject(createdId) });
      } catch {
        // The edit page loads it itself.
      }
      if (cancelled || publishing.current) return;
      handOffProjectAutosave(createdId, autosave);
      await navigate({ to: "/edit-project", search: { projectId: createdId }, replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [autosave, createdId, navigate, queryClient]);

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

  // Leaving without saving: nothing is created from what hasn't been saved yet.
  function cancel() {
    autosave.discard();
    void navigate({ to: "/projects" });
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
    publishing.current = shouldPublish;
    rememberFocus();
    setSaving(shouldPublish ? "publish" : "draft");
    try {
      // Saving the draft opens it on the edit page.
      if (!(await autosave.flush()) || !shouldPublish || !draft.id) return;
      await publishProject(draft.id);
      await navigate({ to: "/view-project", search: { projectId: draft.id } });
    } catch (cause) {
      setError(requestError(cause instanceof Error ? cause : new Error("Request failed")));
    } finally {
      publishing.current = false;
      setSaving(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 sm:py-10">
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Create a project</h1>
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
          <Button type="button" variant="ghost" disabled={saving !== null} onClick={cancel} className="h-11 px-5">Cancel</Button>
          <Button type="submit" name="intent" value="draft" variant="outline" disabled={saving !== null || categories.isLoading || categories.isError} className="h-11 px-5">{saving === "draft" ? <><LoaderCircle className="size-4 animate-spin" />Saving...</> : "Save as draft"}</Button>
          <Button type="submit" name="intent" value="publish" disabled={saving !== null || categories.isLoading || categories.isError} className="h-11 px-7 font-semibold">{saving === "publish" ? <><LoaderCircle className="size-4 animate-spin" />Publishing...</> : "Publish"}</Button>
        </div>
      </form>
    </div>
  );
}
