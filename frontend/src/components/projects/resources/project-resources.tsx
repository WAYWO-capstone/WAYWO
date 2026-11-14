import { useState } from "react";
import { UploadDropzone } from "@/components/uploads/upload-dropzone";
import { UploadRow } from "@/components/uploads/upload-row";
import { useUploadConfig } from "@/lib/uploads/use-upload-config";
import { useUploadManager } from "@/lib/uploads/use-upload-manager";
import { acceptFor, splitFiles } from "@/lib/uploads/validate";

interface ProjectResourcesProps {
  // Missing in the sample preview.
  projectId?: string;
  isOwner: boolean;
}

const listClasses = "mt-2 min-h-0 flex-1 overflow-y-auto pr-1 focus-visible:outline-2 focus-visible:outline-ring";

function EmptyList() {
  return <p className="py-6 text-sm text-muted-foreground">No files yet.</p>;
}

function OwnerResources() {
  const config = useUploadConfig();
  const uploads = useUploadManager();
  const [errors, setErrors] = useState<string[]>([]);
  const rules = config.data?.RESOURCE;

  const onFiles = (files: File[]) => {
    if (!rules) return;
    const { valid, errors: rejected } = splitFiles(files, rules);
    setErrors(rejected);
    if (valid.length > 0) uploads.add("RESOURCE", valid);
  };

  return (
    <>
      <div tabIndex={0} aria-label="Project files" className={listClasses}>
        {uploads.items.length === 0 ? (
          <EmptyList />
        ) : (
          <ul className="space-y-2">
            {uploads.items.map((item) => (
              <UploadRow key={item.id} item={item} onRetry={uploads.retry} onRemove={uploads.remove} />
            ))}
          </ul>
        )}
      </div>
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
      {projectId && isOwner ? (
        <OwnerResources />
      ) : (
        <div className={listClasses}>
          <EmptyList />
        </div>
      )}
    </section>
  );
}
