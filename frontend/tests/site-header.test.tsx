// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SiteHeader } from "@/components/ui/site-header";

const router = vi.hoisted(() => ({ pathname: "/home" }));
const auth = vi.hoisted(() => ({ isAuthenticated: false, logout: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: router.pathname } }),
}));

vi.mock("@/lib/auth", () => ({
  useIsAuthenticated: () => auth.isAuthenticated,
  useCurrentProfile: () => ({ data: undefined }),
  useLogout: () => auth.logout,
}));

beforeEach(() => {
  router.pathname = "/home";
  auth.isAuthenticated = false;
  auth.logout.mockReset();
});

afterEach(cleanup);

async function openMenu(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
  return screen.findAllByRole("menuitem");
}

function openSearch() {
  fireEvent.click(screen.getByRole("button", { name: "Open search" }));
  const bar = screen.getByRole("button", { name: "Close search" }).parentElement!;
  return within(bar).getByRole("searchbox") as HTMLInputElement;
}

const searchIsOpen = () => screen.queryByRole("button", { name: "Close search" }) !== null;

describe("SiteHeader", () => {
  test("logged out: marks the current tab and shows the auth links", async () => {
    router.pathname = "/explore";
    render(<SiteHeader />);

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Explore" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Sign up" }).getAttribute("href")).toBe("/register");

    const items = await openMenu("Open navigation menu");
    expect(items.map((item) => item.textContent)).toEqual(["Home", "My Projects", "Explore", "Log in", "Sign up"]);
  });

  test("logged in: shows the profile menu instead of the auth links", async () => {
    auth.isAuthenticated = true;
    render(<SiteHeader />);

    expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
    expect((await openMenu("Open navigation menu")).map((item) => item.textContent)).toEqual([
      "Home",
      "My Projects",
      "Explore",
    ]);

    await openMenu("Open profile menu");
    fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));
    expect(auth.logout).toHaveBeenCalledOnce();
  });
});

describe("SiteHeader search bar", () => {
  test("opens focused and closes on Escape, returning focus to the button", async () => {
    render(<SiteHeader />);
    const input = openSearch();
    expect(document.activeElement).toBe(input);

    fireEvent.keyDown(input, { key: "Escape" });
    expect(searchIsOpen()).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open search" })));
  });

  test("closes on an outside click only while empty", () => {
    render(<SiteHeader />);
    const input = openSearch();

    fireEvent.change(input, { target: { value: "lamp" } });
    fireEvent.pointerDown(document.body);
    expect(searchIsOpen()).toBe(true);

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.pointerDown(document.body);
    expect(searchIsOpen()).toBe(false);
  });

  // In Safari, tapping the X blurs the input with no new focus target,
  // so that alone must not close the bar.
  test("closes when focus moves outside, but not when it moves to nothing", () => {
    render(<SiteHeader />);
    const input = openSearch();

    fireEvent.blur(input, { relatedTarget: null });
    expect(searchIsOpen()).toBe(true);

    fireEvent.blur(input, { relatedTarget: screen.getByRole("link", { name: "Log in" }) });
    expect(searchIsOpen()).toBe(false);
  });

  test("closes when moving to another page", () => {
    const { rerender } = render(<SiteHeader />);
    openSearch();

    router.pathname = "/explore";
    rerender(<SiteHeader />);
    expect(searchIsOpen()).toBe(false);
  });
});
