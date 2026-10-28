import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

// UI only 
export function FollowButton({ username }: { username: string }) {
  return (
    <Button
      type="button"
      disabled
      aria-label={`Follow ${username}`}
      className="ml-auto h-11 min-w-28 rounded-xl px-5 text-sm font-semibold disabled:opacity-100"
    >
      <Plus aria-hidden="true" className="size-4" />
      Follow
    </Button>
  );
}