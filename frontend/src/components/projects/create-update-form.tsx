import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LoaderCircle, Upload } from "lucide-react";
import { useState, type SubmitEvent } from "react";
import { UpdateFormLayout } from "@/components/projects/update-form-layout";
import { Button } from "@/components/ui/button";
import { createProjectUpdate } from "@/api/updates";
import { useRestoreFocus } from "@/lib/project-form";
import {
  createUpdateRequestError,
  focusFirstInvalidField,
  validateUpdate,
  type NewUpdateFormValues,
} from "@/lib/update-form";

const emptyUpdate: NewUpdateFormValues = { title: "", body: "", type: null };

export function CreateUpdateForm({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [values, setValues] = useState(emptyUpdate);
  // Errors only show once the user has tried to post, then follow their edits.
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState("");
  const [posting, setPosting] = useState(false);
  const rememberFocus = useRestoreFocus(posting);
  const fieldErrors = attempted ? validateUpdate(values) : {};

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
    // TypeScript needs null check to ensure values.type is not null, even if redundant with validateUpdate check.
    if (focusFirstInvalidField(event.currentTarget, validateUpdate(values)) || !values.type) return;
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
    <UpdateFormLayout
      projectId={projectId}
      heading="Add an update"
      values={values}
      fieldErrors={fieldErrors}
      busy={posting}
      error={error}
      onChange={change}
      onSubmit={(event) => void submit(event)}
      onCancel={() => void backToProject()}
      sidebar={
        // Currently no feature for media on updates, so leaving this disabled.
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
      }
      actions={
        <Button type="submit" disabled={posting} className="h-11 px-7 font-semibold">
          {posting ? <><LoaderCircle className="size-4 animate-spin" />Posting...</> : "Post update"}
        </Button>
      }
    />
  );
}
