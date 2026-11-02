// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EditUpdateForm } from "@/components/projects/edit-update-form";
import { UpdateHistory } from "@/components/projects/update-history";
import { UpdateTimeline } from "@/components/projects/update-item";
import type { ProjectUpdate } from "@/lib/api";

const navigate = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, search, ...props }: { children: ReactNode; to: string; search?: Record<string, string> }) => (
    <a href={`${to}?${new URLSearchParams(search)}`} {...props}>{children}</a>
  ),
  useNavigate: () => navigate,
}));

const project = { id: "p1", title: "A cool project", summary: "A cool summary.", status: "DRAFT" as const };

function makeUpdate(overrides: Partial<ProjectUpdate> = {}): ProjectUpdate {
  return {
    id: "u1",
    project_id: "p1",
    author_id: "a1",
    title: "Base finished",
    body: "Finished the base.",
    type: "PROGRESS",
    public: true,
    created_at: "2026-05-14T12:00:00Z",
    updated_at: "2026-05-14T12:00:00Z",
    author: { username: "Anna Ji", profile_picture_link: null },
    ...overrides,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

// The requests that change data, as [method, path, parsed body].
function writes(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method && init.method !== "GET")
    .map(([url, init]) => [init.method, url, init.body ? JSON.parse(init.body) : undefined]);
}

function renderWithQueries(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  navigate.mockReset();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("update card", () => {
  test("only shows Edit and Delete to someone who can manage the update", () => {
    renderWithQueries(<UpdateTimeline updates={[makeUpdate()]} />);
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(screen.queryByRole("link", { name: /edit/i })).toBeNull();
    cleanup();

    renderWithQueries(<UpdateTimeline updates={[makeUpdate()]} canManage />);
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /edit/i }).getAttribute("href")).toBe("/edit-update?projectId=p1&updateId=u1");
  });

  test("shows the edited date only after an edit", () => {
    renderWithQueries(<UpdateTimeline updates={[makeUpdate()]} />);
    expect(screen.getByText(/^Posted on/)).toBeTruthy();
    expect(screen.queryByText(/^Edited/)).toBeNull();
    cleanup();

    renderWithQueries(<UpdateTimeline updates={[makeUpdate({ updated_at: "2026-05-20T12:00:00Z" })]} />);
    expect(screen.getByText(/^Edited/)).toBeTruthy();
  });
});

describe("deleting an update", () => {
  function historyResponse(items: ProjectUpdate[]) {
    return json({ items, total: items.length, limit: 20, offset: 0 });
  }

  async function openDialog() {
    renderWithQueries(<UpdateHistory projectId="p1" canManage />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    return screen.findByRole("dialog");
  }

  test("asks for confirmation, and Cancel deletes nothing", async () => {
    fetchMock.mockImplementation(async () => historyResponse([makeUpdate()]));

    const dialog = await openDialog();
    expect(within(dialog).getByText(/permanent/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(writes(fetchMock)).toEqual([]);
    expect(screen.getByText("Base finished")).toBeTruthy();
  });

  test("confirming deletes the update and removes it from the history", async () => {
    let items = [makeUpdate()];
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        items = [];
        return new Response(null, { status: 204 });
      }
      return historyResponse(items);
    });

    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete update" }));

    await screen.findByText("No updates yet.");
    expect(writes(fetchMock)).toEqual([["DELETE", "/api/projects/p1/updates/u1", undefined]]);
  });

  test("keeps the update and explains when the server refuses", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === "DELETE" ? json({ detail: "You do not own this update" }, 403) : historyResponse([makeUpdate()]),
    );

    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete update" }));

    expect((await within(dialog).findByRole("alert")).textContent).toContain("You can only change your own updates.");
    expect(screen.getByRole("heading", { name: "Base finished", hidden: true })).toBeTruthy();
  });
});

describe("editing an update", () => {
  function renderForm() {
    renderWithQueries(<EditUpdateForm project={project} update={makeUpdate()} />);
  }

  test("is pre-filled, and saving is unavailable until something changes", () => {
    renderForm();

    expect((screen.getByLabelText(/Update title/) as HTMLInputElement).value).toBe("Base finished");
    expect((screen.getByLabelText(/Detailed content/) as HTMLTextAreaElement).value).toBe("Finished the base.");
    expect((screen.getByRole("radio", { name: "Progress" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("Save changes sends only the changed fields and stays on the page", async () => {
    fetchMock.mockImplementation(async () => json(makeUpdate({ title: "New title", type: "DECISION" })));
    renderForm();

    fireEvent.change(screen.getByLabelText(/Update title/), { target: { value: "  New title " } });
    fireEvent.click(screen.getByRole("radio", { name: "Decision" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await screen.findByRole("status");
    expect(writes(fetchMock)).toEqual([["PATCH", "/api/projects/p1/updates/u1", { title: "New title", type: "DECISION" }]]);
    expect((screen.getByLabelText(/Update title/) as HTMLInputElement).value).toBe("New title");
    expect(navigate).not.toHaveBeenCalled();
  });

  test("Save & close returns to the project", async () => {
    fetchMock.mockImplementation(async () => json(makeUpdate({ body: "More detail." })));
    renderForm();

    fireEvent.change(screen.getByLabelText(/Detailed content/), { target: { value: "More detail." } });
    fireEvent.click(screen.getByRole("button", { name: "Save & close" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/view-project", search: { projectId: "p1" } }));
    expect(writes(fetchMock)).toEqual([["PATCH", "/api/projects/p1/updates/u1", { body: "More detail." }]]);
  });

  test("does not send blank required fields", () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/Detailed content/), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByRole("alert").textContent).toContain("Fill in the title and content");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("keeps what was typed and explains when the server refuses", async () => {
    fetchMock.mockImplementation(async () => json({ detail: "You do not own this update" }, 403));
    renderForm();

    fireEvent.change(screen.getByLabelText(/Update title/), { target: { value: "New title" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect((await screen.findByRole("alert")).textContent).toContain("You can only change your own updates.");
    expect((screen.getByLabelText(/Update title/) as HTMLInputElement).value).toBe("New title");
  });

  test("Cancel leaves without saving", () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/Update title/), { target: { value: "New title" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith({ to: "/view-project", search: { projectId: "p1" } });
  });
});
