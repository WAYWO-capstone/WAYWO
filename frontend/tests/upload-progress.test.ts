import { describe, expect, test } from "vitest";
import { progressPercent } from "../src/lib/uploads/progress";
import type { UploadItem, UploadStatus } from "../src/lib/uploads/types";

function item(status: UploadStatus, bytesSent = 0, totalBytes = 1000): UploadItem {
  return {
    id: "local-1",
    kind: "RESOURCE",
    file: new File([], "plan.pdf"),
    uploadId: null,
    status,
    bytesSent,
    totalBytes,
    error: null,
  };
}

describe("progressPercent", () => {
  test("starts at 0 while queued", () => {
    expect(progressPercent(item("queued"))).toBe(0);
  });

  test("fills up to 95% while the bytes are sent", () => {
    expect(progressPercent(item("uploading", 0))).toBe(0);
    expect(progressPercent(item("uploading", 500))).toBe(47);
    expect(progressPercent(item("uploading", 1000))).toBe(95);
  });

  test("never goes over 95% while uploading", () => {
    expect(progressPercent(item("uploading", 2000))).toBe(95);
  });

  test("is 0 while uploading when the size is unknown", () => {
    expect(progressPercent(item("uploading", 0, 0))).toBe(0);
  });

  test("stays at 95% after the bytes are sent", () => {
    expect(progressPercent(item("completing", 1000))).toBe(95);
    expect(progressPercent(item("processing", 1000))).toBe(95);
    expect(progressPercent(item("attaching", 1000))).toBe(95);
  });

  test("is 100% when done", () => {
    expect(progressPercent(item("done", 1000))).toBe(100);
  });

  test("freezes where it was on error", () => {
    expect(progressPercent(item("error", 300))).toBe(28);
    expect(progressPercent(item("error", 1000))).toBe(95);
  });
});
