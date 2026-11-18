// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { ApiError } from "../src/api/client";
import { getAllProjectUpdates, getProjectUpdate } from "../src/api/updates";
import { createUpdateRequestError, updateChanges, updateRequestError, validateUpdate, wasEdited } from "../src/lib/update-form";

const saved = { title: "Base finished", body: "Finished the base.", type: "PROGRESS" as const, references: [] };

describe("updateChanges", () => {
  test("is empty when nothing meaningful changed", () => {
    expect(updateChanges(saved, saved)).toEqual({});
    expect(updateChanges(saved, { ...saved, title: "  Base finished  " })).toEqual({});
  });

  test("contains only the changed fields, trimmed", () => {
    expect(updateChanges(saved, { ...saved, title: " New title " })).toEqual({ title: "New title" });
    expect(updateChanges(saved, { ...saved, type: "DECISION" })).toEqual({ type: "DECISION" });
  });

  test("sends changed references but ignores their display order", () => {
    const references = [
      { target_update_id: "u2", reason: "RELATED_TO" as const },
      { target_update_id: "u1", reason: "SOLVES" as const },
    ];
    expect(updateChanges(
      { ...saved, references: references.slice().reverse() },
      { ...saved, references },
    )).toEqual({});
    expect(updateChanges(saved, { ...saved, references })).toEqual({ references });
    expect(updateChanges({ ...saved, references }, saved)).toEqual({ references: [] });
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
    expect(updateRequestError(new ApiError(404, "Referenced update not found"))).toContain("linked update");
    expect(updateRequestError(new ApiError(422, "Solve references must link SOLUTION updates to PROBLEM updates"))).toContain("Solution");
  });
});

describe("getProjectUpdate", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubHistory(ids: string[]) {
    const fetchMock = vi.fn(async (request: Request) => {
      const offset = Number(new URL(request.url).searchParams.get("offset"));
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

  test("loads every page of the history for the reference picker", async () => {
    const ids = Array.from({ length: 25 }, (_, index) => `u${index}`);
    const fetchMock = stubHistory(ids);

    await expect(getAllProjectUpdates("p1")).resolves.toHaveLength(25);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("fails with 404 when the update is not in the history", async () => {
    stubHistory(["u1"]);

    await expect(getProjectUpdate("p1", "missing")).rejects.toMatchObject({ status: 404 });
  });
});

describe("validateUpdate", () => {
  test("accepts a complete update", () => {
    expect(validateUpdate({ title: "Base", body: "Finished the base.", type: "PROGRESS" })).toEqual({});
  });

  test("explains every missing or too short field", () => {
    expect(validateUpdate({ title: "", body: "", type: null })).toEqual({
      title: "Title needs at least 3 characters",
      type: "Choose an update type",
      body: "Add a description",
    });
  });

  test("ignores surrounding spaces when measuring the title and content", () => {
    const errors = validateUpdate({ title: "  ab  ", body: "   ", type: "DECISION" });
    expect(errors.title).toBeTruthy();
    expect(errors.body).toBeTruthy();
    expect(errors.type).toBeUndefined();
  });
});

describe("createUpdateRequestError", () => {
  test("words ownership and missing-project errors for creating", () => {
    expect(createUpdateRequestError(new ApiError(403))).toBe("You can only add updates to your own projects.");
    expect(createUpdateRequestError(new ApiError(404))).toBe("This project no longer exists.");
    expect(createUpdateRequestError(new ApiError(401))).toBe(updateRequestError(new ApiError(401)));
  });
});
