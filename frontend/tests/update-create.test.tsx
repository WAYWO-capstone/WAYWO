// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CreateUpdateForm } from "@/components/projects/create-update-form";
import { UpdateHistory } from "@/components/projects/update-history";
import type { ProjectUpdate } from "@/api/models";

const navigate = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, search, ...props }: { children: ReactNode; to: string; search?: Record<string, string> }) => (
    <a href={`${to}?${new URLSearchParams(search)}`} {...props}>{children}</a>
  ),
  useNavigate: () => navigate,
}));

const created: ProjectUpdate = {
  id: "u1",
  project_id: "p1",
  author_id: "a1",
  title: "Base finished",
  body: "Finished the base.",
  type: "DECISION",
  public: true,
  created_at: "2026-05-14T12:00:00Z",
  updated_at: "2026-05-14T12:00:00Z",
  author: { username: "Anna Ji", profile_picture_link: null },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function historyResponse(items: ProjectUpdate[] = []) {
  return json({ items, total: items.length, limit: 20, offset: 0 });
}

function posts(fetchMock: ReturnType<typeof vi.fn>) {
  return Promise.all(
    fetchMock.mock.calls
      .map(([request]) => request as Request)
      .filter((request) => request.method === "POST")
      .map(async (request) => [new URL(request.url).pathname, JSON.parse(await request.clone().text())]),
  );
}

function renderWithQueries(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function fillIn({ title = "", body = "", type }: { title?: string; body?: string; type?: string }) {
  if (title) fireEvent.change(screen.getByLabelText(/Update title/), { target: { value: title } });
  if (body) fireEvent.change(screen.getByLabelText(/Detailed content/), { target: { value: body } });
  if (type) fireEvent.click(screen.getByRole("radio", { name: type }));
}

const postButton = () => screen.getByRole("button", { name: /Post update|Posting/ });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  navigate.mockReset();
  fetchMock = vi.fn(async () => historyResponse());
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("add update form", () => {
  test("starts with no type chosen and no errors showing", () => {
    renderWithQueries(<CreateUpdateForm projectId="p1" />);
    for (const radio of screen.getAllByRole("radio")) expect((radio as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByText("Choose an update type")).toBeNull();
  });

  test("shows an error under every invalid field and sends nothing", async () => {
    renderWithQueries(<CreateUpdateForm projectId="p1" />);
    fillIn({ title: "ab" });
    fireEvent.click(postButton());

    expect(screen.getByText("Title needs at least 3 characters")).toBeTruthy();
    expect(screen.getByText("Choose an update type")).toBeTruthy();
    expect(screen.getByText("Add a description")).toBeTruthy();
    const title = screen.getByLabelText(/Update title/);
    expect(title.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(title);
    expect(await posts(fetchMock)).toEqual([]);
  });

  test("clears each error as the field is fixed", () => {
    renderWithQueries(<CreateUpdateForm projectId="p1" />);
    fireEvent.click(postButton());
    fillIn({ type: "Problem" });
    expect(screen.queryByText("Choose an update type")).toBeNull();
    expect(screen.getByText("Add a description")).toBeTruthy();
  });

  test("posts the trimmed update, refreshes the history and goes back to the project", async () => {
    fetchMock.mockImplementation(async (request: Request) =>
      request.method === "POST" ? json(created, 201) : historyResponse(),
    );
    renderWithQueries(<CreateUpdateForm projectId="p1" />);
    fillIn({ title: "  Base finished ", body: " Finished the base. ", type: "Decision" });
    fireEvent.click(postButton());

    expect(postButton().textContent).toContain("Posting...");
    expect(screen.getByLabelText(/Update title/).matches(":disabled")).toBe(true);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/view-project", search: { projectId: "p1" } }));
    expect(await posts(fetchMock)).toEqual([["/api/projects/p1/updates", { title: "Base finished", body: "Finished the base.", type: "DECISION", references: [] }]]);
    expect(fetchMock.mock.calls.filter(([request]) => (request as Request).method === "GET")).toHaveLength(1);
  });

  test("keeps what was typed and explains when the server refuses", async () => {
    fetchMock.mockImplementation(async (request: Request) =>
      request.method === "POST"
        ? json({ detail: "You do not own this project" }, 403)
        : historyResponse(),
    );
    renderWithQueries(<CreateUpdateForm projectId="p1" />);
    fillIn({ title: "Base finished", body: "Finished the base.", type: "Solution" });
    fireEvent.click(postButton());

    expect((await screen.findByRole("alert")).textContent).toContain("You can only add updates to your own projects.");
    expect((screen.getByLabelText(/Update title/) as HTMLInputElement).value).toBe("Base finished");
    expect(postButton().textContent).toBe("Post update");
    expect(navigate).not.toHaveBeenCalled();
  });

  test("adds a solution reference with its selected relationship reason", async () => {
    const problem = { ...created, id: "problem-1", title: "Bridge is unstable", type: "PROBLEM" as const };
    fetchMock.mockImplementation(async (request: Request) =>
      request.method === "POST" ? json(created, 201) : historyResponse([problem]),
    );
    renderWithQueries(<CreateUpdateForm projectId="p1" />);
    fillIn({ title: "New support", body: "Added a support beam.", type: "Solution" });

    fireEvent.focus(screen.getByLabelText("Search updates to link"));
    fireEvent.click(await screen.findByRole("option", { name: /Bridge is unstable/ }));
    fireEvent.change(screen.getByLabelText("Relationship to Bridge is unstable"), { target: { value: "SOLVES" } });
    fireEvent.click(postButton());

    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(await posts(fetchMock)).toEqual([[
      "/api/projects/p1/updates",
      {
        title: "New support",
        body: "Added a support beam.",
        type: "SOLUTION",
        references: [{ target_update_id: "problem-1", reason: "SOLVES" }],
      },
    ]]);
  });

  test("Cancel returns to the project without posting", () => {
    renderWithQueries(<CreateUpdateForm projectId="p1" />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(navigate).toHaveBeenCalledWith({ to: "/view-project", search: { projectId: "p1" } });
    expect(fetchMock.mock.calls.some(([request]) => (request as Request).method === "POST")).toBe(false);
  });
});

describe("add update entry point", () => {
  test("only the project owner sees Add update", async () => {
    fetchMock.mockImplementation(async () => json({ items: [], total: 0, limit: 20, offset: 0 }));
    renderWithQueries(<UpdateHistory projectId="p1" />);
    expect(screen.queryByRole("link", { name: "Add update" })).toBeNull();
    cleanup();

    renderWithQueries(<UpdateHistory projectId="p1" canManage />);
    expect(screen.getByRole("link", { name: "Add update" }).getAttribute("href")).toBe("/add-update?projectId=p1");
  });
});
