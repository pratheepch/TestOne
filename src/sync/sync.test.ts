import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { ConflictError, DropboxStore, challengeFor, randomString, type RemoteFile, type RemoteStore } from './dropbox';
import { syncOnce, type LocalSide } from './engine';
import { BACKUP_APP, BACKUP_VERSION, mergeRecords, type BackupFile } from '../core/merge';
import type { Task } from '../core/types';
import * as S from '../data/store';

// ---------- Fakes ----------
class FakeDropbox implements RemoteStore {
  file: RemoteFile | null = null;
  n = 0;
  uploads = 0;
  /** Simulate another device saving just before our next upload. */
  sneakIn: string | null = null;
  async download() {
    return this.file ? { ...this.file } : null;
  }
  async upload(text: string, rev: string | null) {
    if (this.sneakIn) {
      this.file = { text: this.sneakIn, rev: `r${++this.n}` };
      this.sneakIn = null;
    }
    if ((this.file?.rev ?? null) !== rev) throw new ConflictError();
    this.uploads++;
    this.file = { text, rev: `r${++this.n}` };
    return this.file.rev;
  }
}

let seq = 0;
function task(title: string, updatedAt = 1000): Task {
  return {
    id: `t-${title}`, createdAt: 1, updatedAt, rev: 1, deviceId: 'x', title, status: 'next',
    energy: 'low', energySource: 'auto', estimateMin: 5, estimateSource: 'auto', lastTouchedAt: 1, skips: [],
  };
}

/** An in-memory device, to simulate two phones syncing through one Dropbox. */
class Device implements LocalSide {
  tasks: Task[] = [];
  constructor(public name: string) {}
  file(list: Task[]): BackupFile {
    return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: ++seq, deviceId: this.name, data: { tasks: list } };
  }
  snapshot() { return this.file(this.tasks); }
  applyRemote(f: BackupFile) {
    const r = mergeRecords(this.tasks, (f.data.tasks ?? []) as Task[]);
    this.tasks = r.merged;
    return r.changed.length;
  }
  differsFrom(f: BackupFile | null) {
    if (!f) return true;
    const remote = new Map((f.data.tasks ?? []).map((t) => [t.id, t]));
    return this.tasks.some((t) => remote.get(t.id)?.updatedAt !== t.updatedAt);
  }
}

describe('sync engine', () => {
  it('creates the file on first sync', async () => {
    const box = new FakeDropbox();
    const a = new Device('a');
    a.tasks = [task('one')];
    expect(await syncOnce(box, a)).toMatchObject({ pushed: true, pulled: 0 });
    expect(JSON.parse(box.file!.text).data.tasks).toHaveLength(1);
  });

  it('restores everything on a new device without uploading again', async () => {
    const box = new FakeDropbox();
    const a = new Device('a');
    a.tasks = [task('one'), task('two')];
    await syncOnce(box, a);
    const b = new Device('b');
    const r = await syncOnce(box, b);
    expect(r).toMatchObject({ pulled: 2, pushed: false });
    expect(b.tasks.map((t) => t.title).sort()).toEqual(['one', 'two']);
    expect(box.uploads).toBe(1);
  });

  it('merges both phones, newest edit wins', async () => {
    const box = new FakeDropbox();
    const a = new Device('a');
    const b = new Device('b');
    a.tasks = [task('shared', 1000), task('only-a')];
    await syncOnce(box, a);
    await syncOnce(box, b);
    b.tasks = b.tasks.map((t) => (t.id === 't-shared' ? { ...t, title: 'edited on b', updatedAt: 2000 } : t));
    b.tasks.push(task('only-b'));
    await syncOnce(box, b);
    await syncOnce(box, a);
    expect(a.tasks.find((t) => t.id === 't-shared')?.title).toBe('edited on b');
    expect(a.tasks.map((t) => t.id).sort()).toEqual(['t-only-a', 't-only-b', 't-shared']);
  });

  it('retries when another device saved first, and loses nothing', async () => {
    const box = new FakeDropbox();
    const a = new Device('a');
    a.tasks = [task('from-a')];
    const other = new Device('other');
    box.sneakIn = JSON.stringify(other.file([task('from-other')]));
    await syncOnce(box, a);
    const saved = JSON.parse(box.file!.text) as BackupFile;
    expect(saved.data.tasks!.map((t) => t.id).sort()).toEqual(['t-from-a', 't-from-other']);
  });

  it('refuses a damaged or foreign file instead of overwriting it', async () => {
    const box = new FakeDropbox();
    box.file = { text: '{not json', rev: 'r1' };
    await expect(syncOnce(box, new Device('a'))).rejects.toThrow(/damaged/);
    box.file = { text: '{"hello":1}', rev: 'r2' };
    await expect(syncOnce(box, new Device('a'))).rejects.toThrow(/isn't a TodoFlow file/);
    expect(box.uploads).toBe(0);
  });
});

describe('store integration', () => {
  it('merging a synced file does not count as a local change', () => {
    const before = S.localChanges.value;
    S.createTask('Local task');
    expect(S.localChanges.value).toBe(before + 1);
    const remote = S.snapshot();
    remote.data.tasks = [...(remote.data.tasks ?? []), task('from-cloud', Date.now())];
    const n = S.localChanges.value;
    expect(S.applyRemote(remote)).toBe(1);
    expect(S.localChanges.value).toBe(n);
    expect(S.differsFrom(remote)).toBe(false);
    S.createTask('Another');
    expect(S.differsFrom(remote)).toBe(true);
  });

  it('a fresh device takes the settings of an existing account', () => {
    expect(S.settings.value.onboarded).toBe(false);
    const remote = S.snapshot();
    remote.data.settings = [{ ...S.settings.value, onboarded: true, quietDays: 30, updatedAt: 1 }];
    S.applyRemote(remote);
    expect(S.settings.value).toMatchObject({ onboarded: true, quietDays: 30 });
  });
});

// ---------- Dropbox HTTP client ----------
function res(status: number, body: string, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers });
}

