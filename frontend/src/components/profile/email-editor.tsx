import { Eye, EyeOff, Pencil } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/api/client";
import { useUpdateEmail } from "@/lib/profile-editing";

export function EmailEditor({ email }: { email: string }) {
  const saveEmail = useUpdateEmail();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(email);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const { isSuccess, reset } = saveEmail;
  const nextEmail = draft.trim();
  const unchanged = nextEmail.toLowerCase() === email.toLowerCase();

  useEffect(() => {
    if (!isSuccess) return;

    // hide the saved message after three seconds
    const timer = window.setTimeout(reset, 3000);
    return () => window.clearTimeout(timer);
  }, [isSuccess, reset]);

  function startEditing() {
    setDraft(email);
    setPassword("");
    setShowPassword(false);
    reset();
    setEditing(true);
    requestAnimationFrame(() => emailRef.current?.focus());
  }

  function finishEditing() {
    setEditing(false);
    setPassword("");
    setShowPassword(false);
    requestAnimationFrame(() => editButtonRef.current?.focus());
  }

  function cancelEditing() {
    setDraft(email);
    reset();
    finishEditing();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editing || saveEmail.isPending || unchanged || !password) return;

    saveEmail.mutate(
      { email: nextEmail, current_password: password },
      { onSuccess: finishEditing },
    );
  }

  const status =
    saveEmail.error instanceof ApiError ? saveEmail.error.status : null;

  const errorMessage =
    status === 400
      ? "Your password is incorrect."
      : status === 409
        ? "This email address is already in use."
        : status === 401
          ? "Please log out and log in again before saving."
          : status === 422
            ? "Check your email and password and try again."
            : "Your email could not be saved. Please try again.";

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={saveEmail.isPending}
      className="min-w-0 flex-1 basis-48"
    >
      <label
        htmlFor="profile-email"
        className="mb-1.5 block text-sm font-semibold"
      >
        Email
      </label>

      <div className="flex items-center gap-1">
        <Input
          ref={emailRef}
          id="profile-email"
          name="email"
          type="email"
          autoComplete="email"
          value={editing ? draft : email}
          onChange={(event) => setDraft(event.target.value)}
          readOnly={!editing}
          disabled={saveEmail.isPending}
          required
          minLength={3}
          maxLength={255}
          aria-describedby={
            saveEmail.isError ? "profile-email-error" : undefined
          }
          className={`h-10 rounded-xl px-3 text-sm ${editing ? "" : "focus-visible:border-input focus-visible:ring-0"}`}
        />

        {!editing && (
          <button
            ref={editButtonRef}
            type="button"
            onClick={startEditing}
            aria-label="Edit email"
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-brand-mahogany outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Pencil aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 space-y-3">
          <div>
            <label
              htmlFor="profile-email-password"
              className="mb-1.5 block text-sm font-semibold"
            >
              Password
            </label>

            <div className="relative">
              <Input
                id="profile-email-password"
                name="current_password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={saveEmail.isPending}
                required
                maxLength={128}
                aria-describedby={
                  saveEmail.isError ? "profile-email-error" : undefined
                }
                className="h-11 rounded-xl pr-14 pl-3 text-sm"
              />

              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                disabled={saveEmail.isPending}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-controls="profile-email-password"
                title={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-xl text-brand-mahogany outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" className="size-5" />
                ) : (
                  <Eye aria-hidden="true" className="size-5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={saveEmail.isPending || unchanged || !password}
              className="h-9 px-4"
            >
              {saveEmail.isPending ? "Saving…" : "Save"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={cancelEditing}
              disabled={saveEmail.isPending}
              className="h-9 px-4"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {saveEmail.isError && (
        <p
          id="profile-email-error"
          role="alert"
          className="mt-2 text-sm text-destructive"
        >
          {errorMessage}
        </p>
      )}

      {!editing && isSuccess && (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          Email saved
        </p>
      )}
    </form>
  );
}
