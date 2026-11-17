// Upload API types, taken from the backend spec (will be replaced once the backend is done).

export type UploadKind = "PICTURE" | "RESOURCE";

// Status of the upload on the backend. PROCESSING is reserved for a future job queue.
export type UploadStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";

// Rules for one kind (`UploadKindConfigRead`).
export interface UploadKindConfig {
  max_size: number;
  allowed_mime: string[];
  allowed_extensions: string[];
}

// Response of `GET /uploads/config`
export type UploadConfig = Record<UploadKind, UploadKindConfig>;

// Response of `POST /uploads` (`UploadCreated`).
export interface CreatedUpload {
  upload_id: string;
  url: string;
  // Headers to send with the PUT to R2, exactly as given.
  headers: Record<string, string>;
  expires_at: string;
}

// Response of `POST /uploads/:id/complete` and `GET /uploads/:id` (`UploadRead`).
export interface UploadResult {
  upload_id: string;
  kind: UploadKind;
  filename: string;
  size: number;
  status: UploadStatus;
}
