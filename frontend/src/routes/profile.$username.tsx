import { createFileRoute } from "@tanstack/react-router";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { FollowButton } from "@/components/profile/follow-button";
import { ProfilePageFrame, PublicProfilePage } from "@/components/profile/public-profile-page";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/api/client";
import { usePublicProfile } from "@/lib/profiles";

export const Route = createFileRoute("/profile/$username")({
  component: CreatorProfileRoute,
});

function CreatorProfileRoute() {
  const { username } = Route.useParams();
  // Load the user named in the URL
  const profile = usePublicProfile(username);

  if (profile.isPending) {
    return (
      <ProfilePageFrame>
        <div role="status" className="rounded-3xl border bg-card p-10 text-center">
          <LoaderCircle aria-hidden="true" className="mx-auto size-6 animate-spin text-brand-rust" />
          <p className="mt-3 text-sm text-muted-foreground">Loading profile…</p>
        </div>
      </ProfilePageFrame>
    );
  }

  if (profile.isError) {
    // Show a specific message for missing profiles
    const notFound = profile.error instanceof ApiError && profile.error.status === 404;
    return (
      <ProfilePageFrame>
        <div className="rounded-3xl border bg-card px-6 py-12 text-center">
          <CircleAlert aria-hidden="true" className="mx-auto size-8 text-brand-rust" />
          <h1 className="mt-4 text-2xl font-bold">{notFound ? "Creator not found" : "This profile couldn’t load"}</h1>
          <p role="alert" className="mt-3 text-sm text-muted-foreground">
            {notFound ? "This creator’s profile could not be found." : "Check your connection and try again."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Button type="button" variant="outline" disabled={profile.isFetching} onClick={() => void profile.refetch()} className="h-10 px-4">
              {profile.isFetching && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
              Try again
            </Button>
          </div>
        </div>
      </ProfilePageFrame>
    );
  }

  // Projects aren't connected yet
  return (
  <PublicProfilePage
    key={profile.data.username.toLowerCase()}
    profile={{
      username: profile.data.username,
      bio: profile.data.bio,
      pictureUrl: profile.data.profile_picture_link,
    }}
    followAction={<FollowButton username={profile.data.username} />}
    projects={[]}

  />
);
}
