import { Eye, EyeOff, LoaderCircle, Pencil } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/api/client";
import {
  useUpdateEmail,
  useUpdatePassword,
  useUpdateProfile,
  useUpdateProfilePicture,
} from "@/lib/profile-editing";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { PasswordInput } from "@/components/ui/password-input";

export function BioEditor({ bio }: { bio: string | null }) {
  const saveBio = useUpdateProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bio ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const { isSuccess, reset } = saveBio;

  useEffect(() => {
    if (!isSuccess) return;

    // hide the saved message after three seconds
    const timer = window.setTimeout(reset, 3000);

    return () => window.clearTimeout(timer);
  }, [isSuccess, reset]);

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
export function ProfilePictureEditor({
  username,
  src,
}: {
  username: string;
  src: string | null;
}) {
  const savePicture = useUpdateProfilePicture();
  const inputRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    // allow choosing the same file again after an error
    event.currentTarget.value = "";
    if (!file || savePicture.isPending) return;

    savePicture.reset();
    setFileError(null);

    if (file.size > 5 * 1024 * 1024) {
      setFileError("Choose an image that is 5 MB or smaller.");
      return;
    }

    if (file.size === 0 || (file.type && !file.type.startsWith("image/"))) {
      setFileError("Please choose an image file.");
      return;
    }

    savePicture.mutate(file, {
      onSettled: () => {
        requestAnimationFrame(() => editButtonRef.current?.focus());
      },
    });
  }

  const status =
    savePicture.error instanceof ApiError
      ? savePicture.error.status
      : null;

  const errorMessage =
    fileError ??
    (savePicture.isError
      ? status === 401
        ? "Please log out and log in again before saving."
        : status === 413
          ? "Choose an image that is 5 MB or smaller."
          : status === 400
            ? "This image could not be used. Please choose another image."
            : "Your picture could not be saved. Please try again."
      : null);

  return (
    <div aria-busy={savePicture.isPending} className="max-w-40 shrink-0">
      <div className="relative w-fit">
        <ProfileAvatar
          username={username}
          src={src}
          className="size-20 text-xl"
        />

        <button
          ref={editButtonRef}
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={savePicture.isPending}
          aria-label="Edit profile picture"
          title="Change profile picture"
          className="absolute right-0 bottom-0 flex size-8 cursor-pointer items-center justify-center rounded-full border-2 border-card bg-brand-garnet text-white outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
        >
          {savePicture.isPending ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin"
            />
          ) : (
            <Pencil aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        aria-label="Choose profile picture"
        onChange={handleFileChange}
        disabled={savePicture.isPending}
        hidden
      />

      {errorMessage && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {errorMessage}
        </p>
      )}

      {savePicture.isPending && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          Uploading…
        </p>
      )}

      {savePicture.isSuccess && !fileError && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          Picture saved
        </p>
      )}
    </div>
  );
}

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


const passwordFields = [
  {
    name: "current_password",
    label: "Old password",
    autoComplete: "current-password",
    minLength: 1,
  },
  {
    name: "new_password",
    label: "New password",
    autoComplete: "new-password",
    minLength: 8,
  },
  {
    name: "confirm_password",
    label: "Confirm new password",
    autoComplete: "new-password",
    minLength: 8,
  },
] as const;

export function PasswordEditor() {
  const savePassword = useUpdatePassword();
  const [passwords, setPasswords] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [validationError, setValidationError] = useState("");
  const [resetCount, setResetCount] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const { isSuccess, reset } = savePassword;

  useEffect(() => {
    if (!isSuccess) return;

    // hide the saved message after three seconds
    const timer = window.setTimeout(reset, 3000);
    return () => window.clearTimeout(timer);
  }, [isSuccess, reset]);

  function clearFields() {
    setPasswords({
      current_password: "",
      new_password: "",
      confirm_password: "",
    });
    setValidationError("");

    // remount the fields so all passwords are hidden again
    setResetCount((count) => count + 1);
    requestAnimationFrame(() => formRef.current?.querySelector("input")?.focus());
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
       if (savePassword.isPending) return;

    const newLength = Array.from(passwords.new_password).length;

    if (Object.values(passwords).some((value) => !value)) {
      setValidationError("Fill in all password fields.");
      return;
    }

    if (newLength < 8) {
      setValidationError("Use at least 8 characters.");
      return;
    }

    if (newLength > 128 || Array.from(passwords.current_password).length > 128) {
      setValidationError("Use 128 characters or fewer.");
      return;
    }

    if (passwords.new_password !== passwords.confirm_password) {
      setValidationError("Passwords do not match.");
      return;
    }

    setValidationError("");

    
    savePassword.mutate(
      {
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      },
      { onSuccess: clearFields },
    );
  }

  const status =
    savePassword.error instanceof ApiError ? savePassword.error.status : null;

  const errorMessage = validationError || (
    savePassword.isError
      ? status === 400
        ? "Your old password is incorrect."
        : status === 401
          ? "Please log out and log in again before saving."
          : status === 422
            ? "Check your passwords and try again."
            : "Your password could not be saved. Please try again."
      : ""
  );

  return (
     <form
      noValidate
      ref={formRef}
      onSubmit={handleSubmit}
      aria-busy={savePassword.isPending}
      className="mt-8 w-full max-w-xs"
    >
      <fieldset disabled={savePassword.isPending} className="space-y-3">
        <legend className="mb-3 text-sm font-semibold">
          Change your password
        </legend>

        <p id="profile-password-help" className="text-xs text-muted-foreground">
          Use a minimum of 8 characters for your new password.
        </p>

       {passwordFields.map((field) => (
  <div key={`${field.name}-${resetCount}`}>
    <label
      htmlFor={`profile-password-${field.name}`}
      className="mb-1.5 block text-sm font-semibold"
    >
      {field.label}
    </label>

    <PasswordInput
      id={`profile-password-${field.name}`}
      name={field.name}
      autoComplete={field.autoComplete}
      minLength={field.minLength}
      value={passwords[field.name]}
      onChange={(event) => {
        const value = event.target.value;
        setPasswords((current) => ({
          ...current,
          [field.name]: value,
        }));
        setValidationError("");
        if (isSuccess || savePassword.isError) reset();
      }}
      required
      maxLength={128}
      disabled={savePassword.isPending}
      aria-describedby={
        errorMessage
          ? "profile-password-help profile-password-error"
          : "profile-password-help"
      }
      className="h-11 rounded-xl pl-3 text-sm"
    />
  </div>
))}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="submit"
            disabled={
              savePassword.isPending ||
              Object.values(passwords).some((value) => !value)
            }
            className="h-9 px-4"
          >
            {savePassword.isPending ? "Saving…" : "Save"}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset();
              clearFields();
            }}
            className="h-9 px-4"
          >
            Cancel
          </Button>
        </div>
      </fieldset>

      {errorMessage && (
        <p
          id="profile-password-error"
          role="alert"
          className="mt-2 text-sm text-destructive"
        >
          {errorMessage}
        </p>
      )}

      {isSuccess && (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          Password saved
        </p>
      )}
    </form>
  );
}
