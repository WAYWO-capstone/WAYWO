// Keeps unsaved project changes in the browser so they survive a closed tab,
// a failed save or an expired session.
import type { ProjectInput } from "@/lib/api";
import { getTokenUserId } from "@/lib/token-store";

export interface DraftBackup {
  value: ProjectInput;
  // When the backup was written, in ms.
  writtenAt: number;
}

// A server save this much newer than the backup came from somewhere else (another tab or device).
const NEWER_ON_SERVER_MS = 5 * 60_000;

// One backup per user and project; "new" is the create page before the draft exists.
function backupKey(projectId: string | null) {
  const userId = getTokenUserId();
  return userId ? `waywo.unsaved-project.${userId}.${projectId ?? "new"}` : null;
}

function isProjectInput(value: unknown): value is ProjectInput {
  if (typeof value !== "object" || value === null) return false;
  const project = value as Record<string, unknown>;
  return ["title", "summary", "description", "category_id"].every((field) => typeof project[field] === "string")
    && Array.isArray(project.tags) && project.tags.every((tag) => typeof tag === "string");
}

// Storage can be full or blocked (private windows); the backup is a safety net, so failures are ignored.
export function writeDraftBackup(projectId: string | null, value: ProjectInput | null) {
  const key = backupKey(projectId);
  if (!key) return;
  try {
    if (value) localStorage.setItem(key, JSON.stringify({ value, writtenAt: Date.now() }));
    else localStorage.removeItem(key);
  } catch {
    // Nothing else to fall back on.
  }
}

export function readDraftBackup(projectId: string | null): DraftBackup | null {
  const key = backupKey(projectId);
  if (!key) return null;
  try {
    const backup: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (typeof backup !== "object" || backup === null) return null;
    const { value, writtenAt } = backup as Record<string, unknown>;
    return isProjectInput(value) && typeof writtenAt === "number" ? { value, writtenAt } : null;
  } catch {
    return null;
  }
}

// The backup to restore over what the server has, if any. A backup that matches
// the server, or that the server has clearly moved past, is removed instead.
export function restorableDraftBackup(projectId: string | null, server: ProjectInput | null, serverSavedAt: string | null) {
  const backup = readDraftBackup(projectId);
  if (!backup) return null;
  const sameAsServer = server !== null && JSON.stringify(backup.value) === JSON.stringify(server);
  const outdated = serverSavedAt !== null && new Date(serverSavedAt).getTime() - backup.writtenAt > NEWER_ON_SERVER_MS;
  if (sameAsServer || outdated) {
    writeDraftBackup(projectId, null);
    return null;
  }
  return backup;
}
