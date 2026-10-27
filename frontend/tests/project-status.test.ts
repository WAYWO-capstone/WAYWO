import { describe, expect, test } from "vitest";
import { ApiError } from "../src/api/client";
import {
  PartialStatusChangeError,
  statusChangeError,
  statusChangeSteps,
  statusClasses,
  statusLabel,
} from "../src/lib/project-status";

describe("statusLabel", () => {
  test("shows a readable label for each status", () => {
    expect(statusLabel("DRAFT")).toBe("Draft");
    expect(statusLabel("ACTIVE")).toBe("Active");
    expect(statusLabel("COMPLETED")).toBe("Completed");
  });

  test("gives each status its own colours", () => {
    const classes = new Set([statusClasses("DRAFT"), statusClasses("ACTIVE"), statusClasses("COMPLETED")]);
    expect(classes.size).toBe(3);
  });
});

describe("statusChangeSteps", () => {
  test("does nothing when the status is unchanged", () => {
    expect(statusChangeSteps("ACTIVE", "ACTIVE")).toEqual([]);
    expect(statusChangeSteps("DRAFT", "DRAFT")).toEqual([]);
  });

  test("sets a published project to completed or active through /status", () => {
    expect(statusChangeSteps("ACTIVE", "COMPLETED")).toEqual([{ type: "set-status", status: "COMPLETED" }]);
    expect(statusChangeSteps("COMPLETED", "ACTIVE")).toEqual([{ type: "set-status", status: "ACTIVE" }]);
  });

  test("publishes a draft to make it active", () => {
    expect(statusChangeSteps("DRAFT", "ACTIVE")).toEqual([{ type: "publish" }]);
  });

  test("publishes a draft before marking it completed", () => {
    expect(statusChangeSteps("DRAFT", "COMPLETED")).toEqual([
      { type: "publish" },
      { type: "set-status", status: "COMPLETED" },
    ]);
  });

  test("unpublishes a published project to return it to draft", () => {
    expect(statusChangeSteps("ACTIVE", "DRAFT")).toEqual([{ type: "unpublish" }]);
    expect(statusChangeSteps("COMPLETED", "DRAFT")).toEqual([{ type: "unpublish" }]);
  });
});

describe("statusChangeError", () => {
  test("explains a draft that was published but not marked completed", () => {
    expect(statusChangeError(new PartialStatusChangeError())).toMatch(/published but couldn't be marked completed/);
  });

  test("explains common API failures", () => {
    expect(statusChangeError(new ApiError(401))).toMatch(/session has expired/);
    expect(statusChangeError(new ApiError(403))).toMatch(/your own projects/);
    expect(statusChangeError(new ApiError(409))).toMatch(/isn't allowed/);
    expect(statusChangeError(new ApiError(500))).toBe("Could not update the project status. Please try again.");
  });
});
