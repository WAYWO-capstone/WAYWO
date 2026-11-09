import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CircleAlert, LoaderCircle, Upload } from "lucide-react";
import { useState, type ReactNode, type SubmitEvent } from "react";
import { UpdateTypePicker } from "@/components/projects/update-type-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createProjectUpdate } from "@/api/updates";
import { useRestoreFocus } from "@/lib/project-form";
import {
  createUpdateRequestError,
  validateNewUpdate,
  type NewUpdateFormValues,
  type UpdateFieldErrors,
} from "@/lib/update-form";

const emptyUpdate: NewUpdateFormValues = { title: "", body: "", type: null };

// Where focus goes when a field is invalid, in the order the fields appear.
const fieldFocusTargets: [keyof UpdateFieldErrors, string][] = [
  ["title", "#update-title"],
  ["type", "input[name='update-type']"],
  ["body", "#update-body"],
];

function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-xs text-destructive">
      <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />{children}
    </p>
  );
}

export function CreateUpdateForm({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [values, setValues] = useState(emptyUpdate);
  // Errors only show once the user has tried to post, then follow their edits.
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState("");
  const [posting, setPosting] = useState(false);
  const rememberFocus = useRestoreFocus(posting);
  const fieldErrors = attempted ? validateNewUpdate(values) : {};

  function change(next: Partial<NewUpdateFormValues>) {
    setValues({ ...values, ...next });
    setError("");
  }

  function backToProject() {
    return navigate({ to: "/view-project", search: { projectId } });
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setAttempted(true);
    const errors = validateNewUpdate(values);
    const firstInvalid = fieldFocusTargets.find(([field]) => errors[field]);
    if (firstInvalid || !values.type) {
      if (firstInvalid) event.currentTarget.querySelector<HTMLElement>(firstInvalid[1])?.focus();
      return;
    }
    rememberFocus();
    setPosting(true);
    try {
      await createProjectUpdate(projectId, { title: values.title.trim(), body: values.body.trim(), type: values.type });
      await queryClient.invalidateQueries({ queryKey: ["project-history", projectId] });
      await backToProject();
    } catch (cause) {
      setError(createUpdateRequestError(cause instanceof Error ? cause : new Error("Request failed")));
      setPosting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 sm:py-10">
      <Link to="/view-project" search={{ projectId }} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />Back to project activity
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Add an update</h1>

      {/* Reason for noValidate is that the browser's bubbles for errors would hide the design's eror messages */}
      <form noValidate onSubmit={(event) => void submit(event)} className="mt-8">
        <fieldset disabled={posting} className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)] lg:gap-14">
          <div className="space-y-6">
            <div>
              <label htmlFor="update-title" className="mb-2 block text-sm font-semibold">Update title <span className="text-primary">*</span></label>
              <Input
                id="update-title"
                required
                maxLength={200}
                value={values.title}
                onChange={(event) => change({ title: event.target.value })}
                aria-invalid={fieldErrors.title ? true : undefined}
                aria-describedby={fieldErrors.title ? "update-title-error" : undefined}
              />
              <FieldError id="update-title-error">{fieldErrors.title}</FieldError>
            </div>

            <UpdateTypePicker
              value={values.type}
              onChange={(type) => change({ type })}
              errorId="update-type-error"
              error={fieldErrors.type && <FieldError id="update-type-error">{fieldErrors.type}</FieldError>}
            />

            <div>
              <label htmlFor="update-body" className="mb-2 block text-sm font-semibold">Detailed content <span className="text-primary">*</span></label>
              <textarea
                id="update-body"
                required
                placeholder="What you did, what you tried, what comes next ..."
                value={values.body}
                onChange={(event) => change({ body: event.target.value })}
                aria-invalid={fieldErrors.body ? true : undefined}
                aria-describedby={fieldErrors.body ? "update-body-error" : undefined}
                className="min-h-60 w-full resize-y rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
              />
              <FieldError id="update-body-error">{fieldErrors.body}</FieldError>
            </div>
          </div>

          {/* Currently no feature for media on updates, so leaving this disabled. */}
          <div>
            <p className="mb-2 block text-sm font-semibold">Attach media</p>
            <div aria-disabled="true" className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-rust/60 px-6 py-10 text-center opacity-60">
              <span className="flex size-9 items-center justify-center rounded-full bg-update-progress text-brand-mahogany">
                <Upload className="size-4" aria-hidden="true" />
              </span>
              <p className="text-sm font-semibold">Drag and drop files here</p>
              <p className="text-xs text-muted-foreground">or</p>
              <Button type="button" variant="outline" size="sm" disabled className="rounded-full">Browse files</Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Attaching photos and files to updates is coming soon.</p>
          </div>
        </fieldset>

        {error && <p role="alert" className="mt-6 flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"><CircleAlert className="size-4 shrink-0" />{error}</p>}
        <div className="mt-8 flex flex-col-reverse items-stretch justify-end gap-3 border-t border-brand-rust/40 pt-5 sm:flex-row sm:items-center sm:gap-4">
          <Button type="button" variant="ghost" disabled={posting} onClick={() => void backToProject()} className="h-11 px-5">Cancel</Button>
          <Button type="submit" disabled={posting} className="h-11 px-7 font-semibold">
            {posting ? <><LoaderCircle className="size-4 animate-spin" />Posting...</> : "Post update"}
          </Button>
        </div>
      </form>
    </div>
  );
}
