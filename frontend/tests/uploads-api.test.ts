// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { attachResource, getProjectResources } from "../src/api/resources";
import { completeUpload, createUpload, getUploadConfig } from "../src/api/uploads";

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

const requests = () => fetchMock.mock.calls.map(([input]) => input as Request);

beforeEach(() => {
  fetchMock = vi.fn(async () =>
    new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("upload API calls", () => {
  test("reads the rules from the public config endpoint", async () => {
    await getUploadConfig();

    const [request] = requests();
    expect(request.method).toBe("GET");
    expect(new URL(request.url).pathname).toBe("/api/uploads/config");
  });

  test("declares the file with its name, size and type, even when the type is empty", async () => {
    await createUpload("RESOURCE", new File(["solid"], "Bracket.STL"));

    const [request] = requests();
    expect(request.method).toBe("POST");
    expect(new URL(request.url).pathname).toBe("/api/uploads");
    expect(await request.json()).toEqual({
      kind: "RESOURCE",
      filename: "Bracket.STL",
      size: 5,
      mime_type: "",
    });
  });

  test("completes an upload by id", async () => {
    await completeUpload("u1");

    const [request] = requests();
    expect(request.method).toBe("POST");
    expect(new URL(request.url).pathname).toBe("/api/uploads/u1/complete");
  });

  test("attaches an upload to the given project and lists its files", async () => {
    await attachResource("p1", "u1");
    await getProjectResources("p1");

    const [attach, list] = requests();
    expect(attach.method).toBe("POST");
    expect(new URL(attach.url).pathname).toBe("/api/projects/p1/resources");
    expect(await attach.json()).toEqual({ upload_id: "u1" });
    expect(list.method).toBe("GET");
    expect(new URL(list.url).pathname).toBe("/api/projects/p1/resources");
  });
});
