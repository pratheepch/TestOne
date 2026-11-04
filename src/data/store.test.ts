import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import * as S from './store';
import { loadAll, whenSaved } from './db';
import { addDays, toDateKey } from '../core/dates';

describe('store', () => {
  it('captures into the Inbox with estimates and parsed fields', () => {
    const t = S.createTask('Call dentist ~10m #health')!;
    expect(t).toMatchObject({ title: 'Call dentist', status: 'inbox', estimateMin: 10, estimateSource: 'user', energy: 'low', context: 'phone' });
    expect(S.liveProjects.value.map((p) => p.name)).toContain('health');
    expect(S.createTask('   ')).toBeNull();
  });

  it('completes, scores effort, and undoes', () => {
    const t = S.createTask('Write proposal')!;
    const undo = S.completeTask(t.id, 'high')!;
    const done = S.getTask(t.id)!;
    expect(done.status).toBe('done');
    expect(done.effortPts).toBe(60 * 3);
    undo.run();
    expect(S.getTask(t.id)!.status).toBe('inbox');
    expect(S.getTask(t.id)!.rev).toBeGreaterThan(done.rev);
  });

  it('creates exactly one next copy of a repeating task, and undo removes it', () => {
    const t = S.createTask('Take vitamins daily')!;
    const before = S.liveTasks.value.length;
    const undo = S.completeTask(t.id)!;
    const copies = S.liveTasks.value.filter((x) => x.repeatSeriesId === t.repeatSeriesId && x.status !== 'done');
    expect(copies).toHaveLength(1);
    expect(copies[0].deferUntil).toBe(addDays(toDateKey(Date.now()), 1));
    expect(S.liveTasks.value.length).toBe(before + 1);
    undo.run();
    expect(S.liveTasks.value.length).toBe(before);
  });

  it('records skips and persists to IndexedDB with an outbox', async () => {
    const t = S.createTask('Tidy desk')!;
    S.skipTask(t.id);
    expect(S.getTask(t.id)!.skips).toHaveLength(1);
    await whenSaved();
    const all = await loadAll();
    expect(all.tasks.find((x) => x.id === t.id)).toBeTruthy();
  });

  it('round-trips a backup and merges by newest', () => {
    const t = S.createTask('Backup me')!;
    const file = JSON.parse(JSON.stringify(S.exportBackup()));
    S.updateTask(t.id, { title: 'Changed later' });
    expect(S.importBackup(file).added).toBe(0); // local copy is newer
    expect(S.getTask(t.id)!.title).toBe('Changed later');
    expect(() => S.importBackup({ nope: 1 })).toThrow();
  });
});
