import { createFileRoute, redirect } from "@tanstack/react-router";
import { CircleAlert, LoaderCircle } from "lucide-react";

import { AccountProfilePage } from "@/components/profile/account-profile-page";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useCurrentProfile, useLogout } from "@/lib/auth";
import { isAuthenticated } from "@/lib/token-store";

export const Route = createFileRoute("/profile/")({
  beforeLoad: ({ location }) => {
    if (!isAuthenticated()) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: ProfilePage,
});

function ProfilePage() {
  const profile = useCurrentProfile();
  const logout = useLogout();

  if (profile.isPending) {
    return (
      <div role="status" className="mx-auto flex w-full max-w-6xl items-center justify-center gap-3 px-4 py-24">
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
        Loading your profile…
      </div>
    );
  }

  if (profile.isError) {
    const sessionExpired = profile.error instanceof ApiError && profile.error.status === 401;

    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16">
        <div role="alert" className="rounded-3xl border bg-card p-8 text-center">
          <CircleAlert aria-hidden="true" className="mx-auto size-8" />
          <h1 className="mt-4 text-2xl font-bold">
            {sessionExpired ? "Please log in again" : "Your profile couldn’t load"}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {sessionExpired ? "Your session has expired." : "Check your connection and try again."}
          </p>
          <Button
            type="button"
            onClick={sessionExpired ? logout : () => void profile.refetch()}
            disabled={profile.isFetching}
            className="mt-6 h-10 px-5"
          >
            {sessionExpired ? "Log in" : "Try again"}
          </Button>
        </div>
      </div>
    );
  }

  return <AccountProfilePage profile={profile.data} onLogout={logout} />;
}
