import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, FileText, LoaderCircle } from "lucide-react";
import { useState } from "react";
import type { ProjectResource } from "@/api/models";
import { attachResource, getProjectResources } from "@/api/resources";
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

const listClasses = "mt-2 min-h-0 flex-1 overflow-y-auto pr-1 focus-visible:outline-2 focus-visible:outline-ring";

const resourcesKey = (projectId: string) => ["project-resources", projectId];

function EmptyList() {
  return <p className="py-6 text-sm text-muted-foreground">No files yet.</p>;
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

// The project's saved files plus any uploads still in progress (owner only).
function ResourceList({ projectId, children }: { projectId: string; children?: React.ReactNode }) {
  const resources = useQuery({
    queryKey: resourcesKey(projectId),
    queryFn: () => getProjectResources(projectId),
  });
  const saved = resources.data ?? [];

  return (
    <div tabIndex={0} aria-label="Project files" className={listClasses}>
      {children}
      {resources.isPending ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Loading files...
        </p>
      ) : resources.isError ? (
        <p role="alert" className="flex items-center gap-2 py-6 text-sm text-destructive">
          <CircleAlert className="size-4" aria-hidden="true" />Could not load files. Try again later.
        </p>
      ) : saved.length > 0 ? (
        <ul aria-label="Saved files" className="space-y-2">
          {saved.map((resource) => <ResourceRow key={resource.id} resource={resource} />)}
        </ul>
      ) : (
        !children && <EmptyList />
      )}
    </div>
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
  const rules = config.data?.RESOURCE;

  const onFiles = (files: File[]) => {
    if (!rules) return;
    const { valid, errors: rejected } = splitFiles(files, rules);
    setErrors(rejected);
    if (valid.length > 0) uploads.add("RESOURCE", valid);
  };

  const inProgress = uploads.items.filter((item) => item.status !== "done");

  return (
    <>
      <ResourceList projectId={projectId}>
        {inProgress.length > 0 && (
          <ul aria-label="Uploads in progress" className="mb-2 space-y-2">
            {inProgress.map((item) => (
              <UploadRow key={item.id} item={item} onRetry={uploads.retry} onRemove={uploads.remove} />
            ))}
          </ul>
        )}
      </ResourceList>
      <UploadDropzone
        className="mt-3"
        label="Add File"
        onFiles={onFiles}
        accept={rules ? acceptFor(rules) : undefined}
        disabled={!rules}
        busy={config.isPending}
        errors={config.isError ? ["Uploads are unavailable right now. Try again later."] : errors}
      />
    </>
  );
}

export function ProjectResources({ projectId, isOwner }: ProjectResourcesProps) {
  return (
    <section aria-labelledby="resources-heading" className="flex max-h-180 min-h-80 flex-col rounded-lg border border-border bg-background p-4">
      <h2 id="resources-heading" className="text-lg font-bold text-brand-mahogany">Resources</h2>
      {!projectId ? (
        <div className={listClasses}>
          <EmptyList />
        </div>
      ) : isOwner ? (
        <OwnerResources key={projectId} projectId={projectId} />
      ) : (
        <ResourceList projectId={projectId} />
      )}
    </section>
  );
}
