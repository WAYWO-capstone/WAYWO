import { Link } from "@tanstack/react-router";
import { Check, LoaderCircle, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useCurrentProfile, useIsAuthenticated } from "@/lib/auth";
import { useFollowingStatus, useToggleFollow } from "@/lib/follows";
import { cn } from "@/lib/utils";
const buttonClass = "h-11 min-w-32 rounded-xl px-5 text-sm font-semibold";

export function FollowButton({ username }: { username: string }) {
  const signedIn = useIsAuthenticated();
  const me = useCurrentProfile();
  const isOwnProfile = me.data?.username.toLowerCase() === username.toLowerCase();
  const status = useFollowingStatus(username, signedIn && !isOwnProfile);
  const toggle = useToggleFollow(username);

  // can't follow yourself
  if (isOwnProfile) return null;

  // visitors are sent to login, then back to the profile they wanted to follow initially
  if (!signedIn) {
    return (
      <div className="ml-auto">
        <Link
          to="/login"
          search={{ redirect: `/profile/${encodeURIComponent(username)}` }}
          className={cn(buttonVariants(), buttonClass)}
        >
          <Plus aria-hidden="true" className="size-4" />
          Follow
        </Link>
      </div>
    );
  }

  const isFollowing = status.data?.is_following ?? false;
  const loading = status.isPending || me.isPending;

  return (
    <div className="ml-auto flex flex-col items-end gap-1.5">
      <Button
        type="button"
        variant={isFollowing ? "outline" : "default"}
        aria-pressed={isFollowing}
        aria-label={isFollowing ? `Unfollow ${username}` : `Follow ${username}`}
        disabled={loading || toggle.isPending}
        onClick={() => toggle.mutate(!isFollowing)}
        className={cn("group", buttonClass, isFollowing && "hover:border-destructive/50 hover:text-destructive")}
      >
        {loading ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : isFollowing ? (
          <>
            <Check aria-hidden="true" className="size-4" />
            <span className="group-hover:hidden group-focus-visible:hidden">Following</span>
            <span className="hidden group-hover:inline group-focus-visible:inline">Unfollow</span>
          </>
        ) : (
          <>
            <Plus aria-hidden="true" className="size-4" />
            Follow
          </>
        )}
      </Button>
      {(toggle.isError || status.isError) && (
        <p role="alert" className="text-xs text-destructive">
          {toggle.isError ? "Couldn’t update. Try again." : "Couldn’t load follow status."}
        </p>
      )}
    </div>
  );
}