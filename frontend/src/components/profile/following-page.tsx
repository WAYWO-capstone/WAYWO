import { Link } from "@tanstack/react-router";
import { CircleAlert, LoaderCircle } from "lucide-react";

import type { FollowingCreator } from "@/api/models";
import { ApiError } from "@/api/client";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { Button } from "@/components/ui/button";
import { useFollowedCreators, usePublicFollowing } from "@/lib/follows";

function CreatorCard({ creator }: { creator: FollowingCreator }) {
  return (
    <Link
      to="/profile/$username"
      params={{ username: creator.username }}
      className="flex items-center gap-4 rounded-2xl border bg-card p-4 transition-colors hover:border-brand-rust focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ProfileAvatar
        username={creator.username}
        src={creator.profile_picture_link}
        className="size-14 text-lg"
      />
      <div className="min-w-0">
        <h2 className="font-semibold wrap-anywhere">{creator.username}</h2>
        {creator.bio && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{creator.bio}</p>
        )}
      </div>
    </Link>
  );
}

export function FollowingPage({ username }: { username?: string }) {
  const ownFollowing = useFollowedCreators();
  const publicFollowing = usePublicFollowing(username ?? "");
  const followed = username ? publicFollowing : ownFollowing;

  if (followed.isPending) {
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-24">
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
        Loading {username ? `${username}’s following list` : "your following list"}…
      </div>
    );
  }

  if (followed.isError) {
    const sessionExpired = followed.error instanceof ApiError && followed.error.status === 401;
    return (
      <div role="alert" className="rounded-3xl border bg-card p-8 text-center">
        <CircleAlert aria-hidden="true" className="mx-auto size-8 text-brand-rust" />
        <h1 className="mt-4 text-2xl font-bold">
          {sessionExpired ? "Please log in again" : "Following list couldn't load"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {sessionExpired ? "Your session has expired." : "Check your connection and try again."}
        </p>
        <Button type="button" onClick={() => void followed.refetch()} className="mt-6 h-10 px-5">
          Try again
        </Button>
      </div>
    );
  }

  return (
    <section aria-labelledby="following-title">
      <div>
        <h1 id="following-title" className="text-2xl font-bold">Following</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {username ? `Creators ${username} follows.` : "Creators you follow."}
        </p>
      </div>
      {followed.data.length === 0 ? (
        <div className="mt-8 rounded-3xl border bg-card px-6 py-12 text-center">
          <p className="font-semibold">
            {username ? `${username} isn't following anyone yet.` : "You aren't following anyone yet."}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Visit a creator's profile to follow them.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {followed.data.map((creator) => <CreatorCard key={creator.username} creator={creator} />)}
        </div>
      )}
    </section>
  );
}
