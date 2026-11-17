import type { UploadItem } from "@/lib/uploads/types";

// Sending the bytes fills the bar to 95%, last 5% is waiting for "done"
const UPLOAD_SHARE = 95;

function bytesPercent(item: UploadItem): number {
  if (item.totalBytes <= 0) return 0;
  const sent = Math.min(item.bytesSent, item.totalBytes);
  return Math.floor((sent / item.totalBytes) * UPLOAD_SHARE);
}

export function progressPercent(item: UploadItem): number {
  switch (item.status) {
    case "queued":
      return 0;
    case "uploading":
    case "error":
      return bytesPercent(item);
    case "completing":
    case "processing":
    case "attaching":
      return UPLOAD_SHARE;
    case "done":
      return 100;
  }
}
