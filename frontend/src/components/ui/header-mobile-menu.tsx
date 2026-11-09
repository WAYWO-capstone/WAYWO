/**
 * Hamburger menu that replaces the main nav links on small screens.
 * On phones it also holds Log in and Sign up, which are hidden from the header there.
 */

import { Menu } from "@base-ui/react/menu";
import { Link } from "@tanstack/react-router";
import { Menu as MenuIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  to: string;
}

interface HeaderMobileMenuProps {
  items: readonly NavItem[];
  pathname: string;
  showAuthLinks: boolean;
  // Sets the width where the button hides, e.g. "lg:hidden".
  className?: string;
}

const itemClass =
  "flex cursor-pointer items-center rounded-lg px-3 py-2.5 text-base font-semibold outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground";

export function HeaderMobileMenu({
  items,
  pathname,
  showAuthLinks,
  className,
}: HeaderMobileMenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger
        type="button"
        aria-label="Open navigation menu"
        className={cn(
          "inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring max-xs:order-last",
          className,
        )}
      >
        <MenuIcon aria-hidden="true" className="size-6" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="start" sideOffset={8} className="z-50">
          <Menu.Popup className="min-w-48 rounded-xl border bg-background p-1.5 text-foreground shadow-lg outline-none">
            {items.map((item) => (
              <Menu.LinkItem
                key={item.label}
                closeOnClick
                render={<Link to={item.to} />}
                aria-current={pathname === item.to ? "page" : undefined}
                className={cn(itemClass, pathname === item.to && "text-brand-rust")}
              >
                {item.label}
              </Menu.LinkItem>
            ))}

            {/* Phones only: the header has no room for these buttons. */}
            {showAuthLinks && (
              <>
                <Menu.Separator className="my-1.5 h-px bg-border xs:hidden" />
                <Menu.LinkItem
                  closeOnClick
                  render={<Link to="/login" />}
                  className={cn(itemClass, "xs:hidden")}
                >
                  Log in
                </Menu.LinkItem>
                <Menu.LinkItem
                  closeOnClick
                  render={<a href="/register" />}
                  className={cn(itemClass, "xs:hidden")}
                >
                  Sign up
                </Menu.LinkItem>
              </>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