describe('Dropbox client', () => {
  const fresh = { accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 3_600_000 };

  it('treats a missing file as empty', async () => {
    const f = async () => res(409, '{"error_summary":"path/not_found/.."}');
    expect(await new DropboxStore('k', fresh, () => {}, f as typeof fetch).download()).toBeNull();
  });

  it('reads the rev from the result header', async () => {
    const f = async () => res(200, '{"app":"todoflow"}', { 'Dropbox-API-Result': '{"rev":"abc"}' });
    expect(await new DropboxStore('k', fresh, () => {}, f as typeof fetch).download()).toEqual({ text: '{"app":"todoflow"}', rev: 'abc' });
  });

  it('turns a rev mismatch into a ConflictError and sends update mode', async () => {
    let arg = '';
    const f = async (_u: RequestInfo | URL, init?: RequestInit) => {
      arg = (init!.headers as Record<string, string>)['Dropbox-API-Arg'];
      return res(409, '{"error_summary":"path/conflict/file/.."}');
    };
    await expect(new DropboxStore('k', fresh, () => {}, f as typeof fetch).upload('x', 'r1')).rejects.toBeInstanceOf(ConflictError);
    expect(JSON.parse(arg).mode).toEqual({ '.tag': 'update', update: 'r1' });
  });

  it('refreshes an expired token before calling Dropbox', async () => {
    const calls: string[] = [];
    let saved: unknown;
    const f = async (u: RequestInfo | URL, init?: RequestInit) => {
      calls.push(String(u));
      if (String(u).includes('oauth2/token')) {
        expect(String(init!.body)).toContain('grant_type=refresh_token');
        return res(200, '{"access_token":"NEW","expires_in":14400}');
      }
      expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer NEW');
      return res(200, '{"rev":"r9"}');
    };
    const c = new DropboxStore('k', { ...fresh, expiresAt: 0 }, (t) => (saved = t), f as typeof fetch);
    expect(await c.upload('x', null)).toBe('r9');
    expect(calls[0]).toContain('oauth2/token');
    expect(saved).toMatchObject({ accessToken: 'NEW', refreshToken: 'R' });
  });

  it('builds PKCE challenges as base64url(SHA-256(verifier)), matching an independent implementation', async () => {
    const { createHash } = await import('node:crypto');
    for (let i = 0; i < 50; i++) {
      const v = randomString(64);
      expect(v).toMatch(/^[A-Za-z0-9_-]{64}$/);
      expect(await challengeFor(v)).toBe(createHash('sha256').update(v).digest('base64url'));
    }
  });
});
