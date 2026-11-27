import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, FileText, Link2, LoaderCircle, Plus, X } from "lucide-react";
import { useState, type SubmitEvent } from "react";
import { ApiError } from "@/api/client";
import type { ProjectResource, ProjectResourceLink } from "@/api/models";
import {
  attachResource,
  createProjectResourceLink,
  getProjectResourceLinks,
  getProjectResources,
} from "@/api/resources";
import { UploadDropzone } from "@/components/uploads/upload-dropzone";
import { UploadRow } from "@/components/uploads/upload-row";
import { formatFileSize } from "@/lib/uploads/format";
import { useUploadConfig } from "@/lib/uploads/use-upload-config";
import { useUploadManager } from "@/lib/uploads/use-upload-manager";
import { acceptFor, splitFiles } from "@/lib/uploads/validate";

interface ProjectResourcesProps {
  // Missing in the sample preview.
  projectId?: string;
  isOwner: boolean;
}

const listClasses = "mt-4 min-h-0 flex-1 overflow-y-auto pr-1 focus-visible:outline-2 focus-visible:outline-ring";

const resourcesKey = (projectId: string) => ["project-resources", projectId];
const resourceLinksKey = (projectId: string) => ["project-resource-links", projectId];

function EmptyList() {
  return <p className="py-5 text-sm text-muted-foreground">No files yet.</p>;
}

function ResourceRow({ resource }: { resource: ProjectResource }) {
  return (
    <li className="flex items-center gap-2 rounded-md border border-brand-clay bg-white px-3 py-2">
      <FileText className="size-4 shrink-0 text-brand-garnet" aria-hidden="true" />
      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground" title={resource.filename}>
        {resource.title}
      </p>
      <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(resource.size)}</span>
    </li>
  );
}

function ResourceLinkRow({ link }: { link: ProjectResourceLink }) {
  return (
    <li className="flex items-center gap-2 rounded-md border border-brand-clay bg-white px-3 py-2">
      <Link2 className="size-4 shrink-0 text-brand-garnet" aria-hidden="true" />
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground underline-offset-2 hover:underline"
        title={link.url}
      >
        {link.title}
      </a>
    </li>
  );
}

