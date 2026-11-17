// Upload API types, taken from the generated backend schema.
import type { components } from "@/api/schema.gen";

type Schemas = components["schemas"];

export type UploadKind = Schemas["UploadKind"];

// Status of the upload on the backend. PROCESSING is reserved for a future job queue.
export type UploadStatus = Schemas["UploadStatus"];

// Rules for one kind.
export type UploadKindConfig = Schemas["UploadKindConfigRead"];

// Response of `GET /uploads/config`: the backend always returns every kind.
export type UploadConfig = Record<UploadKind, UploadKindConfig>;

// Response of `POST /uploads`. Send `headers` with the PUT to R2 exactly as given.
export type CreatedUpload = Schemas["UploadCreated"];

// Response of `POST /uploads/:id/complete` and `GET /uploads/:id`.
export type UploadResult = Schemas["UploadRead"];
