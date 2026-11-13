import { Link } from "@tanstack/react-router";
import { ArrowLeft, CircleAlert } from "lucide-react";
import type { ReactNode, SubmitEvent } from "react";
import { UpdateTypePicker } from "@/components/projects/update-type-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NewUpdateFormValues, UpdateFieldErrors, UpdateFormValues } from "@/lib/update-form";

function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-xs text-destructive">
      <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />{children}
    </p>
  );
}

interface UpdateFormLayoutProps {
  projectId: string;
  heading: string;
  description?: string;
  values: NewUpdateFormValues;
  fieldErrors: UpdateFieldErrors;
  // Locks the form while a request is in flight.
  busy: boolean;
  error: string;
  sidebar: ReactNode;
  status?: ReactNode;
  actions: ReactNode;
  onChange: (next: Partial<UpdateFormValues>) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}

// The page shared by the create and edit update forms, so the two can't drift apart.
export function UpdateFormLayout({ projectId, heading, description, values, fieldErrors, busy, error, sidebar, status, actions, onChange, onSubmit, onCancel }: UpdateFormLayoutProps) {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 sm:py-10">
      <Link to="/view-project" search={{ projectId }} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />Back to project activity
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{heading}</h1>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}

      {/* Reason for noValidate is that the browser's bubbles for errors would hide the design's error messages */}
      <form noValidate onSubmit={onSubmit} className="mt-8">
        <fieldset disabled={busy} className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)] lg:gap-14">
          <div className="space-y-6">
            <div>
              <label htmlFor="update-title" className="mb-2 block text-sm font-semibold">Update title <span className="text-primary">*</span></label>
              <Input
                id="update-title"
                required
                maxLength={200}
                value={values.title}
                onChange={(event) => onChange({ title: event.target.value })}
                aria-invalid={fieldErrors.title ? true : undefined}
                aria-describedby={fieldErrors.title ? "update-title-error" : undefined}
              />
              <FieldError id="update-title-error">{fieldErrors.title}</FieldError>
            </div>

            <UpdateTypePicker
              value={values.type}
              onChange={(type) => onChange({ type })}
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
                onChange={(event) => onChange({ body: event.target.value })}
                aria-invalid={fieldErrors.body ? true : undefined}
                aria-describedby={fieldErrors.body ? "update-body-error" : undefined}
                className="min-h-60 w-full resize-y rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
              />
              <FieldError id="update-body-error">{fieldErrors.body}</FieldError>
            </div>
          </div>

          {sidebar}
        </fieldset>

        {error && <p role="alert" className="mt-6 flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"><CircleAlert className="size-4 shrink-0" />{error}</p>}
        {status}
        <div className="mt-8 flex flex-col-reverse items-stretch justify-end gap-3 border-t pt-5 sm:flex-row sm:items-center sm:gap-4">
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel} className="h-11 px-5">Cancel</Button>
          {actions}
        </div>
      </form>
    </div>
  );
}
