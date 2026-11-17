import { RotateCw, X } from "lucide-react";
import { progressPercent } from "@/lib/uploads/progress";
import type { UploadItem, UploadStatus } from "@/lib/uploads/types";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<Exclude<UploadStatus, "done">, string> = {
  queued: "Waiting...",
  uploading: "Uploading...",
  completing: "Checking...",
  processing: "Processing...",
  attaching: "Adding...",
  error: "Failed",
};

const SIZE_UNITS = ["B", "KB", "MB", "GB"];

function formatFileSize(bytes: number): string {
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < SIZE_UNITS.length - 1) {
    size /= 1024;
    unit++;
  }
  const rounded = unit === 0 ? size : Math.round(size * 10) / 10;
  return `${rounded} ${SIZE_UNITS[unit]}`;
}

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
        {item.status === "done" ? (
          <>
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-mahogany" title={name}>{name}</p>
            <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(item.totalBytes)}</span>
          </>
        ) : (
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground" title={name}>
            <span className={cn("font-semibold", failed ? "text-destructive" : "text-brand-garnet")}>
              {STATUS_LABELS[item.status]}
            </span>{" "}
            {name}
          </p>
        )}
        {failed && (
          <button
            type="button"
            onClick={() => onRetry(item.id)}
            className="flex items-center gap-1 text-xs font-semibold text-brand-garnet hover:text-brand-rust"
          >
            <RotateCw className="size-3" aria-hidden="true" />Retry
          </button>
        )}
        {(cancellable || failed) && (
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
