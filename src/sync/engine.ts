// One sync round: download the file, merge it in, upload if this device has
// anything the file doesn't. Uploads only succeed if nobody changed the file
// in between (Dropbox rev check); otherwise the round starts again.

import { isBackupFile, type BackupFile } from '../core/merge';
import { ConflictError, type RemoteStore } from './dropbox';

export interface LocalSide {
  snapshot(): BackupFile;
  applyRemote(file: BackupFile): number;
  differsFrom(file: BackupFile | null): boolean;
}

export interface SyncResult {
  /** Records changed on this device by the download. */
  pulled: number;
  pushed: boolean;
  rev: string | null;
}

export async function syncOnce(remote: RemoteStore, local: LocalSide, maxTries = 4): Promise<SyncResult> {
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const file = await remote.download();
    let parsed: BackupFile | null = null;
    if (file) {
      try {
        parsed = JSON.parse(file.text);
      } catch {
        throw new Error('The TodoFlow file in Dropbox is damaged. Restore it from Dropbox file history, or delete it to start fresh.');
      }
      if (!isBackupFile(parsed)) throw new Error("The file in Dropbox isn't a TodoFlow file.");
    }
    const pulled = parsed ? local.applyRemote(parsed) : 0;
    if (!local.differsFrom(parsed)) return { pulled, pushed: false, rev: file?.rev ?? null };
    try {
      const rev = await remote.upload(JSON.stringify(local.snapshot()), file?.rev ?? null);
      return { pulled, pushed: true, rev };
    } catch (e) {
      if (e instanceof ConflictError) continue; // Another device saved first: merge again.
      throw e;
    }
  }
  throw new Error('Dropbox kept changing while syncing. Try again in a moment.');
}
