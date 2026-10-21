import { Link, useNavigate } from "@tanstack/react-router";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useState, type SubmitEvent } from "react";
import { ProjectFormFields } from "@/components/projects/project-form-fields";
import { Button } from "@/components/ui/button";
import {
  createProject,
  publishProject,
  saveProjectDraft,
  type ProjectInput,
} from "@/lib/api";
import { requestError, useProjectCategories, useRestoreFocus } from "@/lib/project-form";

export function CreateProjectForm() {
  const navigate = useNavigate();
  const categories = useProjectCategories();
  const [projectData, setProjectData] = useState<ProjectInput>({ title: "", summary: "", description: "", category_id: "", tags: [] });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const rememberFocus = useRestoreFocus(saving !== null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setDraftSaved(false);
    if (!projectData.category_id) {
      setError("Choose a category for your project.");
      return;
    }
    const intent = (event.submitter as HTMLButtonElement | null)?.value;
    const shouldPublish = intent === "publish";
    rememberFocus();
    setSaving(shouldPublish ? "publish" : "draft");
    try {
      const project = draftId
        ? await saveProjectDraft(draftId, projectData)
        : await createProject(projectData);
      setDraftId(project.id);

      if (shouldPublish) {
        await publishProject(project.id);
        await navigate({ to: "/view-project", search: { projectId: project.id } });
      } else {
        setDraftSaved(true);
      }
    } catch (cause) {
      setError(requestError(cause instanceof Error ? cause : new Error("Request failed")));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 sm:py-10">
      <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Create a project</h1>
      <form onSubmit={(event) => void submit(event)} onChange={() => setDraftSaved(false)} className="mt-8">
        <ProjectFormFields
          value={projectData}
          onChange={setProjectData}
          categories={categories}
          disabled={saving !== null}
          hint="Publish your project when you’re ready. You can mark it completed later from the project page."
        />

        {error && <p role="alert" className="mt-6 flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"><CircleAlert className="size-4 shrink-0" />{error}</p>}
        {draftSaved && <p role="status" className="mt-6 text-sm text-muted-foreground">Draft saved privately. <Link to="/view-project" search={{ projectId: draftId! }} className="font-semibold text-primary underline">View draft</Link> or keep editing and save again.</p>}
        <div className="mt-8 flex flex-col-reverse items-stretch justify-end gap-3 border-t pt-5 sm:flex-row sm:items-center sm:gap-4">
          <Button type="button" variant="ghost" disabled={saving !== null} onClick={() => void navigate({ to: "/projects" })} className="h-11 px-5">Cancel</Button>
          <Button type="submit" name="intent" value="draft" variant="outline" disabled={saving !== null || categories.isLoading || categories.isError} className="h-11 px-5">{saving === "draft" ? <><LoaderCircle className="size-4 animate-spin" />Saving...</> : "Save as draft"}</Button>
          <Button type="submit" name="intent" value="publish" disabled={saving !== null || categories.isLoading || categories.isError} className="h-11 px-7 font-semibold">{saving === "publish" ? <><LoaderCircle className="size-4 animate-spin" />Publishing...</> : "Publish"}</Button>
        </div>
      </form>
    </div>
  );
}
