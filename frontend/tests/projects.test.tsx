// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Route } from "@/routes/projects";

vi.mock("@/api/projects", () => ({
  getMyDrafts: vi.fn().mockResolvedValue([]),
  getMyPublishedProjects: vi.fn().mockResolvedValue([]),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("shows the visibility note only on the Drafts tab, even with no drafts", async () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const root = createRootRoute();
  const projects = createRoute({
    getParentRoute: () => root,
    path: "/projects",
    component: Route.options.component,
  });
  const router = createRouter({
    routeTree: root.addChildren([projects]),
    history: createMemoryHistory({ initialEntries: ["/projects"] }),
  });
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  await screen.findByText("No published projects yet");
  const note = "Only you can see your drafts.";
  expect(screen.queryByText(note)).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Draft projects" }));
  const drafts = within(screen.getByRole("region", { name: "Draft projects" }));
  expect(await drafts.findByText("No draft projects yet")).toBeTruthy();
  expect(drafts.getByText(note)).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Published projects" }));
  expect(screen.queryByText(note)).toBeNull();
});
