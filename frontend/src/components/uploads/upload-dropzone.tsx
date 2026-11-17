import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { LoaderCircle, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  onFiles: (files: File[]) => void;
  label: string;
  hint?: string;
  icon?: ReactNode;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  busy?: boolean;
  errors?: string[];
  size?: "compact" | "large";
  className?: string;
}

export function UploadDropzone({
  onFiles,
  label,
  hint,
  icon,
  accept,
  multiple = true,
  disabled = false,
  busy = false,
  errors = [],
  size = "compact",
  className,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const large = size === "large";

  const pick = (files: FileList | null) => {
    if (!disabled && files && files.length > 0) onFiles(Array.from(files));
  };

  const onDragOver = (event: DragEvent) => {
    event.preventDefault();
    if (!disabled) setDragging(true);
  };

  const onDragLeave = (event: DragEvent) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files);
  };

  const circle = (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-border text-brand-mahogany",
        large ? "size-10" : "size-9",
      )}
      aria-hidden="true"
    >
      {busy ? <LoaderCircle className="size-4 animate-spin" /> : (icon ?? <Upload className="size-4" />)}
    </span>
  );

  return (
    <div className={className}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "w-full border-2 border-dashed border-brand-clay bg-white transition-colors",
          "hover:bg-background focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60",
          large
            ? "flex flex-col items-center gap-2 rounded-lg px-4 py-6 text-center"
            : "flex items-center gap-3 rounded-md px-3 py-2 text-left",
          dragging && "border-brand-garnet bg-background",
        )}
      >
        {circle}
        <span className="text-sm font-semibold text-brand-mahogany">{label}</span>
        {large && (
          <>
            <span className="text-xs text-muted-foreground">or</span>
            <span className="rounded-full border border-brand-mahogany px-3 py-1 text-xs text-brand-mahogany">Browse files</span>
          </>
        )}
        {hint && <span className={cn("text-xs text-muted-foreground", !large && "ml-auto")}>{hint}</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          pick(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <div aria-live="polite">
        {errors.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-destructive">
            {errors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
