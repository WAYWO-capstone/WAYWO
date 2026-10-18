import { Link } from "@tanstack/react-router";
import {
  createLucideIcon,
  Bell,
  Bookmark,
  Folder,
  Pencil,
  Settings,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AccountProfile } from "@/lib/api";


interface AccountProfilePageProps {
  profile: AccountProfile;
  onLogout: () => void;
}
// main sidebar options
const mainItems = [
  { label: "Projects", icon: Folder },
  { label: "Saved Projects", icon: Bookmark },
  { label: "Followers", icon: UsersRound },
];

// person inside a circle to match the mockup
const AccessibilityCircle = createLucideIcon("AccessibilityCircle", [
  ["circle", { cx: "12", cy: "12", r: "10", key: "outline" }],
  ["circle", { cx: "12", cy: "6.5", r: "1.5", key: "head" }],
  ["path", { d: "m7 10 5 1 5-1M12 11v3m-3 4 3-4 3 4", key: "body" }],
]);

// person inside a circle to match the mockup
const preferenceItems = [
  { label: "Settings", icon: Settings },
  { label: "Notification Preferences", icon: Bell },
 { label: "Accessibility", icon: AccessibilityCircle },
];

const fieldClassName = "h-10 rounded-xl px-3 text-sm";

// these sections will be connected later
function SidebarItem({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  return (
    <li>
      <button
        type="button"
        disabled
        title={`${label} — coming soon`}
        className="flex min-h-10 w-full cursor-default items-center gap-3 py-1.5 text-left text-base"
      >
        <Icon aria-hidden="true" className="size-4.5 shrink-0" />
        <span>{label}</span>
      </button>
    </li>
  );
}

// editing is disabled until saving is connected
function EditButton({ label, avatar = false }: { label: string; avatar?: boolean }) {
  return (
    <button
      type="button"
      disabled
      aria-label={label}
      title={`${label} — coming soon`}
      className={avatar
        ? "absolute right-0 bottom-0 flex size-8 cursor-default items-center justify-center rounded-full border-2 border-card bg-brand-garnet text-white"
        : "flex size-8 shrink-0 cursor-default items-center justify-center rounded-full text-brand-mahogany"}
    >
      <Pencil aria-hidden="true" className="size-4" />
    </button>
  );
}

export function AccountProfilePage({ profile, onLogout }: AccountProfilePageProps) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:w-[85%] sm:px-0 lg:py-16">
      <div className="grid rounded-3xl border bg-card p-3 md:min-h-160 md:grid-cols-[minmax(15rem,31.5%)_minmax(0,1fr)] md:p-4">
        <aside className="min-w-0 border-b px-3 pt-5 pb-6 md:border-r md:border-b-0 md:px-4 md:py-6 lg:pr-8">
          <div className="flex min-w-0 items-center gap-4">
            <ProfileAvatar
              username={profile.username}
              src={profile.profile_picture_link}
              className="size-16 text-xl md:size-20"
              decorative
            />
            <p className="min-w-0 text-xl font-bold wrap-anywhere">
              {profile.username}
            </p>
          </div>

          <nav aria-label="Profile navigation" className="mt-6 md:mt-9">
            <ul className="grid grid-cols-2 gap-x-4 md:block">
              <li>
                <Link
                  to="/profile"
                  aria-current="page"
                  className="flex min-h-10 items-center gap-3 rounded-md py-1.5 text-base font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <UserRound aria-hidden="true" className="size-4.5 shrink-0" />
                  Profile
                </Link>
              </li>
              {mainItems.map((item) => <SidebarItem key={item.label} {...item} />)}
            </ul>

            <hr className="my-5 border-t-2 border-brand-garnet" />

            <ul className="grid grid-cols-2 gap-x-4 md:block">
              {preferenceItems.map((item) => <SidebarItem key={item.label} {...item} />)}
            </ul>
          </nav>
        </aside>

        <section aria-labelledby="account-profile-title" className="flex min-w-0 flex-col px-3 py-6 md:px-7 lg:px-12">
          <div>
            <h1 id="account-profile-title" className="text-2xl font-bold">Profile</h1>
            <p className="mt-1 text-sm sm:text-base">Your details, your style, your preferences.</p>
          </div>

          <div className="mt-8 flex flex-wrap items-end gap-x-7 gap-y-6">
            <div className="relative shrink-0">
              <ProfileAvatar
                username={profile.username}
                src={profile.profile_picture_link}
                className="size-20 text-xl"
              />
              <EditButton label="Edit profile picture" avatar />
            </div>

            <div className="min-w-0 flex-1 basis-36">
              <label htmlFor="profile-name" className="mb-1.5 block text-sm font-semibold">Username</label>
              <div className="flex items-center gap-1">
                <Input id="profile-name" value={profile.username} readOnly className={fieldClassName} />
                <EditButton label="Edit username" />
              </div>
            </div>

            <div className="min-w-0 flex-1 basis-48">
              <label htmlFor="profile-email" className="mb-1.5 block text-sm font-semibold">Email</label>
              <div className="flex items-center gap-1">
                <Input id="profile-email" type="email" value={profile.email} readOnly className={fieldClassName} />
                <EditButton label="Edit email" />
              </div>
            </div>
          </div>

          <div className="mt-8 w-full max-w-xl">
            <label htmlFor="profile-bio" className="mb-1.5 block text-sm font-semibold">About me</label>
            <div className="flex items-start gap-1">
              <textarea
                id="profile-bio"
                value={profile.bio ?? ""}
                placeholder="Tell us a little about yourself."
                readOnly
                rows={1}
                className="field-sizing-content min-h-10 w-full min-w-0 resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
              />
              <EditButton label="Edit about me" />
            </div>
          </div>
{/* password changes will be connected later */}
          <fieldset disabled title="Password changes — coming soon" className="mt-8 w-full max-w-52 space-y-3">
            <legend className="mb-3 text-sm font-semibold">Change your password</legend>
            <label htmlFor="profile-old-password" className="sr-only">Old Password</label>
            <Input id="profile-old-password" type="password" placeholder="Old Password" autoComplete="current-password" className={fieldClassName} />
            <label htmlFor="profile-new-password" className="sr-only">New Password</label>
            <Input id="profile-new-password" type="password" placeholder="New Password" autoComplete="new-password" className={fieldClassName} />
            <label htmlFor="profile-confirm-password" className="sr-only">Confirm New Password</label>
            <Input id="profile-confirm-password" type="password" placeholder="Confirm New Password" autoComplete="new-password" className={fieldClassName} />
          </fieldset>

          <div className="mt-12 flex justify-center md:mt-auto md:pt-12">
            <Button type="button" onClick={onLogout} className="h-10 min-w-32 rounded-lg px-6 font-semibold">
              Log out
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
