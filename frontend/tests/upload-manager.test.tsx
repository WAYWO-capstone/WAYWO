// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ApiError } from "@/api/client";
import { completeUpload, createUpload } from "@/api/uploads";
import type { UploadResult } from "@/lib/uploads/api-types";
import { R2UploadError, uploadToR2 } from "@/lib/uploads/r2-upload";
import { useUploadManager } from "@/lib/uploads/use-upload-manager";

vi.mock("@/api/uploads", () => ({
  getUploadConfig: vi.fn(),
  createUpload: vi.fn(),
  completeUpload: vi.fn(),
  getUpload: vi.fn(),
}));

vi.mock("@/lib/uploads/r2-upload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/uploads/r2-upload")>()),
  uploadToR2: vi.fn(),
}));

const file = new File(["solid bracket"], "Bracket.STL");

function result(status: UploadResult["status"], uploadId = "up-1"): UploadResult {
  return { upload_id: uploadId, kind: "RESOURCE", filename: file.name, size: file.size, status };
}

let uploadCount = 0;

beforeEach(() => {
  uploadCount = 0;
  vi.mocked(createUpload).mockImplementation(async () => {
    uploadCount += 1;
    return {
      upload_id: `up-${uploadCount}`,
      url: "https://r2.example/key",
      headers: { "Content-Type": "application/octet-stream" },
      expires_at: "2026-11-14T12:00:00Z",
    };
  });
  vi.mocked(uploadToR2).mockImplementation(({ onProgress }) => {
    onProgress?.(file.size, file.size);
    return { promise: Promise.resolve(), abort: vi.fn() };
  });
  vi.mocked(completeUpload).mockImplementation(async (id) => result("READY", id));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup(onUploaded = vi.fn()) {
  const hook = renderHook(() => useUploadManager({ onUploaded }));
  act(() => hook.result.current.add("RESOURCE", [file]));
  return { hook, onUploaded, item: () => hook.result.current.items[0] };
}

describe("useUploadManager", () => {
  test("uploads, completes and hands the file to the caller", async () => {
    const { hook, onUploaded, item } = setup();
    await waitFor(() => expect(item().status).toBe("done"));

    expect(createUpload).toHaveBeenCalledWith("RESOURCE", file);
    expect(uploadToR2).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://r2.example/key", file }),
    );
    expect(completeUpload).toHaveBeenCalledWith("up-1");
    expect(onUploaded).toHaveBeenCalledWith(expect.objectContaining({ uploadId: "up-1" }));
    expect(item()).toMatchObject({ uploadId: "up-1", bytesSent: file.size, error: null });
    expect(hook.result.current.isBusy).toBe(false);
  });

  test("fails when the backend answers FAILED", async () => {
    vi.mocked(completeUpload).mockResolvedValue(result("FAILED"));
    const { onUploaded, item } = setup();
    await waitFor(() => expect(item().status).toBe("error"));
    expect(item().error).toBe("The file couldn't be verified after uploading. Try again.");
    expect(onUploaded).not.toHaveBeenCalled();
  });

  test("fails when attaching fails, and a retry starts a new upload", async () => {
    const onUploaded = vi.fn().mockRejectedValueOnce(new ApiError(409, "Upload is not available"));
    const { hook, item } = setup(onUploaded);
    await waitFor(() => expect(item().status).toBe("error"));
    expect(item().error).toBe("Upload is not available");

    act(() => hook.result.current.retry(item().id));
    await waitFor(() => expect(item().status).toBe("done"));
    expect(createUpload).toHaveBeenCalledTimes(2);
    expect(item().uploadId).toBe("up-2");
  });

  test("shows the R2 error and doesn't complete", async () => {
    vi.mocked(uploadToR2).mockReturnValue({
      promise: Promise.reject(new R2UploadError(403, "The upload link expired or was rejected. Try again.")),
      abort: vi.fn(),
    });
    const { item } = setup();
    await waitFor(() => expect(item().status).toBe("error"));
    expect(item().error).toBe("The upload link expired or was rejected. Try again.");
    expect(completeUpload).not.toHaveBeenCalled();
  });

  test("explains API errors by status", async () => {
    vi.mocked(createUpload).mockRejectedValue(new ApiError(401));
    const { item } = setup();
    await waitFor(() => expect(item().status).toBe("error"));
    expect(item().error).toBe("Your session expired. Log in again.");
  });

  test("is busy while uploading and aborts the upload when removed", async () => {
    const abort = vi.fn();
    vi.mocked(uploadToR2).mockReturnValue({ promise: new Promise(() => {}), abort });
    const { hook, item } = setup();
    await waitFor(() => expect(item().status).toBe("uploading"));
    expect(hook.result.current.isBusy).toBe(true);

    act(() => hook.result.current.remove(item().id));
    expect(abort).toHaveBeenCalled();
    expect(hook.result.current.items).toEqual([]);
    expect(hook.result.current.isBusy).toBe(false);
  });

  test("aborts running uploads on unmount", async () => {
    const abort = vi.fn();
    vi.mocked(uploadToR2).mockReturnValue({ promise: new Promise(() => {}), abort });
    const { hook } = setup();
    await waitFor(() => expect(uploadToR2).toHaveBeenCalled());
    hook.unmount();
    expect(abort).toHaveBeenCalled();
  });
});
