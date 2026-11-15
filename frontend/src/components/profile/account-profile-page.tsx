import { Link } from "@tanstack/react-router";
import {
  createLucideIcon,
  Bell,
  Bookmark,
  Folder,
  Settings,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AccountProfile } from "@/api/models";
import { BioEditor } from "@/components/profile/bio-editor";
import { EmailEditor } from "@/components/profile/email-editor";
import { PasswordEditor } from "@/components/profile/password-editor";
import { ProfilePictureEditor } from "@/components/profile/profile-picture-editor";


interface AccountProfilePageProps {
  profile: AccountProfile;
  onLogout: () => void;
  section?: ProfileSection;
}
export type ProfileSection = "saved-projects" | "followers" | "settings" | "notifications" | "accessibility";
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

const sectionByLabel: Record<string, ProfileSection> = {
  "Saved Projects": "saved-projects", Followers: "followers", Settings: "settings",
  "Notification Preferences": "notifications", Accessibility: "accessibility",
};
const placeholderCopy: Record<ProfileSection, { title: string; description: string }> = {
  "saved-projects": { title: "Saved Projects", description: "Saved projects will appear here when this feature is available." },
  followers: { title: "Followers", description: "Your followers will appear here when follower lists are available." },
  settings: { title: "Settings", description: "More account settings will be available here soon." },
  notifications: { title: "Notification Preferences", description: "Choose which notifications you receive here when preferences are available." },
  accessibility: { title: "Accessibility", description: "Accessibility options will be available here soon." },
};

function SidebarItem({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  return (
    <li>
      <Link
        to={label === "Projects" ? "/projects" : "/profile"}
        search={label === "Projects" ? undefined : { section: sectionByLabel[label] }}
        className="flex min-h-10 w-full items-center gap-3 rounded-md py-1.5 text-left text-base outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon aria-hidden="true" className="size-4.5 shrink-0" />
        <span>{label}</span>
      </Link>
    </li>
  );
}

export function AccountProfilePage({ profile, onLogout, section }: AccountProfilePageProps) {
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
                  search={{ section: undefined }}
                  aria-current={section ? undefined : "page"}
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
          {section ? (
            <div className="rounded-2xl border border-dashed px-6 py-10 sm:px-8">
              <h1 id="account-profile-title" className="text-2xl font-bold">{placeholderCopy[section].title}</h1>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">{placeholderCopy[section].description}</p>
            </div>
          ) : <>
          <div>
            <h1 id="account-profile-title" className="text-2xl font-bold">Profile</h1>
            <p className="mt-1 text-sm sm:text-base">Your details, your style, your preferences.</p>
          </div>

                    <div className="mt-8 flex flex-wrap items-start gap-x-7 gap-y-6">
            <ProfilePictureEditor
  key={profile.username}
  username={profile.username}
  src={profile.profile_picture_link}
/>

            <div className="min-w-0 flex-1 basis-36">
              <label htmlFor="profile-name" className="mb-1.5 block text-sm font-semibold">Username</label>
              <div className="flex items-center gap-1">
                <Input id="profile-name" value={profile.username} readOnly className={fieldClassName} />
                
              </div>
            </div>

                      <EmailEditor key={profile.username} email={profile.email} />
          </div>

          <BioEditor key={profile.username} bio={profile.bio} />
<PasswordEditor key={profile.username} />

          <div className="mt-12 flex justify-center md:mt-auto md:pt-12">
            <Button type="button" onClick={onLogout} className="h-10 min-w-32 rounded-lg px-6 font-semibold">
              Log out
            </Button>
          </div>
          </>}
        </section>
      </div>
    </div>
  );
}
