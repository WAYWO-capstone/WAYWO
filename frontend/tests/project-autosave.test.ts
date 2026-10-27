import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { autosaveProject } from "../src/api/projects";
import type { ProjectInput } from "../src/api/models";
import { readDraftBackup, restorableDraftBackup, writeDraftBackup } from "../src/lib/draft-backup";
import { createProjectAutosave, savableFields } from "../src/lib/project-autosave";
import { clearTokens, getTokens, saveTokens } from "../src/lib/token-store";

// Browser storage isn't available in the test environment.
class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

function jwt(sub: string, expiresInSeconds: number, id = "") {
  const payload = btoa(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + expiresInSeconds, id }));
  return `header.${payload}.signature`;
}

function signIn(userId: string, accessExpiresIn = 1800) {
  saveTokens({ accessToken: jwt(userId, accessExpiresIn, "access"), refreshToken: jwt(userId, 30 * 86400, "refresh") }, true);
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const project: ProjectInput = { title: "Quilt", summary: "A warm quilt", description: "Squares", category_id: "c1", tags: [] };
const saved = { id: "p1", title: "Quilt", last_autosaved_at: "2026-10-20T12:00:00Z" };

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  vi.stubGlobal("localStorage", new MemoryStorage());
  vi.stubGlobal("sessionStorage", new MemoryStorage());
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  clearTokens();
  vi.unstubAllGlobals();
});

// The API client sends a Request object; these read the parts the tests check.
const sentRequest = (call: number) => fetchMock.mock.calls[call][0] as Request;
const requestUrls = () => fetchMock.mock.calls.map((_, call) => new URL(sentRequest(call).url).pathname);
const authHeader = (call: number) => sentRequest(call).headers.get("Authorization");

