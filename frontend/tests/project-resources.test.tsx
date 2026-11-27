// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ApiError } from "@/api/client";
import type { ProjectResource, ProjectResourceLink } from "@/api/models";
import {
  attachResource,
  createProjectResourceLink,
  getProjectResourceLinks,
  getProjectResources,
} from "@/api/resources";
import { completeUpload, createUpload, getUploadConfig } from "@/api/uploads";
import { ProjectResources } from "@/components/projects/resources/project-resources";
import type { UploadConfig } from "@/lib/uploads/api-types";
import { uploadToR2 } from "@/lib/uploads/r2-upload";

vi.mock("@/api/uploads", () => ({
  getUploadConfig: vi.fn(),
  createUpload: vi.fn(() => new Promise(() => {})),
  completeUpload: vi.fn(),
  getUpload: vi.fn(),
}));

vi.mock("@/api/resources", () => ({
  getProjectResources: vi.fn(),
  attachResource: vi.fn(),
  getProjectResourceLinks: vi.fn(),
  createProjectResourceLink: vi.fn(),
}));

vi.mock("@/lib/uploads/r2-upload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/uploads/r2-upload")>()),
  uploadToR2: vi.fn(() => ({ promise: Promise.resolve(), abort: vi.fn() })),
}));

const config: UploadConfig = {
  RESOURCE: { max_size: 1024 * 1024, allowed_mime: ["application/pdf"], allowed_extensions: [".stl"] },
  PICTURE: { max_size: 1024 * 1024, allowed_mime: ["image/png"], allowed_extensions: [] },
};

function resource(changes: Partial<ProjectResource> = {}): ProjectResource {
  return {
    id: "r1",
    project_id: "p1",
    title: "Bracket.STL",
    description: "",
    created_at: "2026-11-15T12:00:00Z",
    filename: "Bracket.STL",
    mime_type: "application/octet-stream",
    size: 2048,
    ...changes,
  };
}

function resourceLink(changes: Partial<ProjectResourceLink> = {}): ProjectResourceLink {
  return {
    id: "l1",
    project_id: "p1",
    title: "Build tutorial",
    url: "https://example.com/tutorial",
    created_at: "2026-11-15T12:00:00Z",
    ...changes,
  };
}

function renderPanel(props: { projectId?: string; isOwner: boolean }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProjectResources {...props} />
    </QueryClientProvider>,
  );
}

const addFile = () => screen.queryByRole("button", { name: "Add file" });
const uploadDropzone = () => screen.queryByRole("button", { name: /drag and drop files here/i });

async function openUploadArea() {
  const addFileButton = addFile();
  if (addFileButton) fireEvent.click(addFileButton);
  expect(await screen.findByRole("button", { name: /drag and drop files here/i })).toBeTruthy();
}

async function waitForEnabledDropzone() {
  await openUploadArea();
  await waitFor(() => expect(uploadDropzone()).toHaveProperty("disabled", false));
}

function chooseFiles(container: HTMLElement, files: File[]) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
}

// Lets a full upload run: signed, sent to R2, verified as READY.
function uploadsSucceed() {
  vi.mocked(createUpload).mockResolvedValue({
    upload_id: "u1",
    url: "https://r2.example/signed",
    headers: { "Content-Type": "application/octet-stream" },
    expires_at: "2026-11-15T12:15:00Z",
  });
  vi.mocked(completeUpload).mockResolvedValue({
    upload_id: "u1",
    kind: "RESOURCE",
    filename: "Bracket.STL",
    size: 1,
    status: "READY",
  });
}

