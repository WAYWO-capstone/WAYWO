import { Link } from "@tanstack/react-router";
import { Bookmark, LogOut, Settings, UserRound } from "lucide-react";

import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { useCurrentProfile, useLogout } from "@/lib/auth";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import "./header.css";

export function HeaderProfileMenu() {
  const profile = useCurrentProfile();
  const logout = useLogout();

  if (!profile.data) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Open profile menu" role="button">
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
      </DropdownMenuTrigger>
      <DropdownMenuContent className={"min-w-52"}>
        <DropdownMenuGroup className={"flex flex-col items-center pt-4 gap-2"}>
          <ProfileAvatar
            key={profile.data.username}
            username={profile.data.username}
            src={profile.data.profile_picture_link}
            className="size-10 text-sm sm:size-20"
          />
          <p className="text-md font-medium">{profile.data.username}</p>
          <DropdownMenuItem className={"w-full"}>
            <Link
              to={"/profile/$username"}
              params={{ username: profile.data.username }}
              className="flex items-center gap-2 w-full"
            >
              <Button variant="outline" className={"rounded-2xl w-full"}>
                <UserRound aria-hidden="true" className="size-4" />
                My profile
              </Button>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem className="flex items-center gap-2">
            <Link to="/profile" className="flex items-center gap-2 w-full">
              <Settings aria-hidden="true" className="size-4" />
              User settings
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuItem className="flex items-center gap-2">
          {/*<Link to="/projects" className="flex items-center gap-2 w-full">*/}
          <Bookmark aria-hidden="true" className="size-4" />
          Saved projects
          {/*</Link>*/}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="flex items-center gap-2">
          <LogOut aria-hidden="true" className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
