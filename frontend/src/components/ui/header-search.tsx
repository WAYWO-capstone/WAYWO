/**
 * Search for the top navigation bar.
 * HeaderSearch is the full search box; HeaderSearchButton stands in for it on
 * small screens and opens a search bar that covers the header.
 */

import { Search, X } from "lucide-react";
import { useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const iconButtonClass =
  "inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring";

// Search does not return results yet; submitting does nothing for now.
export function HeaderSearch({
  className,
  autoFocus,
}: {
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <form
      role="search"
      onSubmit={(event) => event.preventDefault()}
      className={cn("relative", className)}
    >
      <Input
        type="search"
        aria-label="Search projects and creators"
        placeholder="Search creations..."
        autoFocus={autoFocus}
        className="pl-12"
      />
      <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
    </form>
  );
}

/**
 * The open search bar is positioned against the header, so this must be
 * rendered inside it. `className` should hide both pieces once the full
 * search box fits.
 */
export function HeaderSearchButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Open search"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn(iconButtonClass, className)}
      >
        <Search aria-hidden="true" className="size-6" />
      </button>

      {open && (
        <div
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
          className={cn(
            "absolute inset-0 z-10 flex items-center gap-2 bg-background px-4 sm:px-8",
            className,
          )}
        >
          <HeaderSearch className="flex-1" autoFocus />
          <button
            type="button"
            aria-label="Close search"
            onClick={close}
            className={iconButtonClass}
          >
            <X aria-hidden="true" className="size-6" />
          </button>
        </div>
      )}
    </>
  );
}
