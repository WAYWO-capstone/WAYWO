// File uploads: the browser sends the file straight to R2 with a signed URL.
import { api, publicApi, unwrap } from "@/api/client";
import type {
  CreatedUpload,
  UploadConfig,
  UploadKind,
  UploadResult,
} from "@/lib/uploads/api-types";

const uploadPath = (uploadId: string) => ({ path: { upload_id: uploadId } });

export async function getUploadConfig(): Promise<UploadConfig> {
  return (await unwrap(publicApi.GET("/uploads/config"))) as UploadConfig;
}

export function createUpload(kind: UploadKind, file: File): Promise<CreatedUpload> {
  return unwrap(
    api.POST("/uploads", {
      // Browsers leave the `type` field empty for most maker files so the backend goes by extension instead.
      body: { kind, filename: file.name, size: file.size, mime_type: file.type },
    }),
  );
}

export function completeUpload(uploadId: string): Promise<UploadResult> {
  return unwrap(api.POST("/uploads/{upload_id}/complete", { params: uploadPath(uploadId) }));
}

export function getUpload(uploadId: string): Promise<UploadResult> {
  return unwrap(api.GET("/uploads/{upload_id}", { params: uploadPath(uploadId) }));
}