function ResourceLinkList({ projectId, isOwner }: { projectId: string; isOwner: boolean }) {
  const [isAddingLink, setIsAddingLink] = useState(false);
  const links = useQuery({
    queryKey: resourceLinksKey(projectId),
    queryFn: () => getProjectResourceLinks(projectId),
  });

  return (
    <section aria-labelledby="external-links-heading" className="mt-5 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id="external-links-heading" className="text-sm font-bold text-brand-mahogany">
          External links
        </h3>
        {isOwner && (
          <button
            type="button"
            aria-expanded={isAddingLink}
            aria-controls={isAddingLink ? "resource-link-form" : undefined}
            onClick={() => setIsAddingLink((open) => !open)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-brand-garnet hover:bg-brand-garnet/10 hover:text-brand-garnet focus-visible:outline-2 focus-visible:outline-ring"
          >
            {isAddingLink ? <X className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            {isAddingLink ? "Cancel" : "Add link"}
          </button>
        )}
      </div>
      {links.isPending ? (
        <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Loading links...
        </p>
      ) : links.isError ? (
        <p role="alert" className="flex items-center gap-2 py-3 text-sm text-destructive">
          <CircleAlert className="size-4" aria-hidden="true" />Could not load external links. Try again later.
        </p>
      ) : links.data.length > 0 ? (
        <ul aria-label="External links" className="mt-2 space-y-2">
          {links.data.map((link) => <ResourceLinkRow key={link.id} link={link} />)}
        </ul>
      ) : (
        <div className="flex items-center gap-3 py-5 text-sm text-muted-foreground">
          <Link2 className="size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">No external links yet.</p>
            <p className="mt-1 text-xs">Attach tutorials, references or documentation.</p>
          </div>
        </div>
      )}
      {isOwner && isAddingLink && (
        <AddResourceLinkForm
          projectId={projectId}
          onCancel={() => setIsAddingLink(false)}
        />
      )}
    </section>
  );
}

function ResourceCount({ projectId }: { projectId: string }) {
  const resources = useQuery({
    queryKey: resourcesKey(projectId),
    queryFn: () => getProjectResources(projectId),
  });
  const links = useQuery({
    queryKey: resourceLinksKey(projectId),
    queryFn: () => getProjectResourceLinks(projectId),
  });

  if (resources.isPending || links.isPending || resources.isError || links.isError) {
    return <span className="rounded-full bg-brand-garnet/10 px-3 py-1.5 text-sm text-brand-garnet">Resources</span>;
  }

  const count = resources.data.length + links.data.length;
  return (
    <span
      aria-label={`${count} ${count === 1 ? "resource" : "resources"}`}
      className="rounded-full bg-brand-garnet/10 px-3 py-1.5 text-sm text-brand-garnet"
    >
      {count} {count === 1 ? "resource" : "resources"}
    </span>
  );
}

// The project's saved files plus any uploads still in progress (owner only).
function ResourceList({
  projectId,
  isOwner,
  isAddingFile,
  onToggleFile,
  showEmpty = true,
  children,
}: {
  projectId: string;
  isOwner: boolean;
  isAddingFile?: boolean;
  onToggleFile?: () => void;
  showEmpty?: boolean;
  children?: React.ReactNode;
}) {
  const resources = useQuery({
    queryKey: resourcesKey(projectId),
    queryFn: () => getProjectResources(projectId),
  });
  const saved = resources.data ?? [];

  return (
    <div tabIndex={0} aria-label="Project resources" className={listClasses}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-brand-mahogany">Files</h3>
        {isOwner && (
          <button
            type="button"
            aria-expanded={isAddingFile}
            aria-controls={isAddingFile ? "resource-upload-area" : undefined}
            onClick={onToggleFile}
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-brand-garnet hover:bg-brand-garnet/10 hover:text-brand-garnet focus-visible:outline-2 focus-visible:outline-ring"
          >
            {isAddingFile ? <X className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            {isAddingFile ? "Cancel" : "Add file"}
          </button>
        )}
      </div>
      {resources.isPending ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Loading files...
        </p>
      ) : resources.isError ? (
        <p role="alert" className="flex items-center gap-2 py-6 text-sm text-destructive">
          <CircleAlert className="size-4" aria-hidden="true" />Could not load files. Try again later.
        </p>
      ) : saved.length > 0 ? (
        <ul aria-label="Saved files" className="mt-3 space-y-2">
          {saved.map((resource) => <ResourceRow key={resource.id} resource={resource} />)}
        </ul>
      ) : (
        showEmpty && <EmptyList />
      )}
      {children}
    </div>
  );
}

function AddResourceLinkForm({
  projectId,
  onCancel,
}: {
  projectId: string;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();
    if (!trimmedTitle) {
      setError("Enter a title for this link.");
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmedUrl);
    } catch {
      setError("Enter a valid HTTP or HTTPS URL.");
      return;
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      setError("Links must start with http:// or https://.");
      return;
    }

    setIsSubmitting(true);
    try {
      const createdLink = await createProjectResourceLink(projectId, trimmedTitle, parsedUrl.href);
      const queryKey = resourceLinksKey(projectId);
      await queryClient.invalidateQueries({ queryKey });
      queryClient.setQueryData<ProjectResourceLink[]>(queryKey, (current) => {
        const currentLinks = current ?? [];
        return currentLinks.some((link) => link.id === createdLink.id)
          ? currentLinks
          : [createdLink, ...currentLinks];
      });
      setTitle("");
      setUrl("");
      onCancel();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 403) {
        setError("You must own this project to add a link.");
      } else if (cause instanceof ApiError && cause.status === 404) {
        setError("Project not found. Refresh the page and try again.");
      } else if (cause instanceof ApiError && cause.status === 422) {
        setError("Enter a title and a valid HTTP or HTTPS URL.");
      } else {
        setError("Could not add this link. Try again later.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      id="resource-link-form"
      aria-label="Add external link"
      onSubmit={(event) => void submit(event)}
      noValidate
      className="mt-3 rounded-md border border-border bg-background p-3"
    >
      <label className="block text-sm font-medium" htmlFor="resource-link-title">
        Link title
      </label>
      <input
        id="resource-link-title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={200}
        className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        placeholder="e.g. Build tutorial"
      />
      <label className="mt-3 block text-sm font-medium" htmlFor="resource-link-url">
        URL
      </label>
      <input
        id="resource-link-url"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        maxLength={2048}
        inputMode="url"
        className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        placeholder="https://example.com/tutorial"
      />
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
        {isSubmitting ? "Adding link..." : "Save link"}
      </button>
      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => {
          setTitle("");
          setUrl("");
          setError("");
          onCancel();
        }}
        className="mt-3 ml-2 inline-flex h-10 items-center rounded-md px-4 text-sm font-semibold text-muted-foreground hover:bg-muted disabled:opacity-60"
      >
        Cancel
      </button>
    </form>
  );
}

function OwnerResources({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const config = useUploadConfig();
  const uploads = useUploadManager({
    onUploaded: async (item) => {
      await attachResource(projectId, item.uploadId!);
      await queryClient.invalidateQueries({ queryKey: resourcesKey(projectId) });
    },
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [isAddingFile, setIsAddingFile] = useState(false);
  const rules = config.data?.RESOURCE;

  const onFiles = (files: File[]) => {
    if (!rules) return;
    const { valid, errors: rejected } = splitFiles(files, rules);
    setErrors(rejected);
    if (valid.length > 0) uploads.add("RESOURCE", valid);
  };

  const inProgress = uploads.items.filter((item) => item.status !== "done");

  return (
    <ResourceList
      projectId={projectId}
      isOwner
      isAddingFile={isAddingFile}
      onToggleFile={() => setIsAddingFile((open) => !open)}
      showEmpty={!isAddingFile && inProgress.length === 0}
    >
        {inProgress.length > 0 && (
          <ul aria-label="Uploads in progress" className="mt-2 space-y-2">
            {inProgress.map((item) => (
              <UploadRow key={item.id} item={item} onRetry={uploads.retry} onRemove={uploads.remove} />
            ))}
          </ul>
        )}
        {isAddingFile && (
          <div id="resource-upload-area">
            <UploadDropzone
              className="mt-3"
              label="Drag and drop files here"
              hint="Choose files from your device"
              size="large"
              onFiles={onFiles}
              accept={rules ? acceptFor(rules) : undefined}
              disabled={!rules}
              busy={config.isPending}
              errors={config.isError ? ["Uploads are unavailable right now. Try again later."] : errors}
            />
          </div>
        )}
    </ResourceList>
  );
}

export function ProjectResources({ projectId, isOwner }: ProjectResourcesProps) {
  if (!projectId) {
    return (
      <section aria-labelledby="resources-heading" className="flex max-h-180 min-h-80 flex-col rounded-lg border border-border bg-background p-4">
        <h2 id="resources-heading" className="text-lg font-bold text-brand-mahogany">Resources</h2>
        <div className={listClasses}>
          <EmptyList />
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="resources-heading" className="flex max-h-180 min-h-80 flex-col rounded-lg border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="resources-heading" className="text-lg font-bold text-brand-mahogany">Resources</h2>
        <ResourceCount projectId={projectId} />
      </div>
      {isOwner ? (
        <OwnerResources key={projectId} projectId={projectId} />
      ) : (
        <ResourceList projectId={projectId} isOwner={false} />
      )}
      <ResourceLinkList projectId={projectId} isOwner={isOwner} />
    </section>
  );
}
