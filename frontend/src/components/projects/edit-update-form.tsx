import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Calendar, LoaderCircle } from "lucide-react";
import { useState, type SubmitEvent } from "react";
import { UpdateFormLayout } from "@/components/projects/update-form-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectUpdate, ProjectView } from "@/api/models";
import { updateProjectUpdate } from "@/api/updates";
import { useRestoreFocus } from "@/lib/project-form";
import { statusClasses, statusLabel } from "@/lib/project-status";
import {
  focusFirstInvalidField,
  toUpdateFormValues,
  updateChanges,
  updateRequestError,
  validateUpdate,
} from "@/lib/update-form";

interface EditUpdateFormProps {
  project: Pick<ProjectView, "id" | "title" | "summary" | "status">;
  update: ProjectUpdate;
}

export function EditUpdateForm({ project, update }: EditUpdateFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(() => toUpdateFormValues(update));
  const [values, setValues] = useState(saved);
  // Errors only show once the user has tried to save, then follow their edits.
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState(false);
  const [saving, setSaving] = useState<"save" | "close" | null>(null);
  const rememberFocus = useRestoreFocus(saving !== null);
  const changes = updateChanges(saved, values);
  const hasChanges = Object.keys(changes).length > 0;
  const fieldErrors = attempted ? validateUpdate(values) : {};

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
    setAttempted(true);
    if (focusFirstInvalidField(event.currentTarget, validateUpdate(values))) return;
    rememberFocus();
    setSaving(shouldClose ? "close" : "save");
    try {
      const result = await updateProjectUpdate(project.id, update.id, changes);
      const next = toUpdateFormValues(result);
      setSaved(next);
      setValues(next);
      setAttempted(false);
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
    <UpdateFormLayout
      projectId={project.id}
      heading="Edit update"
      description="Make changes to this update in your project’s Activity timeline."
      values={values}
      fieldErrors={fieldErrors}
      busy={saving !== null}
      error={error}
      onChange={change}
      onSubmit={(event) => void submit(event)}
      onCancel={() => void backToProject()}
      sidebar={
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
      }
      status={savedMessage && !hasChanges && <p role="status" className="mt-6 text-sm text-muted-foreground">Changes saved.</p>}
      actions={
        <>
          <Button type="submit" name="intent" value="close" variant="outline" disabled={saving !== null || !hasChanges} className="h-11 px-5">{saving === "close" ? <><LoaderCircle className="size-4 animate-spin" />Saving...</> : "Save & close"}</Button>
          <Button type="submit" name="intent" value="save" disabled={saving !== null || !hasChanges} className="h-11 px-7 font-semibold">{saving === "save" ? <><LoaderCircle className="size-4 animate-spin" />Saving...</> : "Save changes"}</Button>
        </>
      }
    />
  );
}
