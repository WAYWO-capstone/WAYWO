import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useState, type SubmitEvent } from "react";
import { CategorySelector } from "@/components/projects/category-selector";
import { TagInput } from "@/components/projects/tag-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, createProject, getProjectCategories, publishProject, saveProjectDraft } from "@/lib/api";
import { isAuthenticated } from "@/lib/token-store";

export const Route = createFileRoute("/create-project")({
  beforeLoad: () => {
    if (!isAuthenticated()) throw redirect({ to: "/login", search: { redirect: "/create-project" } });
  },
  component: CreateProjectPage,
});

function requestError(error: Error) {
  if (error instanceof ApiError && error.status === 401) return "Your session has expired. Please log in again.";
  if (error instanceof ApiError && error.status === 422) return "Check the project details and category, then try again.";
  if (error instanceof TypeError) return "Can't reach the server. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

function CreateProjectPage() {
  const navigate = useNavigate();
  const categories = useQuery({ queryKey: ["project-categories"], queryFn: getProjectCategories });
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setDraftSaved(false);
    if (!categoryId) {
      setError("Choose a category for your project.");
      return;
    }
    const intent = (event.submitter as HTMLButtonElement | null)?.value;
    const shouldPublish = intent === "publish";
    setSaving(shouldPublish ? "publish" : "draft");
    try {
      const projectData = { title, summary, description, category_id: categoryId, tags };
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
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.92fr)] lg:gap-14">
          <div className="space-y-6">
            <div>
              <label htmlFor="project-title" className="mb-2 block text-sm font-semibold">Project title <span className="text-primary">*</span></label>
              <Input id="project-title" required maxLength={200} placeholder="Give your project a name" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div>
              <label htmlFor="project-summary" className="mb-2 block text-sm font-semibold">Summary <span className="text-primary">*</span></label>
              <Input id="project-summary" required maxLength={500} placeholder="What are you making?" value={summary} onChange={(event) => setSummary(event.target.value)} />
            </div>
            <div>
              <label htmlFor="project-description" className="mb-2 block text-sm font-semibold">Description <span className="text-primary">*</span></label>
              <textarea id="project-description" required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe your goals, process, and plans..." className="min-h-52 w-full resize-y rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25" />
            </div>
          </div>

          <aside className="h-fit space-y-6 rounded-xl border bg-card p-5">
            {categories.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading categories...</p>
            ) : categories.isError ? (
              <div role="alert" className="text-sm text-destructive">Could not load categories. <button type="button" className="underline" onClick={() => void categories.refetch()}>Try again</button></div>
            ) : (
              <CategorySelector categories={categories.data ?? []} value={categoryId} onChange={setCategoryId} />
            )}
            <TagInput tags={tags} onChange={setTags} />
            <p className="text-xs leading-5 text-muted-foreground">Publish your project when you’re ready. You can mark it completed later from the project page.</p>
          </aside>
        </div>

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
