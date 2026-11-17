// File uploads: the browser sends the file straight to R2 with a signed URL.
import type {
  CreatedUpload,
  UploadConfig,
  UploadKind,
  UploadResult,
} from "@/lib/uploads/api-types";

function notWired(): never {
  throw new Error("Upload API is not wired yet");
}

export async function getUploadConfig(): Promise<UploadConfig> {
  return notWired();
}

export async function createUpload(
  _kind: UploadKind,
  _file: File,
): Promise<CreatedUpload> {
  return notWired();
}

export async function completeUpload(_uploadId: string): Promise<UploadResult> {
  return notWired();
}

export async function getUpload(_uploadId: string): Promise<UploadResult> {
  return notWired();
}
