// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ProjectView } from "../src/api/models";
import { EditProjectForm } from "../src/components/projects/edit-project-form";
import { clearTokens, saveTokens } from "../src/lib/token-store";

const navigate = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => navigate,
}));

const project: ProjectView = {
  id: "00000000-0000-4000-8000-000000000003",
  author_id: "00000000-0000-4000-8000-000000000001",
  title: "Oak stool",
  summary: "A small stool for the workshop.",
  description: "Built from reclaimed oak.",
  category: { id: "00000000-0000-4000-8000-000000000002", name: "Woodworking", description: "Wood projects." },
  tags: [],
  status: "ACTIVE",
  public: true,
  published_at: "2026-11-01T12:00:00Z",
  completed_at: null,
  last_autosaved_at: null,
  created_at: "2026-11-01T12:00:00Z",
  is_owner: true,
  author: { username: "maker", profile_picture_link: null },
};

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
let savedProject: ProjectView;
let accessToken: string;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function jwt(sub: string) {
  const payload = btoa(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + 1800 }));
  return `header.${payload}.signature`;
}

async function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><EditProjectForm project={project} /></QueryClientProvider>);
  await screen.findByRole("combobox", { name: "Search categories" });
}

beforeEach(() => {
  navigate.mockReset();
  savedProject = { ...project };
  accessToken = jwt(project.author_id);
  localStorage.clear();
  sessionStorage.clear();
  saveTokens({ accessToken, refreshToken: jwt(project.author_id) }, true);
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const request = input as Request;
    if (new URL(request.url).pathname === "/api/projects/categories") {
      return json([project.category]);
    }
    if (request.method === "PATCH" && new URL(request.url).pathname === "/api/projects/" + project.id) {
      const changes = await request.clone().json() as Partial<ProjectView>;
      savedProject = { ...savedProject, ...changes };
      return json(savedProject);
    }
    return json({ detail: "Unexpected request" }, 500);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  clearTokens();
  vi.unstubAllGlobals();
});

describe("editing a project", () => {
  test("updates valid information and displays the saved values", async () => {
    await renderForm();
    fireEvent.change(screen.getByLabelText(/Project title/), { target: { value: "Changed stool" } });
    fireEvent.change(screen.getByLabelText(/Summary/), { target: { value: "A sturdier workshop stool." } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await screen.findByRole("status");
    expect(savedProject.title).toBe("Changed stool");
    expect(savedProject.summary).toBe("A sturdier workshop stool.");
    expect((screen.getByLabelText(/Project title/) as HTMLInputElement).value).toBe("Changed stool");
    expect((screen.getByLabelText(/Summary/) as HTMLInputElement).value).toBe("A sturdier workshop stool.");
    const request = fetchMock.mock.calls.map(([input]) => input as Request).find((item) => item.method === "PATCH");
    expect(request).toBeDefined();
    expect(new URL(request!.url).pathname).toBe("/api/projects/" + project.id);
    expect(await request!.clone().json()).toMatchObject({ title: "Changed stool", summary: "A sturdier workshop stool." });
    expect(navigate).not.toHaveBeenCalled();
  });

  test("rejects invalid information without sending an update", async () => {
    await renderForm();
    fireEvent.change(screen.getByLabelText(/Project title/), { target: { value: "   " } });
    fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).closest("form")!);

    expect((await screen.findByRole("alert")).textContent).toContain("Fill in the title, summary and category");
    expect(fetchMock.mock.calls.some(([input]) => (input as Request).method === "PATCH")).toBe(false);
  });

  test("shows an ownership error when the server refuses another user's edit", async () => {
    fetchMock.mockImplementation(async (input) => {
      const request = input as Request;
      if (new URL(request.url).pathname === "/api/projects/categories") return json([project.category]);
      return json({ detail: "You do not own this project" }, 403);
    });
    await renderForm();
    fireEvent.change(screen.getByLabelText(/Project title/), { target: { value: "Changed stool" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect((await screen.findByRole("alert")).textContent).toContain("You can only change your own projects.");
    expect((screen.getByLabelText(/Project title/) as HTMLInputElement).value).toBe("Changed stool");
  });

  test("shows an authentication error when an unauthenticated edit is rejected", async () => {
    clearTokens();
    fetchMock.mockImplementation(async (input) => {
      const request = input as Request;
      if (new URL(request.url).pathname === "/api/projects/categories") return json([project.category]);
      return json({ detail: "Not authenticated" }, 401);
    });
    await renderForm();
    fireEvent.change(screen.getByLabelText(/Project title/), { target: { value: "Changed stool" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/session has expired/i);
    const request = fetchMock.mock.calls.map(([input]) => input as Request).find((item) => item.method === "PATCH");
    expect(request).toBeDefined();
    expect(request!.headers.has("Authorization")).toBe(false);
  });

  test("Cancel opens the discard dialog and Keep editing retains project changes", async () => {
    await renderForm();
    fireEvent.change(screen.getByLabelText(/Project title/), { target: { value: "Changed stool" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("return to this project");
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect((screen.getByLabelText(/Project title/) as HTMLInputElement).value).toBe("Changed stool");
    expect(fetchMock.mock.calls.some(([input]) => (input as Request).method === "PATCH")).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