describe("project requests renew the session", () => {
  test("an expired access token is renewed before the request", async () => {
    signIn("user-1", -60);
    const fresh = jwt("user-1", 1800, "fresh");
    fetchMock
      .mockResolvedValueOnce(json({ access_token: fresh, refresh_token: jwt("user-1", 86400, "fresh-refresh") }))
      .mockResolvedValueOnce(json(saved));

    await autosaveProject("p1", project);

    expect(requestUrls()).toEqual(["/api/auth/refresh", "/api/projects/p1/autosave"]);
    expect(authHeader(1)).toBe(`Bearer ${fresh}`);
    expect(getTokens()?.accessToken).toBe(fresh);
  });

  test("a 401 renews the token and retries once", async () => {
    signIn("user-1");
    const fresh = jwt("user-1", 1800, "fresh");
    fetchMock
      .mockResolvedValueOnce(json({ detail: "expired" }, 401))
      .mockResolvedValueOnce(json({ access_token: fresh, refresh_token: jwt("user-1", 86400, "fresh-refresh") }))
      .mockResolvedValueOnce(json(saved));

    await expect(autosaveProject("p1", project)).resolves.toEqual(saved);
    expect(requestUrls()).toEqual(["/api/projects/p1/autosave", "/api/auth/refresh", "/api/projects/p1/autosave"]);
    expect(authHeader(2)).toBe(`Bearer ${fresh}`);
  });

  test("still fails with 401 when the session can't be renewed", async () => {
    signIn("user-1");
    fetchMock
      .mockResolvedValueOnce(json({ detail: "expired" }, 401))
      .mockResolvedValueOnce(json({ detail: "bad refresh token" }, 401));

    await expect(autosaveProject("p1", project)).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("requests failing at the same time renew the token once", async () => {
    signIn("user-1", -60);
    const fresh = jwt("user-1", 1800, "fresh");
    fetchMock.mockImplementation(async (input) => (input as Request).url.endsWith("/auth/refresh")
      ? json({ access_token: fresh, refresh_token: jwt("user-1", 86400, "fresh-refresh") })
      : json(saved));

    await Promise.all([autosaveProject("p1", project), autosaveProject("p2", project)]);
    expect(requestUrls().filter((url) => url.endsWith("/auth/refresh"))).toHaveLength(1);
  });
});

describe("savableFields", () => {
  test("leaves out empty required fields so the rest still saves", () => {
    expect(savableFields({ ...project, summary: "  ", category_id: "" })).toEqual({ title: "Quilt", description: "Squares", tags: [] });
    expect(savableFields(project)).toEqual(project);
  });
});

describe("createProjectAutosave", () => {
  const empty: ProjectInput = { title: "", summary: "", description: "", category_id: "", tags: [] };

  test("an existing draft keeps saving while a required field is empty", async () => {
    signIn("user-1");
    fetchMock.mockResolvedValue(json(saved));
    const autosave = createProjectAutosave({ projectId: "p1", initial: project });

    autosave.update({ ...project, summary: "", description: "Rewritten" });
    expect(await autosave.flush()).toBe(true);

    expect(await sentRequest(0).json()).toEqual({ title: "Quilt", category_id: "c1", description: "Rewritten", tags: [] });
    expect(autosave.state.status).toBe("incomplete");
  });

  test("a failed create isn't retried on its own, and trying again reuses a draft the server did make", async () => {
    vi.useFakeTimers();
    try {
      signIn("user-1");
      fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
      const onCreate = vi.fn();
      const autosave = createProjectAutosave({ projectId: null, initial: empty, onCreate });

      autosave.update(project);
      await vi.advanceTimersByTimeAsync(1000);
      expect(autosave.state).toMatchObject({ status: "error", retrying: false });
      await vi.advanceTimersByTimeAsync(60_000);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // The first create did reach the server.
      fetchMock
        .mockResolvedValueOnce(json([{ id: "p1", title: "Quilt", summary: "A warm quilt", status: "DRAFT", created_at: new Date().toISOString() }]))
        .mockResolvedValueOnce(json(saved));
      expect(await autosave.retry()).toBe(true);

      expect(requestUrls()).toEqual(["/api/projects", "/api/projects/mine/drafts", "/api/projects/p1/autosave"]);
      expect(onCreate).toHaveBeenCalledWith("p1");
    } finally {
      vi.useRealTimers();
    }
  });

  test("a failed update is still retried on its own", async () => {
    vi.useFakeTimers();
    try {
      signIn("user-1");
      fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(json(saved));
      const autosave = createProjectAutosave({ projectId: "p1", initial: project });

      autosave.update({ ...project, title: "Quilt 2" });
      await vi.advanceTimersByTimeAsync(1000);
      expect(autosave.state).toMatchObject({ status: "error", retrying: true });
      await vi.advanceTimersByTimeAsync(2000);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(autosave.state.status).toBe("idle");
    } finally {
      vi.useRealTimers();
    }
  });

  test("unsaved changes go to the backup, which moves to the draft once it's created", async () => {
    signIn("user-1");
    fetchMock.mockResolvedValue(json({ ...saved, last_autosaved_at: null }));
    const autosave = createProjectAutosave({ projectId: null, initial: empty });

    autosave.update({ ...empty, title: "Half" });
    expect(readDraftBackup(null)?.value.title).toBe("Half");

    autosave.update(project);
    await autosave.flush();
    expect(readDraftBackup(null)).toBeNull();
    expect(readDraftBackup("p1")).toBeNull();
  });
});

describe("draft backups", () => {
  test("are restored when they differ from the server", () => {
    signIn("user-1");
    writeDraftBackup("p1", { ...project, description: "Typed offline" });

    expect(restorableDraftBackup("p1", project, "2026-10-20T12:00:00Z")?.value.description).toBe("Typed offline");
  });

  test("are dropped when the server already has them", () => {
    signIn("user-1");
    writeDraftBackup("p1", project);

    expect(restorableDraftBackup("p1", project, null)).toBeNull();
    expect(readDraftBackup("p1")).toBeNull();
  });

  test("are dropped when the project was saved well after them elsewhere", () => {
    signIn("user-1");
    writeDraftBackup("p1", { ...project, description: "Old" });
    const muchLater = new Date(Date.now() + 10 * 60_000).toISOString();

    expect(restorableDraftBackup("p1", project, muchLater)).toBeNull();
  });

  test("belong to the user who wrote them", () => {
    signIn("user-1");
    writeDraftBackup("p1", project);
    signIn("user-2");

    expect(readDraftBackup("p1")).toBeNull();
  });

  test("aren't kept while signed out", () => {
    writeDraftBackup("p1", project);
    signIn("user-1");

    expect(readDraftBackup("p1")).toBeNull();
  });
});
