import type { UploadKind } from "@/lib/uploads/api-types";

// Where a file is in the upload flow on this page.
export type UploadStatus =
  | "queued" //for future implementation if needed
  | "uploading"
  | "completing"
  | "processing"
  | "attaching"
  | "done"
  | "error";

export interface UploadItem {
  id: string;
  kind: UploadKind;
  file: File;
  uploadId: string | null;
  status: UploadStatus;
  bytesSent: number;
  totalBytes: number;
  error: string | null;
}
