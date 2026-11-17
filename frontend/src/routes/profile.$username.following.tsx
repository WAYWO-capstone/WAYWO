import { createFileRoute } from "@tanstack/react-router";

import { FollowingPage } from "@/components/profile/following-page";

export const Route = createFileRoute("/profile/$username/following")({
  component: PublicFollowingRoute,
});

function PublicFollowingRoute() {
  const { username } = Route.useParams();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:w-[85%] sm:px-0 lg:py-16">
      <FollowingPage username={username} />
    </div>
  );
}
