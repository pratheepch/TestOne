// IndexedDB persistence. The UI never waits on this: the in-memory store is
// updated first and writes are flushed in the background.

import { openDB, type IDBPDatabase } from 'idb';
import type { CollectionName, SyncMeta } from '../core/types';

export const COLLECTIONS: CollectionName[] = ['tasks', 'projects', 'checkins', 'breaks', 'settings'];

export interface OutboxEntry {
  seq?: number;
  collection: CollectionName;
  id: string;
  rev: number;
  at: number;
}

let dbp: Promise<IDBPDatabase> | null = null;

export function db(): Promise<IDBPDatabase> {
  if (!dbp) {
    dbp = openDB('todoflow', 1, {
      upgrade(d) {
        for (const c of COLLECTIONS) d.createObjectStore(c, { keyPath: 'id' });
        d.createObjectStore('device');
        // Changes waiting to be sent by cloud sync (next version).
        d.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
      },
    });
  }
  return dbp;
}

export async function loadAll(): Promise<Record<CollectionName, SyncMeta[]>> {
  const d = await db();
  const out = {} as Record<CollectionName, SyncMeta[]>;
  await Promise.all(COLLECTIONS.map(async (c) => (out[c] = await d.getAll(c))));
  return out;
}

export async function getDevice<T>(key: string): Promise<T | undefined> {
  return (await db()).get('device', key);
}

export async function setDevice(key: string, value: unknown): Promise<void> {
  await (await db()).put('device', value, key);
}

// ---- Write queue ----
const pending = new Map<string, { collection: CollectionName; record: SyncMeta }>();
let scheduled = false;
let flushing: Promise<void> = Promise.resolve();

export function queueWrite(collection: CollectionName, record: SyncMeta): void {
  pending.set(`${collection}:${record.id}`, { collection, record });
  if (!scheduled) {
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      flushing = flushing.then(flush, flush);
    });
  }
}

async function flush(): Promise<void> {
  if (!pending.size) return;
  const batch = [...pending.values()];
  pending.clear();
  const d = await db();
  const tx = d.transaction([...COLLECTIONS, 'outbox'], 'readwrite');
  const now = Date.now();
  for (const { collection, record } of batch) {
    void tx.objectStore(collection).put(record);
    void tx.objectStore('outbox').add({ collection, id: record.id, rev: record.rev, at: now } satisfies OutboxEntry);
  }
  await tx.done;
}

/** Resolves once everything queued so far is on disk. */
export async function whenSaved(): Promise<void> {
  await new Promise((r) => queueMicrotask(() => r(null)));
  await flushing;
}

export async function clearEverything(): Promise<void> {
  const d = await db();
  const tx = d.transaction([...COLLECTIONS, 'outbox', 'device'], 'readwrite');
  await Promise.all([...COLLECTIONS, 'outbox', 'device'].map((s) => tx.objectStore(s as CollectionName).clear()));
  await tx.done;
}
