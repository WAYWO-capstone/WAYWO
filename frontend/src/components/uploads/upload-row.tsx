import { RotateCw, X } from "lucide-react";
import { progressPercent } from "@/lib/uploads/progress";
import type { UploadItem, UploadStatus } from "@/lib/uploads/types";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<UploadStatus, string> = {
  queued: "Waiting...",
  uploading: "Uploading...",
  completing: "Checking...",
  processing: "Processing...",
  attaching: "Adding...",
  done: "Uploaded",
  error: "Failed",
};

interface UploadRowProps {
  item: UploadItem;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

export function UploadRow({ item, onRetry, onRemove }: UploadRowProps) {
  const percent = progressPercent(item);
  const failed = item.status === "error";
  const done = item.status === "done";
  const cancellable = item.status === "queued" || item.status === "uploading";
  const name = item.file.name;

  return (
    <li className="rounded-md border border-brand-clay bg-white px-3 py-2">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground" title={name}>
          <span className={cn("font-semibold", failed ? "text-destructive" : "text-brand-garnet")}>
            {STATUS_LABELS[item.status]}
          </span>{" "}
          {name}
        </p>
        {failed && (
          <button
            type="button"
            onClick={() => onRetry(item.id)}
            className="flex items-center gap-1 text-xs font-semibold text-brand-garnet hover:text-brand-rust"
          >
            <RotateCw className="size-3" aria-hidden="true" />Retry
          </button>
        )}
        {(cancellable || failed || done) && (
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label={cancellable ? `Cancel upload of ${name}` : `Dismiss ${name}`}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {!done && (
        <div
          role="progressbar"
          aria-label={`${name} upload progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="mt-1.5 h-1 overflow-hidden rounded-full bg-border"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-300",
              failed ? "bg-destructive" : "bg-brand-garnet",
              item.status === "processing" && "animate-pulse",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
      {item.error && <p role="alert" className="mt-1 text-xs text-destructive">{item.error}</p>}
    </li>
  );
}
