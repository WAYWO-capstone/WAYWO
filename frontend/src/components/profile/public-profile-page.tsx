import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { ProfileProjects, type ProfileProject } from "@/components/profile/profile-projects";
import { cn } from "@/lib/utils";

export interface CreatorProfile {
  username: string;
  bio: string | null;
  pictureUrl: string | null;
  displayName?: string | null;
  projectCount?: number;
  followersCount?: number;
  followingCount?: number;
}

interface PublicProfilePageProps {
  profile: CreatorProfile;
  projects?: readonly ProfileProject[];
  followAction?: ReactNode;
}

export function ProfilePageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-14 sm:w-[85%] sm:px-0 sm:pt-7">
      {/* Community uses the home route for now. */}
      <Link
        to="/"
        className="mb-3 inline-flex min-h-8 items-center gap-2 text-sm hover:text-brand-rust focus-visible:rounded focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to community
      </Link>
      {children}
    </div>
  );
}

// Profile data is fetched in the route.
export function PublicProfilePage({
  profile,
    projects,
  followAction,
}: PublicProfilePageProps) {
  const name = profile.displayName?.trim() || profile.username;
  // Hide counts that have not been provided.
  const stats = [
    { label: "projects", value: projects?.length ?? profile.projectCount },
    { label: "followers", value: profile.followersCount },
    { label: "following", value: profile.followingCount },
  ].filter((stat): stat is { label: string; value: number } =>
    typeof stat.value === "number",
  );

  return (
    <ProfilePageFrame>
      <section aria-labelledby="profile-name" className="rounded-3xl border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-5 sm:gap-6">
          <ProfileAvatar username={name} src={profile.pictureUrl} className="size-20 sm:size-22" />
          <div className="min-w-0 flex-1 basis-40 pt-0.5">
            <h1 id="profile-name" className="text-2xl font-bold wrap-anywhere sm:text-3xl">{name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere sm:text-base">
              {profile.bio?.trim() ? profile.bio : "This user hasn’t added a bio yet."}
            </p>
            {stats.length > 0 && (
              <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                {stats.map(({ label, value }, index) => (
                  <div key={label} className={cn("flex gap-1.5", index > 0 && "border-l border-brand-mahogany/40 pl-5")}>
                    <dt className="order-2">{label}</dt>
                    <dd className="order-1 font-bold">{value.toLocaleString()}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          {followAction}
        </div>
      </section>

     {projects !== undefined && <ProfileProjects projects={projects} />}
    </ProfilePageFrame>
  );
}
