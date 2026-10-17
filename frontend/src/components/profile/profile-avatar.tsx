import { useState } from "react";
import { cn } from "@/lib/utils";

interface ProfileAvatarProps {
  username: string;
  src?: string | null;
  className?: string;
  decorative?: boolean;
}

export function ProfileAvatar({
  username,
  src,
  className,
  decorative = false,
}: ProfileAvatarProps) {
  // Track the failed URL so a new picture can still load
  const [failedSource, setFailedSource] = useState<string | null>(null);
  // Use initials when the picture is missing or broken
  const words = username.trim().split(/\s+/);
  const initials = (words.length > 1
    ? words.slice(0, 2).map((word) => word[0]).join("")
    : username.trim().slice(0, 2)
  ).toUpperCase() || "?";
  return (
    <span
      className={cn(
        "inline-flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-mahogany/30 bg-[#f5e4cf] text-2xl font-semibold text-brand-mahogany",
        className,
      )}
    >
      {src && src !== failedSource ? (
        <img
          src={src}
          alt={decorative ? "" : `${username}'s profile picture`}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailedSource(src)}
        />
      ) : (
        <span
          role={decorative ? undefined : "img"}
          aria-label={decorative ? undefined : `${username}'s profile picture`}
          aria-hidden={decorative || undefined}
        >
          {initials}
        </span>
      )}
    </span>
  );
}
