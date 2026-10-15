// The /login page: validates the form, logs the user in, and redirects them afterwards.

import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CircleAlert, LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { safeRedirect, useLogin } from "@/lib/auth";
import { isAuthenticated } from "@/lib/token-store";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (isAuthenticated())
      throw redirect({ href: safeRedirect(search.redirect) });
  },
  component: LoginPage,
});

interface FieldErrors {
  email?: string;
  password?: string;
}

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = "Enter your email address.";
  if (!password) errors.password = "Enter your password.";
  return errors;
}

function errorMessage(error: Error): string {
  if (error instanceof ApiError && error.status === 401)
    return "Incorrect email or password.";
  if (error instanceof TypeError)
    return "Can't reach the server. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

function LoginPage() {
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const { mutate, isPending, error } = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validate(email, password);
    setFieldErrors(errors);
    if (errors.email || errors.password) return;

    mutate(
      { email, password, remember },
      {
        onSuccess: () =>
          navigate({ href: safeRedirect(redirectTo), replace: true }),
      },
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-16 sm:py-28">
      <p className="text-sm font-bold tracking-widest text-brand-rust uppercase">
        Welcome back, maker
      </p>
      <h1 className="mt-5 text-center text-5xl leading-none font-extrabold tracking-tight sm:text-6xl">
        Log in to <span className="text-brand-rust">WAYWO.</span>
      </h1>
      <p className="mt-5 text-center text-lg text-muted-foreground">
        Pick up where you left off.{" "}
        <span className="font-semibold text-brand-rust">Keep making.</span>
      </p>
      {redirectTo && (
        <p className="mt-3 text-sm text-muted-foreground">
          Please log in to continue.
        </p>
      )}

      <form
        noValidate
        onSubmit={handleSubmit}
        className="mt-10 w-full max-w-xl rounded-3xl border bg-card p-6 shadow-xl shadow-brand-mahogany/5 sm:p-11"
      >
        <div className="space-y-6">
          <div>
            <label htmlFor="email" className="mb-3 block font-semibold">
              Email address <span className="text-primary">*</span>
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="janedoe@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
            />
            {fieldErrors.email && (
              <p id="email-error" className="mt-1.5 text-sm text-destructive">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="mb-3 block font-semibold">
              Password <span className="text-primary">*</span>
            </label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={
                fieldErrors.password ? "password-error" : undefined
              }
            />
            {fieldErrors.password && (
              <p
                id="password-error"
                className="mt-1.5 text-sm text-destructive"
              >
                {fieldErrors.password}
              </p>
            )}
          </div>
        </div>

        <label className="mt-6 flex w-fit cursor-pointer items-center gap-3 text-muted-foreground">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="size-5 accent-primary"
          />
          Remember me
        </label>

        {error && (
          <p
            role="alert"
            className="mt-6 flex items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            <CircleAlert className="size-4 shrink-0" />
            {errorMessage(error)}
          </p>
        )}

        <Button
          type="submit"
          disabled={isPending}
          className="mt-8 h-14 w-full rounded-2xl text-lg font-semibold"
        >
          {isPending ? (
            <>
              <LoaderCircle className="size-5 animate-spin" />
              Logging in…
            </>
          ) : (
            <>
              Log in
              <ArrowRight className="size-5" />
            </>
          )}
        </Button>

        <p className="mt-6 text-center text-muted-foreground">
          New to WAYWO?{" "}
          <a
            href="/register"
            className="font-bold text-primary hover:underline"
          >
            Create an account
          </a>
        </p>
      </form>
    </div>
  );
}