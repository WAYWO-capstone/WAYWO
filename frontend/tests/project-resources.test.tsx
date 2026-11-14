// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getUploadConfig } from "@/api/uploads";
import { ProjectResources } from "@/components/projects/resources/project-resources";
import type { UploadConfig } from "@/lib/uploads/api-types";

vi.mock("@/api/uploads", () => ({
  getUploadConfig: vi.fn(),
  createUpload: vi.fn(() => new Promise(() => {})),
  completeUpload: vi.fn(),
  getUpload: vi.fn(),
}));

const config: UploadConfig = {
  RESOURCE: { max_size: 1024 * 1024, allowed_mime: ["application/pdf"], allowed_extensions: [".stl"] },
  PICTURE: { max_size: 1024 * 1024, allowed_mime: ["image/png"], allowed_extensions: [] },
};

function renderPanel(props: { projectId?: string; isOwner: boolean }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProjectResources {...props} />
    </QueryClientProvider>,
  );
}

const addFile = () => screen.queryByRole("button", { name: /add file/i });

const waitForEnabledDropzone = () =>
  waitFor(() => expect(addFile()).toHaveProperty("disabled", false));

beforeEach(() => {
  vi.mocked(getUploadConfig).mockResolvedValue(config);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProjectResources", () => {
  test("shows the dropzone to the owner once the rules load", async () => {
    renderPanel({ projectId: "p1", isOwner: true });
    expect(screen.getByText("No files yet.")).toBeTruthy();
    await waitForEnabledDropzone();
  });

  test("hides the dropzone from other users", () => {
    renderPanel({ projectId: "p1", isOwner: false });
    expect(screen.getByText("No files yet.")).toBeTruthy();
    expect(addFile()).toBeNull();
    expect(getUploadConfig).not.toHaveBeenCalled();
  });

  test("hides the dropzone in the sample preview", () => {
    renderPanel({ isOwner: true });
    expect(addFile()).toBeNull();
    expect(getUploadConfig).not.toHaveBeenCalled();
  });

  test("explains when the upload rules can't be loaded", async () => {
    vi.mocked(getUploadConfig).mockRejectedValue(new Error("down"));
    renderPanel({ projectId: "p1", isOwner: true });
    expect(await screen.findByText("Uploads are unavailable right now. Try again later.")).toBeTruthy();
    expect(addFile()).toHaveProperty("disabled", true);
  });

  test("lists rejected files and starts uploading the valid ones", async () => {
    const view = renderPanel({ projectId: "p1", isOwner: true });
    await waitForEnabledDropzone();
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(["x"], "Bracket.STL"), new File(["x"], "setup.exe")] },
    });

    expect(screen.getByText("setup.exe isn't a supported file type.")).toBeTruthy();
    expect(await screen.findByText("Bracket.STL")).toBeTruthy();
    expect(screen.queryByText("No files yet.")).toBeNull();
  });
});
