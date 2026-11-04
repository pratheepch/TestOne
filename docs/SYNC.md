# Cloud sync: what v1 already prepares

Cloud sync is planned for the next version. v1 stays local-only, but the data layer is built so sync can be added without migrating anyone's data.

## Already in place

| Piece | Where | Why it matters for sync |
|---|---|---|
| **Sync metadata on every record** (`id`, `createdAt`, `updatedAt`, `rev`, `deviceId`, `deletedAt`) | `src/core/types.ts` (`SyncMeta`) | Records can be compared and merged across devices |
| **UUIDs** for all ids | `crypto.randomUUID()` in `src/data/store.ts` | No id clashes between devices |
| **Soft deletes (tombstones)** | `deletedAt` | A deletion on one device can reach the others |
| **A single write path** that stamps `updatedAt`, bumps `rev` and sets `deviceId` | `save()` in `src/data/store.ts` | Every change is visible to a sync engine |
| **Outbox** of changes (`collection`, `id`, `rev`, `at`) | `outbox` store in `src/data/db.ts` | The sync engine knows exactly what to upload |
| **Deterministic merge** (newer `updatedAt`, then higher `rev`, then `deviceId`) | `src/core/merge.ts` | Every device reaches the same result. Backup import already uses it |
| **Device-only state kept apart** (energy override, time chip, check-in dismissal) | `DeviceState`, `device` store | Momentary state never syncs; settings do |
| **Versioned export format** | `BackupFile` in `src/core/merge.ts` | Doubles as a full-snapshot payload |

## What the next version adds

1. **Account and transport.** For example a small API or a hosted database with end-to-end encryption, so the server never sees task text.
2. **Push:** read the outbox, upload the current version of each changed record, clear entries on success.
3. **Pull:** fetch records changed since the last sync cursor, run `mergeRecords`, write the winners with `save(..., false)` so they keep their original stamps.
4. **Field-level merge (optional).** Record-level last-writer-wins is fine for one person on two devices. If edits often collide, merge per field using per-field timestamps.
5. **Settings to sync:** `Settings` already carries `SyncMeta`; `DeviceState` stays local.

Until then, **Export / Import** moves data between devices, using the same merge rules.
