import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiError } from "@/api/client";
import { useUpdatePassword } from "@/lib/profile-editing";

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

  const errorMessage =
    validationError ||
    (savePassword.isError
      ? status === 400
        ? "Your old password is incorrect."
        : status === 401
          ? "Please log out and log in again before saving."
          : status === 422
            ? "Check your passwords and try again."
            : "Your password could not be saved. Please try again."
      : "");

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
