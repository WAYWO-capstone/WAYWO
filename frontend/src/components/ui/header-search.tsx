/**
 * Search for the top navigation bar.
 * HeaderSearch is the full search box; HeaderSearchButton stands in for it on
 * small screens and opens a search bar that covers the header.
 */

import { useRouterState } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import "./header.css";

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
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  // The page the bar was opened on, so moving to another page closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpenOn(null);
    requestAnimationFrame(() => buttonRef.current?.focus());
  };

  // Clicking or tapping outside an empty bar closes it. This listens for the
  // press rather than blur because Safari doesn't focus buttons on click.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const bar = barRef.current;
      if (!bar || bar.contains(event.target as Node)) return;
      if (bar.querySelector("input")?.value) return;
      setOpenOn(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Open search"
        aria-expanded={open}
        onClick={() => setOpenOn(pathname)}
        className={cn("header-icon-button", className)}
      >
        <Search aria-hidden="true" className="size-6" />
      </button>

      {open && (
        <div
          ref={barRef}
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
          // Tabbing out of an empty bar also closes it.
          onBlur={(event) => {
            const next = event.relatedTarget as Node | null;
            if (!next || event.currentTarget.contains(next)) return;
            if (event.currentTarget.querySelector("input")?.value) return;
            setOpenOn(null);
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
            className="header-icon-button"
          >
            <X aria-hidden="true" className="size-6" />
          </button>
        </div>
      )}
    </>
  );
}
