// Sends a file straight to R2 with the signed URL.
// Uses XHR because fetch can't report upload progress.
// skips `api` because R2 rejects the Authorization header.

export interface R2UploadRequest {
  url: string;
  headers: Record<string, string>;
  file: File;
  onProgress?: (bytesSent: number, totalBytes: number) => void;
}

export interface PendingR2Upload {
  promise: Promise<void>;
  abort: () => void;
}

export class R2UploadError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "R2UploadError";
    this.status = status;
  }
}

function errorForStatus(status: number): R2UploadError {
  if (status === 403) {
    return new R2UploadError(status, "The upload link expired or was rejected. Try again.");
  }
  return new R2UploadError(status, `Upload failed (status ${status}). Try again.`);
}

export function uploadToR2({ url, headers, file, onProgress }: R2UploadRequest): PendingR2Upload {
  const xhr = new XMLHttpRequest();

  const promise = new Promise<void>((resolve, reject) => {
    xhr.upload.onprogress = (event) => {
      onProgress?.(event.loaded, event.lengthComputable ? event.total : file.size);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(errorForStatus(xhr.status));
    };
    xhr.onerror = () => {
      reject(new R2UploadError(0, "The upload failed. Check your connection and try again."));
    };
    xhr.onabort = () => {
      reject(new DOMException("The upload was canceled.", "AbortError"));
    };

    xhr.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.send(file.slice(0, file.size, ""));
  });

  return { promise, abort: () => xhr.abort() };
}
