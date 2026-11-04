// App state: in-memory signals, persisted in the background.
// Every change goes through `save`, which stamps sync metadata.

import { computed, signal } from '@preact/signals';
import type {
  BreakLog, CollectionName, DayCheckIn, DeviceState, Energy, Project, Settings, Status, SyncMeta, Task,
} from '../core/types';
import { parseCapture } from '../core/parse';
import { estimate } from '../core/estimate';
import { autoEffort } from '../core/pace';
import { currentEnergy, curveFor, OVERRIDE_MS } from '../core/energy';
import { firstOnOrAfter, nextAfter } from '../core/repeat';
import { toDateKey } from '../core/dates';
import { BACKUP_APP, BACKUP_VERSION, isBackupFile, mergeRecords, type BackupFile } from '../core/merge';
import { clearEverything, getDevice, loadAll, queueWrite, setDevice } from './db';

export const tasks = signal<Task[]>([]);
export const projects = signal<Project[]>([]);
export const checkins = signal<DayCheckIn[]>([]);
export const breaks = signal<BreakLog[]>([]);
export const settings = signal<Settings>(defaultSettings('pending', 0));
export const device = signal<DeviceState>({});
export const ready = signal(false);
/** Ticks every 30 s so time-based views stay fresh. */
export const now = signal(Date.now());

export const liveTasks = computed(() => tasks.value.filter((t) => !t.deletedAt));
export const inboxTasks = computed(() => liveTasks.value.filter((t) => t.status === 'inbox').sort((a, b) => b.createdAt - a.createdAt));
export const liveProjects = computed(() => projects.value.filter((p) => !p.deletedAt));
export const energyNow = computed(() => currentEnergy(settings.value.energyCurve, device.value, now.value));

let deviceId = 'local';

const SIGNALS: Record<CollectionName, { value: SyncMeta[] }> = {
  tasks, projects, checkins, breaks,
  settings: { get value() { return [settings.value]; }, set value(v: SyncMeta[]) { if (v[0]) settings.value = v[0] as Settings; } },
} as unknown as Record<CollectionName, { value: SyncMeta[] }>;

function defaultSettings(id: string, t: number): Settings {
  return {
    id, createdAt: t, updatedAt: t, rev: 0, deviceId: 'local',
    onboarded: false,
    energyCurve: curveFor('morning'),
    quietDays: 21,
    reviewDay: 0,
    checkInEnabled: true,
    checkInTime: '20:00',
    paceEnabled: true,
    steadyLow: 0.8,
    steadyHigh: 1.3,
    overreach: 1.5,
    calibrationDays: 14,
  };
}

function meta(t = Date.now()): SyncMeta {
  return { id: crypto.randomUUID(), createdAt: t, updatedAt: t, rev: 1, deviceId };
}

/** Write a record: stamp it, update memory, persist in the background. */
function save<T extends SyncMeta>(collection: CollectionName, record: T, stamp = true): T {
  const r = stamp ? { ...record, updatedAt: Math.max(Date.now(), record.updatedAt + 1), rev: record.rev + 1, deviceId } : record;
  const sig = SIGNALS[collection];
  if (collection === 'settings') {
    settings.value = r as unknown as Settings;
  } else {
    const list = sig.value as T[];
    const i = list.findIndex((x) => x.id === r.id);
    sig.value = i === -1 ? [...list, r] : list.map((x, j) => (j === i ? r : x));
  }
  queueWrite(collection, r);
  return r;
}

export async function init(): Promise<void> {
  deviceId = (await getDevice<string>('deviceId')) ?? crypto.randomUUID();
  await setDevice('deviceId', deviceId);
  const all = await loadAll();
  tasks.value = all.tasks as Task[];
  projects.value = all.projects as Project[];
  checkins.value = all.checkins as DayCheckIn[];
  breaks.value = all.breaks as BreakLog[];
  const s = all.settings[0] as Settings | undefined;
  if (s) settings.value = { ...defaultSettings(s.id, s.createdAt), ...s };
  else save('settings', { ...defaultSettings('settings', Date.now()), deviceId }, false);
  device.value = (await getDevice<DeviceState>('state')) ?? {};
  ready.value = true;
  setInterval(() => (now.value = Date.now()), 30_000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) now.value = Date.now();
  });
}

