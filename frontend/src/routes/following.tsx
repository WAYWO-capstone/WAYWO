import { createFileRoute, redirect } from "@tanstack/react-router";

import { FollowingPage } from "@/components/profile/following-page";
import { isAuthenticated } from "@/lib/token-store";

export const Route = createFileRoute("/following")({
  beforeLoad: ({ location }) => {
    if (!isAuthenticated()) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: FollowingRoute,
});

function FollowingRoute() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:w-[85%] sm:px-0 lg:py-16">
      <FollowingPage />
    </div>
  );
}
