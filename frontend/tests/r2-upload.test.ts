import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { R2UploadError, uploadToR2 } from "../src/lib/uploads/r2-upload";

type Handler = ((event: ProgressEvent) => void) | null;

class FakeXhr {
  static last: FakeXhr;

  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: unknown = null;
  status = 0;
  upload: { onprogress: Handler } = { onprogress: null };
  onload: Handler = null;
  onerror: Handler = null;
  onabort: Handler = null;
  private finished = false;

  constructor() {
    FakeXhr.last = this;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send(body: unknown) {
    this.body = body;
  }

  abort() {
    if (this.finished) return;
    this.finished = true;
    this.onabort?.({} as ProgressEvent);
  }

  progress(loaded: number, total: number) {
    this.upload.onprogress?.({ loaded, total, lengthComputable: true } as ProgressEvent);
  }

  respond(status: number) {
    this.finished = true;
    this.status = status;
    this.onload?.({} as ProgressEvent);
  }

  fail() {
    this.finished = true;
    this.onerror?.({} as ProgressEvent);
  }
}

const signedHeaders = { "Content-Type": "application/octet-stream" };

function start(onProgress?: (sent: number, total: number) => void) {
  const file = new File(["solid bracket"], "Bracket.STL", { type: "model/stl" });
  const pending = uploadToR2({ url: "https://r2.example/key", headers: signedHeaders, file, onProgress });
  return { file, pending, xhr: FakeXhr.last };
}

beforeEach(() => {
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadToR2", () => {
  test("PUTs the file to the signed URL with only the signed headers", async () => {
    const { file, pending, xhr } = start();
    expect(xhr.method).toBe("PUT");
    expect(xhr.url).toBe("https://r2.example/key");
    expect(xhr.headers).toEqual(signedHeaders);

    const body = xhr.body as Blob;
    expect(body.type).toBe("");
    expect(body.size).toBe(file.size);

    xhr.respond(200);
    await expect(pending.promise).resolves.toBeUndefined();
  });

  test("reports progress", () => {
    const onProgress = vi.fn();
    const { xhr } = start(onProgress);
    xhr.progress(5, 13);
    xhr.progress(13, 13);
    expect(onProgress.mock.calls).toEqual([
      [5, 13],
      [13, 13],
    ]);
  });

  test("explains a 403 from R2", async () => {
    const { pending, xhr } = start();
    xhr.respond(403);
    await expect(pending.promise).rejects.toEqual(
      new R2UploadError(403, "The upload link expired or was rejected. Try again."),
    );
  });

  test("fails on other error statuses", async () => {
    const { pending, xhr } = start();
    xhr.respond(500);
    await expect(pending.promise).rejects.toMatchObject({ status: 500 });
  });

  test("asks to check the connection on a network error", async () => {
    const { pending, xhr } = start();
    xhr.fail();
    await expect(pending.promise).rejects.toMatchObject({
      status: 0,
      message: "The upload failed. Check your connection and try again.",
    });
  });

  test("rejects with an AbortError when aborted", async () => {
    const { pending } = start();
    pending.abort();
    await expect(pending.promise).rejects.toMatchObject({ name: "AbortError" });
  });
});
