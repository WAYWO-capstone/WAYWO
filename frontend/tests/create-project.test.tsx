// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CreateProjectForm } from "../src/components/projects/create-project-form";
import { clearTokens, saveTokens } from "../src/lib/token-store";

const navigate = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

const userId = "00000000-0000-4000-8000-000000000001";
const category = { id: "00000000-0000-4000-8000-000000000002", name: "Woodworking", description: "Wood projects." };
const categories = [category];
const createdProject = {
  id: "00000000-0000-4000-8000-000000000003",
  author_id: userId,
  title: "Oak stool",
  summary: "A small stool for the workshop.",
  description: "Built from reclaimed oak.",
  category,
  tags: [],
  status: "DRAFT",
  public: false,
  published_at: null,
  completed_at: null,
  last_autosaved_at: null,
  created_at: "2026-11-09T12:00:00Z",
};

function jwt(sub: string) {
  const payload = btoa(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + 1800 }));
  return `header.${payload}.signature`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><CreateProjectForm /></QueryClientProvider>);
}

async function fillProject({ selectCategory = true, title = "Oak stool" }: { selectCategory?: boolean; title?: string } = {}) {
  fireEvent.change(screen.getByLabelText(/Project title/), { target: { value: title } });
  fireEvent.change(screen.getByLabelText(/Summary/), { target: { value: "A small stool for the workshop." } });
  fireEvent.change(screen.getByLabelText(/Description/), { target: { value: "Built from reclaimed oak." } });

  const selector = await screen.findByRole("combobox", { name: "Search categories" });
  if (selectCategory) {
    fireEvent.focus(selector);
    fireEvent.click(await screen.findByRole("option", { name: "Woodworking" }));
  }
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
let accessToken: string;

beforeEach(() => {
  navigate.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  accessToken = jwt(userId);
  saveTokens({ accessToken, refreshToken: jwt(userId) }, true);
  fetchMock = vi.fn<typeof fetch>(async (input) => {
    const request = input as Request;
    if (new URL(request.url).pathname === "/api/projects/categories") return json(categories);
    if (request.method === "POST" && new URL(request.url).pathname === "/api/projects") return json(createdProject);
    if (request.method === "DELETE" && new URL(request.url).pathname === "/api/projects/" + createdProject.id) return new Response(null, { status: 204 });
    return json({ detail: "Unexpected request" }, 500);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  clearTokens();
  vi.unstubAllGlobals();
});

describe("creating a project", () => {
  test("creates a project with valid information", async () => {
    renderForm();
    await fillProject();
    fireEvent.submit(screen.getByRole("button", { name: "Save as draft" }).closest("form")!);

    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => (input as Request).method === "POST")).toBe(true));
    const request = fetchMock.mock.calls
      .map(([input]) => input as Request)
      .find((item) => item.method === "POST")!;
    expect(new URL(request.url).pathname).toBe("/api/projects");
    expect(await request.clone().json()).toEqual({
      title: "Oak stool",
      summary: "A small stool for the workshop.",
      description: "Built from reclaimed oak.",
      category_id: category.id,
      tags: [],
    });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/projects" }));
  });

  test("does not create a project when required information is missing", async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Project title/), { target: { value: "Oak stool" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save as draft" }).closest("form")!);

    expect((await screen.findByRole("alert")).textContent).toContain("Choose a category");
    expect(fetchMock.mock.calls.some(([input]) => (input as Request).method === "POST")).toBe(false);
  });

  test("rejects invalid project information", async () => {
    renderForm();
    await fillProject({ title: "   " });
    fireEvent.submit(screen.getByRole("button", { name: "Save as draft" }).closest("form")!);

    expect((await screen.findByRole("alert")).textContent).toContain("Fill in the title and summary");
    expect(fetchMock.mock.calls.some(([input]) => (input as Request).method === "POST")).toBe(false);
  });

  test("accepts a selected valid category", async () => {
    renderForm();
    await fillProject();

    expect((screen.getByRole("combobox", { name: "Search categories" }) as HTMLInputElement).value).toBe("Woodworking");
    expect(fetchMock.mock.calls.some(([input]) => (input as Request).method === "POST")).toBe(false);
  });

  test("sends the authenticated user token and leaves ownership to the server", async () => {
    renderForm();
    await fillProject();
    fireEvent.submit(screen.getByRole("button", { name: "Save as draft" }).closest("form")!);

    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => (input as Request).method === "POST")).toBe(true));
    const request = fetchMock.mock.calls.map(([input]) => input as Request).find((item) => item.method === "POST")!;
    expect(request.headers.get("Authorization")).toBe(`Bearer ${accessToken}`);
    expect(await request.clone().json()).not.toHaveProperty("author_id");
    expect(createdProject.author_id).toBe(userId);
  });

  test("shows an authentication error when an unauthenticated create is rejected", async () => {
    clearTokens();
    fetchMock.mockImplementation(async (input) => {
      const request = input as Request;
      if (new URL(request.url).pathname === "/api/projects/categories") return json(categories);
      if (request.method === "POST" && new URL(request.url).pathname === "/api/projects") return json({ detail: "Not authenticated" }, 401);
      return json({ detail: "Unexpected request" }, 500);
    });
    renderForm();
    await fillProject();
    fireEvent.submit(screen.getByRole("button", { name: "Save as draft" }).closest("form")!);

    expect((await screen.findByRole("alert")).textContent).toMatch(/session has expired/i);
    const request = fetchMock.mock.calls.map(([input]) => input as Request).find((item) => item.method === "POST")!;
    expect(request.headers.has("Authorization")).toBe(false);
  });

  test("creates a project as a private draft without publishing it", async () => {
    renderForm();
    await fillProject();
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/projects" }));
    expect(createdProject.status).toBe("DRAFT");
    expect(createdProject.public).toBe(false);
    expect(fetchMock.mock.calls.map(([input]) => (input as Request).url).filter((url) => url.includes("/publish"))).toEqual([]);
  });

  test("keeps the form unchanged when cancel is dismissed", async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Project title/), { target: { value: "Unfinished stool" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect((screen.getByLabelText(/Project title/) as HTMLInputElement).value).toBe("Unfinished stool");
    expect(fetchMock.mock.calls.some(([input]) => (input as Request).method !== "GET")).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  test("deletes an autosaved draft after cancel is confirmed", async () => {
    renderForm();
    await fillProject();
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => (input as Request).method === "POST")).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("autosaved draft will be deleted");
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => (input as Request).method === "DELETE")).toBe(true));
    const deletion = fetchMock.mock.calls.map(([input]) => input as Request).find((item) => item.method === "DELETE")!;
    expect(new URL(deletion.url).pathname).toBe("/api/projects/" + createdProject.id);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/projects" }));
  });
});
