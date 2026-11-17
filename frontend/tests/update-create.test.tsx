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
  Link: ({
    children,
    to,
    search,
    resetScroll: _resetScroll,
    ...props
  }: {
    children: ReactNode;
    to: string;
    search?: Record<string, string>;
    resetScroll?: boolean;
  }) => (
    <a href={`${to}?${new URLSearchParams(search)}`} {...props}>
      {children}
    </a>
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
let scrollTo: ReturnType<typeof vi.fn>;
let originalScrollTo: typeof HTMLElement.prototype.scrollTo | undefined;
let originalLocation: string;

beforeEach(() => {
  navigate.mockReset();
  fetchMock = vi.fn(async () => historyResponse());
  vi.stubGlobal("fetch", fetchMock);
  originalLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  originalScrollTo = HTMLElement.prototype.scrollTo;
  scrollTo = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scrollTo,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", originalLocation);
  if (originalScrollTo) {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: originalScrollTo,
    });
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollTo");
  }
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
  test("finds a linked update beyond the first history page", async () => {
    const first = { ...created, id: "first", title: "First update" };
    const target = { ...created, id: "target", title: "Linked update" };
    const offsets: number[] = [];
    fetchMock.mockImplementation(async (request: Request) => {
      const offset = Number(new URL(request.url).searchParams.get("offset"));
      offsets.push(offset);
      return json({
        items: offset === 0 ? [first] : [target],
        total: 2,
        limit: 20,
        offset,
      });
    });

    renderWithQueries(
      <UpdateHistory projectId="p1" targetUpdateId="target" />,
    );

    expect(
      await screen.findByRole("heading", { name: "Linked update" }),
    ).toBeTruthy();
    expect(offsets).toEqual([0, 1]);
    expect(document.getElementById("update-target")).toBeTruthy();
    expect(document.activeElement).toBe(document.getElementById("update-target"));
  });

  test("does not resume target lookup after filtering out a found update", async () => {
    const target = {
      ...created,
      id: "target",
      title: "Linked update",
      type: "DECISION" as const,
    };
    const problem = {
      ...created,
      id: "problem",
      title: "Other problem",
      type: "PROBLEM" as const,
    };
    const anotherProblem = {
      ...created,
      id: "another-problem",
      title: "Another problem",
      type: "PROBLEM" as const,
    };
    const requestedOffsets: number[] = [];
    fetchMock.mockImplementation(async (request: Request) => {
      const url = new URL(request.url);
      const offset = Number(url.searchParams.get("offset"));
      requestedOffsets.push(offset);
      if (url.searchParams.get("filter") === "PROBLEM") {
        return json({
          items: offset === 0 ? [problem] : [anotherProblem],
          total: 2,
          limit: 20,
          offset,
        });
      }
      return json({ items: [target, problem], total: 2, limit: 20, offset });
    });

    renderWithQueries(
      <UpdateHistory projectId="p1" targetUpdateId="target" />,
    );
    expect(
      await screen.findByRole("heading", { name: "Linked update" }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Filter updates by type" }),
    );
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Problem" }));

    expect(
      await screen.findByRole("heading", { name: "Other problem" }),
    ).toBeTruthy();
    expect(
      await screen.findByRole("button", { name: "Load more updates" }),
    ).toBeTruthy();
    expect(
      screen.queryByText("The linked update could not be found in this project."),
    ).toBeNull();
    expect(requestedOffsets).toEqual([0, 0]);
  });

  test("re-clicking the current target scrolls within the updates list", async () => {
    const source = {
      ...created,
      id: "source",
      title: "Source update",
      outgoing_references: [
        {
          linked_update_id: "target",
          title: "Linked update",
          type: "PROGRESS" as const,
          reason: "RELATED_TO" as const,
        },
      ],
    };
    const target = { ...created, id: "target", title: "Linked update" };
    fetchMock.mockImplementation(async () =>
      json({ items: [source, target], total: 2, limit: 20, offset: 0 }),
    );
    window.history.replaceState(
      null,
      "",
      "/?projectId=p1&updateId=target",
    );

    renderWithQueries(
      <UpdateHistory projectId="p1" targetUpdateId="target" />,
    );
    await screen.findByRole("heading", { name: "Linked update" });
    const scrollContainer = document.querySelector<HTMLElement>(
      "[data-update-history-scroll-container]",
    )!;
    const targetElement = document.getElementById("update-target")!;
    const rect = (top: number, height: number) =>
      ({
        top,
        bottom: top + height,
        left: 0,
        right: 300,
        width: 300,
        height,
        x: 0,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;
    vi.spyOn(scrollContainer, "getBoundingClientRect").mockReturnValue(
      rect(100, 100),
    );
    const targetRect = vi
      .spyOn(targetElement, "getBoundingClientRect")
      .mockReturnValue(rect(50, 40));
    Object.defineProperties(scrollContainer, {
      scrollTop: { configurable: true, writable: true, value: 200 },
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 500 },
    });

    fireEvent.click(
      screen.getByRole("link", {
        name: "Related to Linked update Progress",
      }),
    );

    expect(scrollTo).toHaveBeenLastCalledWith({
      top: 138,
      behavior: "smooth",
    });
    scrollContainer.scrollTop = 0;
    targetRect.mockReturnValue(rect(220, 40));
    fireEvent.click(
      screen.getByRole("link", {
        name: "Related to Linked update Progress",
      }),
    );

    expect(scrollTo).toHaveBeenLastCalledWith({
      top: 72,
      behavior: "smooth",
    });
    expect(window.location.search).toBe("?projectId=p1&updateId=target");
    expect(document.activeElement).toBe(targetElement);
  });

  test("only the project owner sees Add update", async () => {
    fetchMock.mockImplementation(async () => json({ items: [], total: 0, limit: 20, offset: 0 }));
    renderWithQueries(<UpdateHistory projectId="p1" />);
    expect(screen.queryByRole("link", { name: "Add update" })).toBeNull();
    cleanup();

    renderWithQueries(<UpdateHistory projectId="p1" canManage />);
    expect(screen.getByRole("link", { name: "Add update" }).getAttribute("href")).toBe("/add-update?projectId=p1");
  });
});
