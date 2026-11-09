/**
 * Top navigation bar shown on every page
 * Holds the logo; home, my projects and explore links; search; Log in and Sign up buttons or the profile menu.
 */

import { Link, useRouterState } from "@tanstack/react-router";

import logo from "@/assets/waywo-logo.png";
import { buttonVariants } from "@/components/ui/button";
import { HeaderMobileMenu } from "@/components/ui/header-mobile-menu";
import { HeaderProfileMenu } from "@/components/ui/header-profile-menu";
import {
  HeaderSearch,
  HeaderSearchButton,
} from "@/components/ui/header-search";
import { useIsAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Home", to: "/home" },
  { label: "My Projects", to: "/projects" },
  { label: "Explore", to: "/explore" },
] as const;

/**
 * Where the header switches layout.
 * Logged in, there are no Log in / Sign up buttons, so the tabs fit from 768px
 * as long as search stays a button until 1024px.
 * Logged out, the buttons take that space, so the tabs wait until 1024px.
 */
const BREAKPOINTS = {
  loggedIn: {
    tabs: "md:flex",
    menuButton: "md:hidden",
    searchBox: "lg:block",
    searchButton: "lg:hidden",
    actions: "lg:ml-6",
  },
  loggedOut: {
    tabs: "lg:flex",
    menuButton: "lg:hidden",
    searchBox: "md:block",
    searchButton: "md:hidden",
    actions: "md:ml-6",
  },
} as const;

const authButtonClass =
  "h-10 rounded-xl px-3 font-semibold sm:h-12 sm:px-7 sm:text-base";

export function SiteHeader() {
  const isAuthenticated = useIsAuthenticated();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const layout = isAuthenticated ? BREAKPOINTS.loggedIn : BREAKPOINTS.loggedOut;

  // The current page button is the filled one
  const onLoginPage = pathname === "/login";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="flex h-22 items-center gap-3 px-4 sm:gap-6 sm:px-8 lg:px-12">
        <Link to="/home" className="shrink-0">
          <img src={logo} alt="WAYWO home" className="h-20 w-auto sm:h-24" />
        </Link>

        {/* Takes the place of the nav links until they fit. */}
        <HeaderMobileMenu
          items={NAV_ITEMS}
          pathname={pathname}
          showAuthLinks={!isAuthenticated}
          className={layout.menuButton}
        />

        <nav
          aria-label="Main"
          className={cn("ml-4 hidden gap-8 xl:gap-12", layout.tabs)}
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              aria-current={pathname === item.to ? "page" : undefined}
              className={cn(
                "text-lg font-semibold whitespace-nowrap hover:text-brand-rust",
                pathname === item.to && "text-brand-rust",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <HeaderSearch className={cn("ml-auto hidden w-75", layout.searchBox)} />

        <div
          className={cn(
            "ml-auto flex items-center gap-2 sm:gap-4",
            layout.actions,
          )}
        >
          {/* Replaces the search box until it fits. */}
          <HeaderSearchButton className={layout.searchButton} />

          {isAuthenticated ? (
            <HeaderProfileMenu />
          ) : (
            <>
              {/* On phones goes the hamburger menu. */}
              <Link
                to="/login"
                className={cn(
                  buttonVariants({
                    variant: onLoginPage ? "default" : "outline",
                  }),
                  authButtonClass,
                  "hidden xs:inline-flex",
                )}
              >
                Log in
              </Link>
              <a
                href="/register"
                className={cn(
                  buttonVariants({
                    variant: onLoginPage ? "outline" : "default",
                  }),
                  authButtonClass,
                  "hidden xs:inline-flex",
                )}
              >
                Sign up
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
