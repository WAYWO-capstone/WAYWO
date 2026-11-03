import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Calendar, Check, CircleAlert, LoaderCircle } from "lucide-react";
import { useState, type SubmitEvent } from "react";
import { updateTypeStyles } from "@/components/projects/update-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectUpdate, ProjectView, UpdateType } from "@/api/models";
import { updateProjectUpdate } from "@/api/updates";
import { useRestoreFocus } from "@/lib/project-form";
import { statusClasses, statusLabel } from "@/lib/project-status";
import {
  hasRequiredUpdateFields,
  toUpdateFormValues,
  updateChanges,
  updateRequestError,
} from "@/lib/update-form";

interface EditUpdateFormProps {
  project: Pick<ProjectView, "id" | "title" | "summary" | "status">;
  update: ProjectUpdate;
}

const updateTypes = Object.keys(updateTypeStyles) as UpdateType[];

export function EditUpdateForm({ project, update }: EditUpdateFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(() => toUpdateFormValues(update));
  const [values, setValues] = useState(saved);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState(false);
  const [saving, setSaving] = useState<"save" | "close" | null>(null);
  const rememberFocus = useRestoreFocus(saving !== null);
  const changes = updateChanges(saved, values);
  const hasChanges = Object.keys(changes).length > 0;

  function change(next: Partial<typeof values>) {
    setValues({ ...values, ...next });
    setError("");
    setSavedMessage(false);
  }

  function backToProject() {
    return navigate({ to: "/view-project", search: { projectId: project.id } });
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const shouldClose = (event.nativeEvent.submitter as HTMLButtonElement | null)?.value === "close";
    // Spaces pass the browser's required check.
    if (!hasRequiredUpdateFields(values)) {
      setError("Fill in the title and content before saving.");
      return;
    }
    rememberFocus();
    setSaving(shouldClose ? "close" : "save");
    try {
      const result = await updateProjectUpdate(project.id, update.id, changes);
      const next = toUpdateFormValues(result);
      setSaved(next);
      setValues(next);
      setSavedMessage(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project-history", project.id] }),
        queryClient.invalidateQueries({ queryKey: ["project-update", project.id, update.id] }),
      ]);
      if (shouldClose) await backToProject();
    } catch (cause) {
      setError(updateRequestError(cause instanceof Error ? cause : new Error("Request failed")));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 sm:py-10">
      <Link to="/view-project" search={{ projectId: project.id }} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />Back to project activity
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Edit update</h1>
      <p className="mt-2 text-sm text-muted-foreground">Make changes to this update in your project’s Activity timeline.</p>

      <form onSubmit={(event) => void submit(event)} className="mt-8">
        <fieldset disabled={saving !== null} className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)] lg:gap-14">
          <div className="space-y-6">
            <div>
              <label htmlFor="update-title" className="mb-2 block text-sm font-semibold">Update title <span className="text-primary">*</span></label>
              <Input id="update-title" required maxLength={200} value={values.title} onChange={(event) => change({ title: event.target.value })} />
            </div>

            <fieldset>
              <legend className="mb-2 block text-sm font-semibold">Update type <span className="text-primary">*</span></legend>
              <div className="flex flex-wrap gap-3">
                {updateTypes.map((type) => {
                  const selected = values.type === type;
                  return (
                    <label key={type} className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-sm font-semibold text-brand-mahogany focus-within:ring-3 focus-within:ring-ring/50 ${updateTypeStyles[type].className} ${selected ? "border-brand-garnet" : "border-transparent"}`}>
                      <input type="radio" name="update-type" value={type} checked={selected} onChange={() => change({ type })} className="sr-only" />
                      <span aria-hidden="true" className={`flex size-4 items-center justify-center rounded-full border border-brand-mahogany ${selected ? "bg-brand-garnet text-white" : "bg-white"}`}>
                        {selected && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      {updateTypeStyles[type].label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label htmlFor="update-body" className="mb-2 block text-sm font-semibold">Detailed content <span className="text-primary">*</span></label>
              <textarea id="update-body" required value={values.body} onChange={(event) => change({ body: event.target.value })} className="min-h-60 w-full resize-y rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50" />
            </div>
          </div>

          <aside className="h-fit rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Project</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(project.status)}`}>{statusLabel(project.status)}</span>
            </div>
            <p className="mt-3 text-lg font-bold text-brand-garnet">{project.title}</p>
            <p className="mt-2 text-sm text-muted-foreground">{project.summary}</p>

            <div className="mt-5 border-t pt-5">
              <label htmlFor="update-date" className="mb-2 block text-sm font-semibold">Date</label>
              <div className="relative">
                <Input
                  id="update-date"
                  disabled
                  value={new Date(update.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                  aria-describedby="update-date-hint"
                  className="pr-10"
                />
                <Calendar className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              </div>
              <p id="update-date-hint" className="mt-2 text-xs leading-5 text-muted-foreground">
                This date determines where the update appears in your project timeline.
              </p>
            </div>
          </aside>
        </fieldset>

        {error && <p role="alert" className="mt-6 flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"><CircleAlert className="size-4 shrink-0" />{error}</p>}
        {savedMessage && !hasChanges && <p role="status" className="mt-6 text-sm text-muted-foreground">Changes saved.</p>}
        <div className="mt-8 flex flex-col-reverse items-stretch justify-end gap-3 border-t pt-5 sm:flex-row sm:items-center sm:gap-4">
          <Button type="button" variant="ghost" disabled={saving !== null} onClick={() => void backToProject()} className="h-11 px-5">Cancel</Button>
          <Button type="submit" name="intent" value="close" variant="outline" disabled={saving !== null || !hasChanges} className="h-11 px-5">{saving === "close" ? <><LoaderCircle className="size-4 animate-spin" />Saving...</> : "Save & close"}</Button>
          <Button type="submit" name="intent" value="save" disabled={saving !== null || !hasChanges} className="h-11 px-7 font-semibold">{saving === "save" ? <><LoaderCircle className="size-4 animate-spin" />Saving...</> : "Save changes"}</Button>
        </div>
      </form>
    </div>
  );
}