beforeEach(() => {
  vi.mocked(getUploadConfig).mockResolvedValue(config);
  vi.mocked(getProjectResources).mockResolvedValue([]);
  vi.mocked(getProjectResourceLinks).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProjectResources", () => {
  test("shows the dropzone to the owner once the rules load", async () => {
    renderPanel({ projectId: "p1", isOwner: true });
    expect(await screen.findByText("No files yet.")).toBeTruthy();
    expect(uploadDropzone()).toBeNull();
    expect(addFile()).toBeTruthy();
    await waitForEnabledDropzone();
    expect(uploadDropzone()).toBeTruthy();
  });

  test("hides the dropzone from other users", async () => {
    renderPanel({ projectId: "p1", isOwner: false });
    expect(await screen.findByText("No files yet.")).toBeTruthy();
    expect(addFile()).toBeNull();
    expect(getUploadConfig).not.toHaveBeenCalled();
  });

  test("hides the dropzone in the sample preview", () => {
    renderPanel({ isOwner: true });
    expect(addFile()).toBeNull();
    expect(getUploadConfig).not.toHaveBeenCalled();
    expect(getProjectResources).not.toHaveBeenCalled();
  });

  test("explains when the upload rules can't be loaded", async () => {
    vi.mocked(getUploadConfig).mockRejectedValue(new Error("down"));
    renderPanel({ projectId: "p1", isOwner: true });
    await openUploadArea();
    expect(await screen.findByText("Uploads are unavailable right now. Try again later.")).toBeTruthy();
    expect(uploadDropzone()).toHaveProperty("disabled", true);
  });

  test("lists rejected files and starts uploading the valid ones", async () => {
    const view = renderPanel({ projectId: "p1", isOwner: true });
    await waitForEnabledDropzone();

    chooseFiles(view.container, [new File(["x"], "Bracket.STL"), new File(["x"], "setup.exe")]);

    expect(screen.getByText("setup.exe isn't a supported file type.")).toBeTruthy();
    expect(await screen.findByText("Bracket.STL")).toBeTruthy();
    expect(screen.queryByText("No files yet.")).toBeNull();
  });

  test.each([true, false])("lists the project's saved files (owner: %s)", async (isOwner) => {
    vi.mocked(getProjectResources).mockResolvedValue([
      resource({ id: "r2", title: "Wiring diagram", filename: "wiring.pdf", size: 3 * 1024 * 1024 }),
      resource(),
    ]);

    renderPanel({ projectId: "p1", isOwner });

    const saved = await screen.findByRole("list", { name: "Saved files" });
    expect(within(saved).getByText("Wiring diagram")).toBeTruthy();
    expect(within(saved).getByText("3 MB")).toBeTruthy();
    expect(within(saved).getByText("Bracket.STL")).toBeTruthy();
    expect(within(saved).getByText("2 KB")).toBeTruthy();
    expect(getProjectResources).toHaveBeenCalledWith("p1");
  });

  test("explains when the saved files can't be loaded", async () => {
    vi.mocked(getProjectResources).mockRejectedValue(new Error("down"));
    renderPanel({ projectId: "p1", isOwner: false });
    expect(await screen.findByText("Could not load files. Try again later.")).toBeTruthy();
  });

  test("lists external links as safe, titled links", async () => {
    vi.mocked(getProjectResourceLinks).mockResolvedValue([resourceLink()]);
    renderPanel({ projectId: "p1", isOwner: false });

    const link = await screen.findByRole("link", { name: "Build tutorial" });
    expect(link.getAttribute("href")).toBe("https://example.com/tutorial");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(getProjectResourceLinks).toHaveBeenCalledWith("p1");
  });

  test("separates external links from files and places them after the owner's upload control", async () => {
    renderPanel({ projectId: "p1", isOwner: true });

    const addFileButton = await screen.findByRole("button", { name: "Add file" });
    const linksHeading = await screen.findByRole("heading", { name: "External links" });
    const linksSection = linksHeading.parentElement?.parentElement;

    expect(linksSection?.className).toContain("border-t");
    expect(
      addFileButton.compareDocumentPosition(linksHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("shows a clear error when external links can't be loaded", async () => {
    vi.mocked(getProjectResourceLinks).mockRejectedValue(new Error("down"));
    renderPanel({ projectId: "p1", isOwner: false });

    expect(
      await screen.findByText("Could not load external links. Try again later."),
    ).toBeTruthy();
  });

  test("lets the owner add an external link and clears the form", async () => {
    vi.mocked(createProjectResourceLink).mockResolvedValue(resourceLink());
    vi.mocked(getProjectResourceLinks).mockResolvedValueOnce([]).mockResolvedValue([resourceLink()]);
    const view = renderPanel({ projectId: "p1", isOwner: true });

    expect(screen.queryByLabelText("Link title")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));
    fireEvent.change(screen.getByLabelText("Link title"), {
      target: { value: "Build tutorial" },
    });
    fireEvent.change(screen.getByLabelText("URL"), {
      target: { value: "https://example.com/tutorial" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save link" }));

    await waitFor(() => expect(screen.queryByLabelText("Link title")).toBeNull());
    expect(createProjectResourceLink).toHaveBeenCalledWith(
      "p1",
      "Build tutorial",
      "https://example.com/tutorial",
    );
    expect(view.container.querySelector("#resource-link-form")).toBeNull();
    expect(await screen.findByLabelText("1 resource")).toBeTruthy();
  });

  test("cancel collapses the external link form without creating a link", () => {
    renderPanel({ projectId: "p1", isOwner: true });
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));
    fireEvent.change(screen.getByLabelText("Link title"), { target: { value: "Draft" } });
    fireEvent.click(
      within(screen.getByRole("form", { name: "Add external link" })).getByRole("button", { name: "Cancel" }),
    );

    expect(screen.queryByLabelText("Link title")).toBeNull();
    expect(createProjectResourceLink).not.toHaveBeenCalled();
  });

  test("shows the combined file and link count", async () => {
    vi.mocked(getProjectResources).mockResolvedValue([resource(), resource({ id: "r2" })]);
    vi.mocked(getProjectResourceLinks).mockResolvedValue([resourceLink()]);
    renderPanel({ projectId: "p1", isOwner: false });

    expect(await screen.findByLabelText("3 resources")).toBeTruthy();
  });

  test.each([
    ["", "https://example.com", "Enter a title for this link."],
    ["Build tutorial", "javascript:alert(1)", "Links must start with http:// or https://."],
    ["Build tutorial", "not a url", "Enter a valid HTTP or HTTPS URL."],
  ])("rejects unsafe or incomplete link URLs: %s", async (title, value, message) => {
    renderPanel({ projectId: "p1", isOwner: true });
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));

    fireEvent.change(screen.getByLabelText("Link title"), {
      target: { value: title },
    });
    fireEvent.change(screen.getByLabelText("URL"), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Save link" }));

    expect((await screen.findByRole("alert")).textContent).toContain(message);
    expect(createProjectResourceLink).not.toHaveBeenCalled();
  });

  test.each([
    [403, "You must own this project to add a link."],
    [422, "Enter a title and a valid HTTP or HTTPS URL."],
  ])("shows a clear error when adding a link returns %s", async (status, message) => {
    vi.mocked(createProjectResourceLink).mockRejectedValue(
      new ApiError(status, "Request rejected"),
    );
    renderPanel({ projectId: "p1", isOwner: true });
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));

    fireEvent.change(screen.getByLabelText("Link title"), {
      target: { value: "Build tutorial" },
    });
    fireEvent.change(screen.getByLabelText("URL"), {
      target: { value: "https://example.com/tutorial" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save link" }));

    expect((await screen.findByRole("alert")).textContent).toContain(message);
  });

  test("attaches a finished upload to this project and shows it in the saved files", async () => {
    uploadsSucceed();
    vi.mocked(attachResource).mockResolvedValue(resource());
    vi.mocked(getProjectResources).mockResolvedValueOnce([]).mockResolvedValue([resource()]);
    const view = renderPanel({ projectId: "p1", isOwner: true });
    await waitForEnabledDropzone();
    const file = new File(["x"], "Bracket.STL");

    chooseFiles(view.container, [file]);

    const saved = await screen.findByRole("list", { name: "Saved files" });
    expect(within(saved).getByText("Bracket.STL")).toBeTruthy();
    expect(await screen.findByLabelText("1 resource")).toBeTruthy();
    expect(createUpload).toHaveBeenCalledWith("RESOURCE", file);
    expect(uploadToR2).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://r2.example/signed", headers: { "Content-Type": "application/octet-stream" } }),
    );
    expect(completeUpload).toHaveBeenCalledWith("u1");
    expect(attachResource).toHaveBeenCalledWith("p1", "u1");
    // The finished upload row is replaced by the saved file.
    expect(screen.queryByRole("list", { name: "Uploads in progress" })).toBeNull();
  });

  test("shows why a file couldn't be added to the project", async () => {
    uploadsSucceed();
    vi.mocked(attachResource).mockRejectedValue(
      new ApiError(409, "This file can't be added to the project. Try uploading it again."),
    );
    const view = renderPanel({ projectId: "p1", isOwner: true });
    await waitForEnabledDropzone();

    chooseFiles(view.container, [new File(["x"], "Bracket.STL")]);

    expect(
      await screen.findByText("This file can't be added to the project. Try uploading it again."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });
});
