// Record-level merge, shared by backup import today and cloud sync later.
// Rule: the newer updatedAt wins; ties go to the higher rev, then the
// lexically larger deviceId so every device reaches the same answer.

import type { CollectionName, SyncMeta } from './types';

export function newer<T extends SyncMeta>(a: T, b: T): T {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  if (a.rev !== b.rev) return a.rev > b.rev ? a : b;
  return a.deviceId >= b.deviceId ? a : b;
}

export interface MergeResult<T> {
  merged: T[];
  /** Records from `incoming` that won and must be written locally. */
  changed: T[];
}

export function mergeRecords<T extends SyncMeta>(local: T[], incoming: T[]): MergeResult<T> {
  const byId = new Map(local.map((r) => [r.id, r]));
  const changed: T[] = [];
  for (const r of incoming) {
    const cur = byId.get(r.id);
    const win = cur ? newer(cur, r) : r;
    if (win !== cur) {
      byId.set(r.id, win);
      changed.push(win);
    }
  }
  return { merged: [...byId.values()], changed };
}

export const BACKUP_APP = 'todoflow';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: number;
  deviceId: string;
  data: Partial<Record<CollectionName, SyncMeta[]>>;
}

export function isBackupFile(x: unknown): x is BackupFile {
  const b = x as BackupFile;
  return !!b && b.app === BACKUP_APP && typeof b.version === 'number' && typeof b.data === 'object';
}
