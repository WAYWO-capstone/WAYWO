import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle,
  CircleAlert,
  LoaderCircle,
} from "lucide-react";
import { useEffect, useState, type SubmitEvent } from "react";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/api/client";
import { safeRedirect, useRegister } from "@/lib/auth";
import { isAuthenticated } from "@/lib/token-store";
import { isValidEmail } from "@/lib/utils/string-utils";

export const Route = createFileRoute("/register")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (isAuthenticated())
      throw redirect({ href: safeRedirect(search.redirect) });
  },
  component: RegisterPage,
});

interface FieldErrors {
  username?: string;
  email?: string;
  password?: string;
  passwordConfirmation?: string;
}

function validate(
  username: string,
  email: string,
  password: string,
  passwordConfirmation: string,
): FieldErrors {
  const errors: FieldErrors = {};
  if (!username.trim()) errors.username = "Enter a username.";
  if (!email || !isValidEmail(email)) errors.email = "Enter a valid email.";

  if (!password) errors.password = "Enter your password.";
  if (!passwordConfirmation && password)
    errors.passwordConfirmation = "Please re-type your password.";
  if (password !== passwordConfirmation)
    errors.passwordConfirmation = "Passwords do not match.";
  return errors;
}

function errorMessage(error: Error): string {
  if (error instanceof ApiError && error.status === 409) {
    const message = error.message.toLowerCase();
    if (message.includes("username")) {
      return "Username is already in use.";
    } else if (message.includes("email")) {
      return "Email is already in use.";
    }
  }

  if (error instanceof TypeError)
    return "Can't reach the server. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

function RegisterPage() {
  const { mutate, isPending, error, isSuccess } = useRegister();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validate(username, email, password, passwordConfirmation);
    setFieldErrors(errors);
    if (
      errors.username ||
      errors.email ||
      errors.password ||
      errors.passwordConfirmation
    )
      return;

    mutate({ username, email, password });
  }

  if (isSuccess) {
    return <RegistrationCompletedMessage />;
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-16 sm:py-28">
      <p className="text-sm font-bold tracking-widest text-brand-rust uppercase">
        MADE FOR MAKERS
      </p>
      <h1 className="mt-5 text-center text-5xl leading-none font-extrabold tracking-tight sm:text-6xl">
        Create your account<span className="text-brand-rust">.</span>
      </h1>
      <p className="mt-5 text-center text-lg text-muted-foreground">
        Join <span className="font-semibold text-brand-rust">WAYWO</span> and
        start sharing what you make!
      </p>

      <form
        noValidate
        onSubmit={handleSubmit}
        className="mt-10 w-full max-w-xl rounded-3xl border bg-card p-6 shadow-xl shadow-brand-mahogany/5 sm:p-11"
      >
        <div className="space-y-6">
          <div>
            <label htmlFor="username" className="mb-3 block font-semibold">
              Username <span className="text-primary">*</span>
            </label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Enter a username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              aria-invalid={!!fieldErrors.username}
              aria-describedby={
                fieldErrors.username ? "username-error" : undefined
              }
            />
            {fieldErrors.username && (
              <p
                id="username-error"
                className="mt-1.5 text-sm text-destructive"
              >
                {fieldErrors.username}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="mb-3 block font-semibold">
              Email <span className="text-primary">*</span>
            </label>
            <Input
              id="email"
              type="text"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Enter your email address"
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
              autoComplete="new-password"
              placeholder="Enter a password"
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
          <div>
            <label
              htmlFor="password-confirmation"
              className="mb-3 block font-semibold"
            >
              Confirm password <span className="text-primary">*</span>
            </label>
            <PasswordInput
              id="password-confirmation"
              autoComplete="new-password"
              placeholder="Confirm your password"
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              aria-invalid={!!fieldErrors.passwordConfirmation}
            />
            {fieldErrors.passwordConfirmation && (
              <p
                id="password-confirmation-error"
                className="mt-1.5 text-sm text-destructive"
              >
                {fieldErrors.passwordConfirmation}
              </p>
            )}
          </div>
        </div>

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
              Registering your account…
            </>
          ) : (
            <>
              Register
              <ArrowRight className="size-5" />
            </>
          )}
        </Button>

        <p className="mt-6 text-center text-muted-foreground">
          Already have an account?{" "}
          <Link
            to={"/login"}
            className="font-bold text-primary hover:underline"
          >
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}

function RegistrationCompletedMessage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void navigate({ href: "/login", replace: true });
    }, 5 * 1000);

    return () => window.clearTimeout(timeoutId);
  }, [navigate]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 sm:py-28">
      <div
        role="status"
        className="w-full max-w-xl rounded-3xl border bg-card p-8 text-center shadow-xl shadow-brand-mahogany/5 sm:p-11"
      >
        <CheckCircle className="mx-auto size-14 text-brand-rust" />
        <h1 className="mt-6 text-4xl leading-none font-extrabold tracking-tight sm:text-5xl">
          Account created<span className="text-brand-rust">.</span>
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Your account has been created. We'll take you to the login page in a
          few seconds.
        </p>
        <Link
          to={"/login"}
          className="mt-8 inline-block font-bold text-primary hover:underline"
        >
          Go to login now
        </Link>
      </div>
    </div>
  );
}
