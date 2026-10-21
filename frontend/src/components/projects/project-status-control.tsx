import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { ProjectView } from "@/lib/api";
import { statusClasses, statusLabel } from "@/lib/project-status";

interface ProjectStatusControlProps {
  status: ProjectView["status"];
  isOwner: boolean;
  isSaving: boolean;
  error: string | null;
  onChange: (status: ProjectView["status"]) => Promise<void>;
}

export function ProjectStatusControl({
  status,
  isOwner,
  isSaving,
  error,
  onChange,
}: ProjectStatusControlProps) {
  const [editing, setEditing] = useState(false);

  if (!isOwner || !editing) {
    const pillClass = `rounded-full px-5 py-1.5 text-sm font-medium ${statusClasses(status)}`;
    return (
      <div className="ml-2">
        {isOwner ? (
          <button
            type="button"
            aria-label={`Change project status from ${statusLabel(status)}`}
            title="Click to change project status"
            onClick={() => setEditing(true)}
            className={`${pillClass} outline-none focus-visible:ring-2 focus-visible:ring-ring`}
          >
            {statusLabel(status)}
          </button>
        ) : (
          <span className={pillClass}>{statusLabel(status)}</span>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="ml-2">
      <label className="flex items-center gap-2 text-sm font-semibold text-brand-garnet">
        <span className="sr-only">Project status</span>
        <select
          aria-label="Project status"
          autoFocus
          value={status}
          disabled={isSaving}
          onChange={(event) => {
            void onChange(event.target.value as ProjectView["status"])
              .then(() => setEditing(false))
              .catch(() => undefined);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditing(false);
          }}
          onBlur={() => {
            if (!isSaving) setEditing(false);
          }}
          className="min-h-9 rounded-full border border-[#ead7c7] bg-white px-4 py-1.5 text-sm font-medium text-brand-mahogany outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="COMPLETED">Completed</option>
        </select>
        {isSaving && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
      </label>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
