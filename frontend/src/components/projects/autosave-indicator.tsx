import { CircleAlert, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { AutosaveState } from "@/lib/autosave";
import { autosaveLabel } from "@/lib/project-autosave";

export function AutosaveIndicator({ state, onRetry }: { state: AutosaveState; onRetry: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const label = autosaveLabel(state, now);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  if (!label) return null;
  const failed = state.status === "error";

  return (
    <span role="status" className={`inline-flex items-center gap-1.5 text-sm ${failed ? "text-destructive" : "text-muted-foreground"}`}>
      {state.status === "saving" && <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />}
      {failed && <CircleAlert className="size-3.5" aria-hidden="true" />}
      {label}
      {failed && !state.retrying && <button type="button" onClick={onRetry} className="font-semibold underline">Retry</button>}
    </span>
  );
}
