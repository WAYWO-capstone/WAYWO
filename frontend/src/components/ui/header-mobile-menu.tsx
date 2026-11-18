/**
 * Hamburger menu that replaces the main nav links on small screens.
 * On phones it also holds Log in and Sign up, which are hidden from the header there.
 */

import { Menu } from "@base-ui/react/menu";
import { Link } from "@tanstack/react-router";
import { Menu as MenuIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import "./header.css";

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

const itemClass = "header-menu-item py-2.5 text-base font-semibold";

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
          "header-icon-button max-xs:order-last",
          className,
        )}
      >
        <MenuIcon aria-hidden="true" className="size-6" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="start" sideOffset={8} className="z-50">
          <Menu.Popup className="header-menu-popup min-w-48">
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
                <Menu.Separator className="header-menu-separator xs:hidden" />
                <Menu.LinkItem
                  closeOnClick
                  render={<Link to="/login" />}
                  className={cn(itemClass, "xs:hidden")}
                >
                  Log in
                </Menu.LinkItem>
                <Menu.LinkItem
                  closeOnClick
                  render={<Link to="/register" />}
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
