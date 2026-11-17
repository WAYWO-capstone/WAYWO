import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/api/client";
import { completeUpload, createUpload, getUpload } from "@/api/uploads";
import type { UploadKind, UploadResult } from "@/lib/uploads/api-types";
import { R2UploadError, uploadToR2 } from "@/lib/uploads/r2-upload";
import type { UploadItem, UploadStatus } from "@/lib/uploads/types";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 30;

const ACTIVE: UploadStatus[] = ["queued", "uploading", "completing", "processing", "attaching"];
const LOCKED: UploadStatus[] = ["completing", "processing", "attaching"];

let nextId = 0;

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
        return error.message;
    }
  }
  return "Something went wrong. Try again.";
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface RunToken {
  abort?: () => void;
}

interface Run {
  token: RunToken;
  report: (changes: Partial<UploadItem>) => void;
  live: () => void;
  finish: () => void;
}

export function useUploadManager({ onUploaded }: UploadManagerOptions = {}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const onUploadedRef = useRef(onUploaded);
  const runs = useRef(new Map<string, RunToken>());

  useEffect(() => {
    onUploadedRef.current = onUploaded;
  });

  const update = useCallback((id: string, changes: Partial<UploadItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }, []);

  //file upload lifecycle
  const run = useCallback(
    async (item: UploadItem) => {
      const current = startRun(runs.current, item.id, update);
      try {
        current.report({ status: "uploading", uploadId: null, bytesSent: 0, error: null });
        const created = await createUpload(item.kind, item.file);
        current.live();
        current.report({ uploadId: created.upload_id });

        await sendToR2(item.file, created.url, created.headers, current);

        current.report({ status: "completing", bytesSent: item.totalBytes });
        if (!(await confirmReady(created.upload_id, current))) {
          current.report({ status: "error", error: "The file couldn't be verified after uploading. Try again." });
          return;
        }

        current.report({ status: "attaching" });
        await onUploadedRef.current?.({ ...item, uploadId: created.upload_id, status: "attaching" });
        current.live();
        current.report({ status: "done" });
      } catch (error) {
        if (error instanceof StaleRunError || isAbort(error)) return;
        current.report({ status: "error", error: errorMessage(error) });
      } finally {
        current.finish();
      }
    },
    [update],
  );

  const add = useCallback(
    (kind: UploadKind, files: File[]) => {
      const added = files.map<UploadItem>((file) => ({
        id: `upload-${++nextId}`,
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

  const remove = useCallback(
    (id: string) => {
      const item = items.find((candidate) => candidate.id === id);
      if (!item || LOCKED.includes(item.status)) return;
      runs.current.get(id)?.abort?.();
      runs.current.delete(id);
      setItems((current) => current.filter((candidate) => candidate.id !== id));
    },
    [items],
  );

  const isBusy = items.some((item) => ACTIVE.includes(item.status));

  // Asks the browser to confirm closing, reloading or leaving the site while
  // an upload is in progress. If the website closes the upload is cancelled
  useEffect(() => {
    if (!isBusy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isBusy]);

  // Cancels any uploads still running when the component unmounts.
  useEffect(() => {
    const current = runs.current;
    return () => {
      for (const token of current.values()) token.abort?.();
      current.clear();
    };
  }, []);

  return { items, add, retry, remove, isBusy };
}

// Cancel earlier attempts (of same file) and register with new token.
function startRun(
  runs: Map<string, RunToken>,
  id: string,
  update: (id: string, changes: Partial<UploadItem>) => void,
): Run {
  runs.get(id)?.abort?.();
  const token: RunToken = {};
  runs.set(id, token);
  const isCurrent = () => runs.get(id) === token;
  return {
    token,
    // Ignored once the run is stale.
    report: (changes) => {
      if (isCurrent()) update(id, changes);
    },
    // Every await can outlive the run, so call this after each one.
    live: () => {
      if (!isCurrent()) throw new StaleRunError();
    },
    finish: () => {
      if (isCurrent()) runs.delete(id);
    },
  };
}

//send file to file database (r2)
async function sendToR2(file: File, url: string, headers: Record<string, string>, run: Run) {
  const put = uploadToR2({ url, headers, file, onProgress: (bytesSent) => run.report({ bytesSent }) });
  run.token.abort = put.abort;
  await put.promise;
  run.token.abort = undefined;
  run.live();
}

async function confirmReady(uploadId: string, run: Run): Promise<boolean> {
  let result: UploadResult = await completeUpload(uploadId);
  run.live();
  for (let polls = 0; result.status === "PROCESSING" && polls < MAX_POLLS; polls++) {
    run.report({ status: "processing" });
    await wait(POLL_INTERVAL_MS);
    run.live();
    result = await getUpload(uploadId);
    run.live();
  }
  return result.status === "READY";
}
