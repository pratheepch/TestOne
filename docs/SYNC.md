# Sync

TodoFlow works fully offline and keeps its data on the device. Dropbox sync is optional: turn it on and everything is also kept in your Dropbox, and comes back on another phone.

## The groundwork in the data layer

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

## Dropbox sync (built)

Turn on **Settings → Sync → Sync with Dropbox** (or **Restore from Dropbox** on the first screen of a new install).

- **Where:** one file, `Apps/TodoFlow/todoflow.json` in the person's own Dropbox, in the same format as Export. The app can only see its own folder.
- **Sign-in:** OAuth 2 with PKCE straight from the browser (`src/sync/dropbox.ts`). No server and no secret; the refresh token stays in this device's IndexedDB and is never synced. If iOS returns the sign-in to a different browser than the Home Screen app, that page shows a code to paste back into the app.
- **A sync round** (`src/sync/engine.ts`): download the file, merge it in with the record rules above, and upload only if this device has something the file doesn't. The upload only succeeds if the file is still at the version that was read (Dropbox `rev`); if another device saved in between, the round starts again, so nothing is overwritten.
- **When it runs** (`src/sync/index.ts`): on opening the app, 3 seconds after a change, when the app goes to the background with changes waiting, and when the phone comes back online. Merging in remote changes never counts as a local change, so sync doesn't loop.
- **A fresh install** that restores takes the existing account's settings and skips setup.
- **Safety:** a damaged or foreign file in Dropbox is never overwritten; the app stops and says so.
- **Turning it off** revokes the token. Data stays on the phone and in Dropbox.

### Setup (one time)

1. dropbox.com/developers/apps → **Create app** → **Scoped access** → **App folder** → name it TodoFlow.
2. **Permissions:** tick `files.content.read` and `files.content.write`, then Submit.
3. **Settings → OAuth 2 → Redirect URIs:** add `https://pratheepch.github.io/TestOne/` (and `http://localhost:5173/` for development).
4. Put the **App key** in `src/sync/config.ts` (it is public by design), or set `VITE_DROPBOX_APP_KEY` at build time.

Until the key is set, Settings says sync isn't switched on yet and everything else works as before.

### Tests

- `src/sync/sync.test.ts`: two simulated phones through a fake Dropbox (first upload, restore, newest edit wins, conflict retry, damaged files), the HTTP client against a fake network (missing file, rev header, conflict, token refresh), and PKCE against Node's crypto.
- `e2e/sync.mjs`: the real app in an emulated iPhone with Dropbox mocked at the network level: sign-in round trip, auto-upload, restore on a second phone during setup, changes flowing back, and the paste-code page.

## Later

- iCloud (CloudKit JS) as a second option. It needs a paid Apple Developer account.
- Field-level merge, if edits often collide.
