/**
 * Top navigation bar shown on every page
 * Holds the logo; explore, projects and community links; search; Log in and Sign up buttons,
 */

import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut, Search } from "lucide-react";

import logo from "@/assets/waywo-logo.png";
import { buttonVariants } from "@/components/ui/button";
import { HeaderProfileMenu } from "@/components/ui/header-profile-menu";
import { Input } from "@/components/ui/input";
import { useIsAuthenticated, useLogout } from "@/lib/auth";
import { cn } from "@/lib/utils";

// TODO: point these links once those pages exist (for future)
const NAV_ITEMS = ["Explore", "Projects", "Community"];

const authButtonClass =
  "h-10 rounded-xl px-4 font-semibold sm:h-12 sm:px-7 sm:text-base";

export function SiteHeader() {
  const isAuthenticated = useIsAuthenticated();
  const logout = useLogout();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  // The current page button is the filled one
  const onLoginPage = pathname === "/login";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-22 max-w-7xl items-center gap-6 px-4 sm:px-8">
        <Link to="/" className="shrink-0">
          <img src={logo} alt="WAYWO home" className="h-24 w-auto" />
        </Link>

        <nav aria-label="Main" className="ml-14 hidden gap-12 lg:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item}
              to="/"
              className="text-lg font-semibold hover:text-brand-rust"
            >
              {item}
            </Link>
          ))}
        </nav>

        <form
          role="search"
          onSubmit={(event) => event.preventDefault()}
          className="relative ml-auto hidden w-75 md:block"
        >
          <Input
            type="search"
            aria-label="Search projects and creators"
            placeholder="Search creations..."
            className="pl-12"
          />
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
        </form>

        <div className="ml-auto flex items-center gap-2 sm:gap-4 md:ml-6">
          
          {isAuthenticated && <HeaderProfileMenu />}
          {isAuthenticated ? (
            <button
              type="button"
              onClick={logout}
              className={cn(
                buttonVariants({ variant: "outline" }),
                authButtonClass,
              )}
            >
              <LogOut className="size-4" />
              Log out
            </button>
          ) : (
            <>
              <Link
                to="/login"
                className={cn(
                  buttonVariants({
                    variant: onLoginPage ? "default" : "outline",
                  }),
                  authButtonClass,
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