// ---------- Device state ----------
export function setDeviceState(patch: Partial<DeviceState>): void {
  device.value = { ...device.value, ...patch };
  void setDevice('state', device.value);
}

export function overrideEnergy(level: Energy): void {
  setDeviceState({ energyOverride: { level, until: Date.now() + OVERRIDE_MS } });
  now.value = Date.now();
}

export function setTimeAvailable(min: number | undefined): void {
  setDeviceState({ timeAvailable: min });
}

// ---------- Settings ----------
export function updateSettings(patch: Partial<Settings>): void {
  save('settings', { ...settings.value, ...patch });
}

// ---------- Projects ----------
export function ensureProject(name: string): Project {
  const clean = name.trim();
  const found = liveProjects.value.find((p) => p.name.toLowerCase() === clean.toLowerCase());
  if (found) return found;
  return save('projects', { ...meta(), name: clean, status: 'active' } as Project, false);
}

export function updateProject(id: string, patch: Partial<Project>): void {
  const p = projects.value.find((x) => x.id === id);
  if (p) save('projects', { ...p, ...patch });
}

// ---------- Tasks ----------
export function getTask(id: string): Task | undefined {
  return tasks.value.find((t) => t.id === id);
}

export function createTask(input: string): Task | null {
  const text = input.trim();
  if (!text) return null;
  const today = toDateKey(Date.now());
  const p = parseCapture(text, today);
  const est = estimate(p.title, tasks.value.filter((t) => t.status === 'done' || t.estimateSource === 'user' || t.energySource === 'user'));
  const t = Date.now();
  let deferUntil = p.deferUntil;
  let scheduledFor: string | undefined;
  if (p.repeat) {
    scheduledFor = firstOnOrAfter(p.repeat, p.deferUntil ?? today);
    deferUntil = scheduledFor > today ? scheduledFor : undefined;
  }
  const task: Task = {
    ...meta(t),
    title: p.title,
    status: p.waitingOn ? 'waiting' : 'inbox',
    energy: p.energy ?? est.energy,
    energySource: p.energy ? 'user' : 'auto',
    estimateMin: p.estimateMin ?? est.estimateMin,
    estimateSource: p.estimateMin ? 'user' : 'auto',
    context: p.context ?? est.context,
    projectId: p.project ? ensureProject(p.project).id : undefined,
    waitingOn: p.waitingOn,
    deferUntil,
    lastTouchedAt: t,
    skips: [],
    repeat: p.repeat,
    repeatSeriesId: p.repeat ? crypto.randomUUID() : undefined,
    scheduledFor,
  };
  return save('tasks', task, false);
}

export function updateTask(id: string, patch: Partial<Task>): Task | undefined {
  const cur = getTask(id);
  if (!cur) return;
  const next: Task = { ...cur, ...patch, lastTouchedAt: Date.now() };
  if (patch.energy && patch.energySource === undefined) next.energySource = 'user';
  if (patch.estimateMin && patch.estimateSource === undefined) next.estimateSource = 'user';
  if (patch.repeat !== undefined && patch.repeat && !cur.repeatSeriesId) {
    next.repeatSeriesId = crypto.randomUUID();
    next.scheduledFor = firstOnOrAfter(patch.repeat, toDateKey(Date.now()));
  }
  return save('tasks', next);
}

export function setStatus(id: string, status: Status): Task | undefined {
  return updateTask(id, { status });
}

export interface Undo {
  label: string;
  run: () => void;
}

/** Restores records to how they were. Used by every Undo toast. */
function undoTo(snapshots: { collection: CollectionName; before?: SyncMeta; after: SyncMeta }[], label: string): Undo {
  return {
    label,
    run: () => {
      for (const s of snapshots) {
        const cur = (SIGNALS[s.collection].value as SyncMeta[]).find((x) => x.id === s.after.id) ?? s.after;
        if (s.before) save(s.collection, { ...s.before, updatedAt: cur.updatedAt, rev: cur.rev });
        else save(s.collection, { ...cur, deletedAt: Date.now() });
      }
    },
  };
}

