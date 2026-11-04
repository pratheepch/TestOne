// Data model. Every stored record carries SyncMeta so that cloud sync (next
// version) can merge records from several devices without a migration.
// See docs/SYNC.md.

export type Energy = 'low' | 'med' | 'high';
export type Status = 'inbox' | 'next' | 'waiting' | 'someday' | 'done' | 'trash';
export type Source = 'auto' | 'user';

export interface SyncMeta {
  /** Globally unique id (crypto.randomUUID), never reused. */
  id: string;
  createdAt: number;
  /** Last change, ms since epoch. Merge keeps the newer record. */
  updatedAt: number;
  /** Increases by one on every local change; breaks updatedAt ties. */
  rev: number;
  /** Device that made the last change. */
  deviceId: string;
  /** Soft delete (tombstone) so deletions can sync. */
  deletedAt?: number;
}

export interface Repeat {
  kind: 'daily' | 'weekdays' | 'weekly' | 'monthly';
  /** Weekly: days of week, 0 = Sunday. */
  days?: number[];
  /** Monthly: day of month, 1–31 (clamped to the month's length). */
  dayOfMonth?: number;
}

export interface Task extends SyncMeta {
  title: string;
  notes?: string;
  status: Status;
  energy: Energy;
  energySource: Source;
  estimateMin: number;
  estimateSource: Source;
  context?: string;
  projectId?: string;
  waitingOn?: string;
  /** Local date YYYY-MM-DD; hidden from Now until then. */
  deferUntil?: string;
  lastTouchedAt: number;
  doneAt?: number;
  /** Energy level the person was at when finishing. */
  doneEnergy?: Energy;
  /** Real minutes, from the focus timer. */
  actualMin?: number;
  effortPts?: number;
  effortSource?: Source;
  /** Timestamps of "Not now" swipes (last 10). */
  skips: number[];
  /** Focus timer start, if running. */
  startedAt?: number;
  repeat?: Repeat;
  repeatSeriesId?: string;
  /** For repeat instances: the scheduled date this copy belongs to. */
  scheduledFor?: string;
}

export interface Project extends SyncMeta {
  name: string;
  status: 'active' | 'someday' | 'done';
}

export interface DayCheckIn extends SyncMeta {
  /** Local date YYYY-MM-DD (one per day). */
  date: string;
  mood: 1 | 2 | 3 | 4 | 5;
  note?: string;
}

export interface BreakLog extends SyncMeta {
  kind: string;
  startedAt: number;
  minutes: number;
}

export type EnergyCurve = Energy[]; // 24 entries, one per hour

/** Settings that follow the person across devices. */
export interface Settings extends SyncMeta {
  onboarded: boolean;
  energyCurve: EnergyCurve;
  quietDays: number;
  /** 0 = Sunday. */
  reviewDay: number;
  lastReviewAt?: number;
  lastExportAt?: number;
  checkInEnabled: boolean;
  /** HH:MM local. */
  checkInTime: string;
  paceEnabled: boolean;
  steadyLow: number;
  steadyHigh: number;
  overreach: number;
  calibrationDays: number;
}

/** Device-only state; never synced. */
export interface DeviceState {
  energyOverride?: { level: Energy; until: number };
  timeAvailable?: number; // minutes, from the time chip
  checkInDismissedFor?: string; // date
}

export type CollectionName = 'tasks' | 'projects' | 'checkins' | 'breaks' | 'settings';
