import { Pencil } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useUpdateProfile } from "@/lib/profile-editing";

export function BioEditor({ bio }: { bio: string | null }) {
  const saveBio = useUpdateProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bio ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  function finishEditing() {
    setEditing(false);
    requestAnimationFrame(() => editButtonRef.current?.focus());
  }

  function startEditing() {
    setDraft(bio ?? "");
    saveBio.reset();
    setEditing(true);
    textareaRef.current?.focus();
  }

  function cancelEditing() {
    setDraft(bio ?? "");
    saveBio.reset();
    finishEditing();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editing || saveBio.isPending || draft === (bio ?? "")) return;

    // an empty field clears the saved bio
    saveBio.mutate(
      { bio: draft === "" ? null : draft },
      { onSuccess: finishEditing },
    );
  }

  const errorMessage =
    saveBio.error instanceof ApiError && saveBio.error.status === 401
      ? "Please log out and log in again before saving."
      : "Your bio could not be saved. Please try again.";

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={saveBio.isPending}
      className="mt-8 w-full max-w-xl"
    >
      <label
        htmlFor="profile-bio"
        className="mb-1.5 block text-sm font-semibold"
      >
        About me
      </label>

      <div className="flex items-start gap-1">
        <textarea
          ref={textareaRef}
          id="profile-bio"
          value={editing ? draft : bio ?? ""}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Tell us a little about yourself."
          readOnly={!editing}
          disabled={saveBio.isPending}
          maxLength={500}
          rows={1}
          aria-describedby={
            saveBio.isError
              ? "profile-bio-error"
              : editing
                ? "profile-bio-count"
                : undefined
          }
          className={`field-sizing-content min-h-10 w-full min-w-0 resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60 ${
  editing
    ? "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
    : ""
}`}
        />

        {!editing && (
          <button
            ref={editButtonRef}
            type="button"
            onClick={startEditing}
            aria-label="Edit about me"
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-brand-mahogany outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Pencil aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            disabled={saveBio.isPending || draft === (bio ?? "")}
            className="h-9 px-4"
          >
            {saveBio.isPending ? "Saving…" : "Save"}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={cancelEditing}
            disabled={saveBio.isPending}
            className="h-9 px-4"
          >
            Cancel
          </Button>

          <span
            id="profile-bio-count"
            className="ml-auto text-xs text-muted-foreground"
          >
            {draft.length}/500
          </span>
        </div>
      )}

      {saveBio.isError && (
        <p
          id="profile-bio-error"
          role="alert"
          className="mt-2 text-sm text-destructive"
        >
          {errorMessage}
        </p>
      )}

      {!editing && saveBio.isSuccess && (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          Bio saved
        </p>
      )}
    </form>
  );
}