import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/api/client";
import { completeUpload, createUpload, getUpload } from "@/api/uploads";
import type { UploadKind, UploadResult } from "@/lib/uploads/api-types";
import { R2UploadError, uploadToR2 } from "@/lib/uploads/r2-upload";
import type { UploadItem, UploadStatus } from "@/lib/uploads/types";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 30;

const ACTIVE: UploadStatus[] = ["queued", "uploading", "completing", "processing", "attaching"];

// add option to attach and action after upload is done
export interface UploadManagerOptions {
  onUploaded?: (item: UploadItem) => Promise<unknown> | void;
}

// Thrown when a run was removed, retried or unmounted, so it stops quietly.
class StaleRunError extends Error {}

function errorMessage(error: unknown): string {
  if (error instanceof R2UploadError) return error.message;
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        return "Your session expired. Log in again.";
      case 403:
        return "You're not allowed to upload here.";
      case 413:
        return "This file is too large.";
      case 400:
      case 409:
      case 422:
        return error.message;
    }
  }
  return "Something went wrong. Try again.";
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useUploadManager({ onUploaded }: UploadManagerOptions = {}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const onUploadedRef = useRef(onUploaded);
  const runs = useRef(new Map<string, { abort?: () => void }>());

  useEffect(() => {
    onUploadedRef.current = onUploaded;
  });

  const update = useCallback((id: string, changes: Partial<UploadItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }, []);


  //file upload lifecycle
  const run = useCallback(
    async (item: UploadItem) => {
      const token: { abort?: () => void } = {};
      runs.current.get(item.id)?.abort?.();
      runs.current.set(item.id, token);
      // Every await can outlive the run, so check it is still the current one.
      const live = () => {
        if (runs.current.get(item.id) !== token) throw new StaleRunError();
      };

      try {
        update(item.id, { status: "uploading", uploadId: null, bytesSent: 0, error: null });
        const created = await createUpload(item.kind, item.file);
        live();
        update(item.id, { uploadId: created.upload_id });

        const put = uploadToR2({
          url: created.url,
          headers: created.headers,
          file: item.file,
          onProgress: (bytesSent) => {
            if (runs.current.get(item.id) === token) update(item.id, { bytesSent });
          },
        });
        token.abort = put.abort;
        await put.promise;
        token.abort = undefined;
        live();

        update(item.id, { status: "completing", bytesSent: item.totalBytes });
        let result: UploadResult = await completeUpload(created.upload_id);
        live();
        for (let polls = 0; result.status === "PROCESSING" && polls < MAX_POLLS; polls++) {
          update(item.id, { status: "processing" });
          await wait(POLL_INTERVAL_MS);
          live();
          result = await getUpload(created.upload_id);
          live();
        }
        if (result.status !== "READY") {
          update(item.id, { status: "error", error: "The file couldn't be verified after uploading. Try again." });
          return;
        }

        update(item.id, { status: "attaching" });
        await onUploadedRef.current?.({ ...item, uploadId: created.upload_id, status: "attaching" });
        live();
        update(item.id, { status: "done" });
      } catch (error) {
        if (error instanceof StaleRunError || isAbort(error)) return;
        if (runs.current.get(item.id) !== token) return;
        update(item.id, { status: "error", error: errorMessage(error) });
      } finally {
        if (runs.current.get(item.id) === token) runs.current.delete(item.id);
      }
    },
    [update],
  );

  const add = useCallback(
    (kind: UploadKind, files: File[]) => {
      const added = files.map<UploadItem>((file) => ({
        id: crypto.randomUUID(),
        kind,
        file,
        uploadId: null,
        status: "queued",
        bytesSent: 0,
        totalBytes: file.size,
        error: null,
      }));
      setItems((current) => [...current, ...added]);
      for (const item of added) void run(item);
    },
    [run],
  );

  // Always starts a new upload, since the signed URL may have expired.
  const retry = useCallback(
    (id: string) => {
      const item = items.find((candidate) => candidate.id === id);
      if (item?.status === "error") void run(item);
    },
    [items, run],
  );

  const remove = useCallback((id: string) => {
    runs.current.get(id)?.abort?.();
    runs.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const isBusy = items.some((item) => ACTIVE.includes(item.status));

  useEffect(() => {
    if (!isBusy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isBusy]);

  useEffect(() => {
    const current = runs.current;
    return () => {
      for (const token of current.values()) token.abort?.();
      current.clear();
    };
  }, []);

  return { items, add, retry, remove, isBusy };
}