export function completeTask(id: string, energy: Energy = energyNow.value.level): Undo | undefined {
  const before = getTask(id);
  if (!before || before.status === 'done') return;
  const t = Date.now();
  const actualMin = before.startedAt ? Math.max(1, Math.round((t - before.startedAt) / 60_000)) : before.actualMin;
  const done = save('tasks', {
    ...before,
    status: 'done',
    doneAt: t,
    doneEnergy: energy,
    actualMin,
    startedAt: undefined,
    effortPts: before.effortSource === 'user' ? before.effortPts : autoEffort({ ...before, actualMin }),
    effortSource: before.effortSource ?? 'auto',
    lastTouchedAt: t,
  });
  const snaps: { collection: CollectionName; before?: SyncMeta; after: SyncMeta }[] = [{ collection: 'tasks', before, after: done }];
  if (before.repeat) {
    const today = toDateKey(t);
    const nextDate = nextAfter(before.repeat, before.scheduledFor ?? today, today);
    const copy = save('tasks', {
      ...before,
      ...meta(t),
      status: 'next',
      deferUntil: nextDate,
      scheduledFor: nextDate,
      lastTouchedAt: t,
      skips: [],
      actualMin: undefined,
      startedAt: undefined,
      doneAt: undefined,
      effortPts: undefined,
      effortSource: undefined,
    } as Task, false);
    snaps.push({ collection: 'tasks', after: copy });
  }
  return undoTo(snaps, 'Done');
}

export function skipTask(id: string): Undo | undefined {
  const before = getTask(id);
  if (!before) return;
  const after = save('tasks', { ...before, skips: [...before.skips, Date.now()].slice(-10) });
  return undoTo([{ collection: 'tasks', before, after }], 'Not now');
}

export function moveTask(id: string, status: Status, label: string): Undo | undefined {
  const before = getTask(id);
  if (!before) return;
  const after = updateTask(id, { status, ...(status === 'next' ? { skips: [] } : {}) });
  return after ? undoTo([{ collection: 'tasks', before, after }], label) : undefined;
}

export function deleteTask(id: string): Undo | undefined {
  const before = getTask(id);
  if (!before) return;
  const after = save('tasks', { ...before, deletedAt: Date.now() });
  return undoTo([{ collection: 'tasks', before, after }], 'Deleted');
}

/** Split a too-big task into smaller next actions. */
export function splitTask(id: string, parts: string[]): void {
  const t = getTask(id);
  if (!t) return;
  const proj = t.projectId ?? ensureProject(t.title).id;
  for (const p of parts) {
    const c = createTask(p);
    if (c) updateTask(c.id, { status: 'next', projectId: proj, energySource: c.energySource, estimateSource: c.estimateSource });
  }
  save('tasks', { ...t, deletedAt: Date.now() });
}

export function startTimer(id: string): void {
  updateTask(id, { startedAt: Date.now() });
}

export function stopTimer(id: string): void {
  updateTask(id, { startedAt: undefined });
}

// ---------- Check-ins & breaks ----------
export function saveCheckIn(mood: DayCheckIn['mood'], note?: string): void {
  const date = toDateKey(Date.now());
  const existing = checkins.value.find((c) => c.date === date && !c.deletedAt);
  if (existing) save('checkins', { ...existing, mood, note });
  else save('checkins', { ...meta(), date, mood, note } as DayCheckIn, false);
}

export function logBreak(kind: string, minutes: number, startedAt: number): void {
  save('breaks', { ...meta(), kind, minutes, startedAt } as BreakLog, false);
}

// ---------- Backup ----------
export function exportBackup(): BackupFile {
  updateSettings({ lastExportAt: Date.now() });
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    deviceId,
    data: {
      tasks: tasks.value, projects: projects.value, checkins: checkins.value, breaks: breaks.value, settings: [settings.value],
    },
  };
}

export function importBackup(json: unknown): { added: number } {
  if (!isBackupFile(json)) throw new Error("This doesn't look like a TodoFlow backup.");
  let added = 0;
  for (const c of ['tasks', 'projects', 'checkins', 'breaks', 'settings'] as CollectionName[]) {
    const incoming = json.data[c];
    if (!incoming?.length) continue;
    const { changed } = mergeRecords(SIGNALS[c].value, incoming);
    for (const r of changed) save(c, r, false);
    added += changed.length;
  }
  return { added };
}

export async function eraseAll(): Promise<void> {
  await clearEverything();
  location.reload();
}

