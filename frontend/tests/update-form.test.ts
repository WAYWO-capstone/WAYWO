// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { ApiError, getProjectUpdate } from "../src/lib/api";
import { hasRequiredUpdateFields, updateChanges, updateRequestError, wasEdited } from "../src/lib/update-form";

const saved = { title: "Base finished", body: "Finished the base.", type: "PROGRESS" as const };

describe("updateChanges", () => {
  test("is empty when nothing meaningful changed", () => {
    expect(updateChanges(saved, saved)).toEqual({});
    expect(updateChanges(saved, { ...saved, title: "  Base finished  " })).toEqual({});
  });

  test("contains only the changed fields, trimmed", () => {
    expect(updateChanges(saved, { ...saved, title: " New title " })).toEqual({ title: "New title" });
    expect(updateChanges(saved, { ...saved, type: "DECISION" })).toEqual({ type: "DECISION" });
  });
});

describe("hasRequiredUpdateFields", () => {
  test("rejects a title or content made of spaces", () => {
    expect(hasRequiredUpdateFields(saved)).toBe(true);
    expect(hasRequiredUpdateFields({ ...saved, title: "   " })).toBe(false);
    expect(hasRequiredUpdateFields({ ...saved, body: "   " })).toBe(false);
  });
});

describe("wasEdited", () => {
  test("ignores the small gap between a new update's timestamps", () => {
    expect(wasEdited({ created_at: "2026-05-14T12:00:00.000Z", updated_at: "2026-05-14T12:00:00.004Z" })).toBe(false);
  });

  test("is true once the update changed later", () => {
    expect(wasEdited({ created_at: "2026-05-14T12:00:00Z", updated_at: "2026-05-15T09:00:00Z" })).toBe(true);
  });
});

describe("updateRequestError", () => {
  test("explains permission and missing-update failures", () => {
    expect(updateRequestError(new ApiError(403))).toBe("You can only change your own updates.");
    expect(updateRequestError(new ApiError(404))).toBe("This update no longer exists.");
  });
});

describe("getProjectUpdate", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubHistory(ids: string[]) {
    const fetchMock = vi.fn(async (url: string) => {
      const offset = Number(new URL(url, "http://test").searchParams.get("offset"));
      const items = ids.slice(offset, offset + 20).map((id) => ({ id }));
      return new Response(JSON.stringify({ items, total: ids.length, limit: 20, offset }));
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  test("finds an update on a later page of the history", async () => {
    const ids = Array.from({ length: 25 }, (_, index) => `u${index}`);
    const fetchMock = stubHistory(ids);

    await expect(getProjectUpdate("p1", "u22")).resolves.toEqual({ id: "u22" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("fails with 404 when the update is not in the history", async () => {
    stubHistory(["u1"]);

    await expect(getProjectUpdate("p1", "missing")).rejects.toMatchObject({ status: 404 });
  });
});
