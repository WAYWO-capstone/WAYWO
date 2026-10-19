import { Menu } from "@base-ui/react/menu";
import { Link } from "@tanstack/react-router";
import { UserRound } from "lucide-react";

import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { useCurrentProfile } from "@/lib/auth";

export function HeaderProfileMenu() {
  const profile = useCurrentProfile();

  return (
    <Menu.Root>
      <Menu.Trigger
        type="button"
        aria-label="Open profile menu"
        className="inline-flex shrink-0 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {profile.data ? (
          <ProfileAvatar
            key={profile.data.username}
            username={profile.data.username}
            src={profile.data.profile_picture_link}
            className="size-9 text-sm sm:size-10"
          />
        ) : (
          <span
            role="img"
            aria-label="Your profile picture"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-brand-mahogany/30 bg-[#f5e4cf] text-brand-mahogany sm:size-10"
          >
            <UserRound aria-hidden="true" className="size-5" />
          </span>
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={8} className="z-50">
          <Menu.Popup className="min-w-40 rounded-xl border bg-background p-1.5 text-foreground shadow-lg outline-none">
            <Menu.LinkItem
              closeOnClick
              render={<Link to="/profile" />}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
            >
              <UserRound aria-hidden="true" className="size-4" />
              Profile
            </Menu.LinkItem>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
