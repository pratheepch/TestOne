// Pace: a training-load style workload measure instead of streaks.
// effort = minutes × intensity (low 1, medium 2, high 3)
// Recent = 7-day daily average, Base = 28-day daily average, Pace = Recent / Base.

import type { BreakLog, DayCheckIn, Settings, Task } from './types';
import { intensity } from './energy';
import { addDays, daysBetween, toDateKey } from './dates';

export type Zone = 'calibrating' | 'easing' | 'steady' | 'stretching' | 'overreaching';

export const ZONE_LABEL: Record<Zone, string> = {
  calibrating: 'Calibrating',
  easing: 'Easing off',
  steady: 'Steady',
  stretching: 'Stretching',
  overreaching: 'Overreaching',
};

export const ZONE_MESSAGE: Record<Zone, string> = {
  calibrating: 'Learning your usual load. Zones appear after two weeks.',
  easing: 'Lighter than usual. Rest is allowed.',
  steady: "You're in your sustainable range.",
  stretching: 'Above your usual load. Fine for a sprint, plan some recovery.',
  overreaching: 'Well above your usual load. This is where burnout risk rises.',
};

export interface DayLoad {
  date: string;
  effort: number;
  highMin: number;
  totalMin: number;
  tasksDone: number;
  breaks: number;
  /** Effort per hour of the day (for the Day graph). */
  byHour: number[];
  /** High-intensity effort per hour, for bar brightness. */
  byHourEnergy: number[];
}

export function taskMinutes(t: Task): number {
  return t.actualMin && t.actualMin > 0 ? t.actualMin : t.estimateMin;
}

export function autoEffort(t: Pick<Task, 'estimateMin' | 'actualMin' | 'energy'>): number {
  const min = t.actualMin && t.actualMin > 0 ? t.actualMin : t.estimateMin;
  return Math.round(min * intensity(t.energy));
}

export function effortOf(t: Task): number {
  return t.effortPts ?? autoEffort(t);
}

function emptyDay(date: string): DayLoad {
  return { date, effort: 0, highMin: 0, totalMin: 0, tasksDone: 0, breaks: 0, byHour: Array(24).fill(0), byHourEnergy: Array(24).fill(0) };
}

export function dayLoads(tasks: Task[], breaks: BreakLog[]): Map<string, DayLoad> {
  const m = new Map<string, DayLoad>();
  const get = (k: string) => {
    let d = m.get(k);
    if (!d) m.set(k, (d = emptyDay(k)));
    return d;
  };
  for (const t of tasks) {
    if (t.deletedAt || t.status !== 'done' || !t.doneAt) continue;
    const d = get(toDateKey(t.doneAt));
    const e = effortOf(t);
    const min = taskMinutes(t);
    d.effort += e;
    d.totalMin += min;
    d.tasksDone += 1;
    if (t.energy === 'high') d.highMin += min;
    const h = new Date(t.doneAt).getHours();
    d.byHour[h] += e;
    d.byHourEnergy[h] = Math.max(d.byHourEnergy[h], intensity(t.energy));
  }
  for (const b of breaks) {
    if (b.deletedAt) continue;
    get(toDateKey(b.startedAt)).breaks += 1;
  }
  return m;
}

export interface PaceInput {
  tasks: Task[];
  breaks: BreakLog[];
  checkins: DayCheckIn[];
  settings: Pick<Settings, 'steadyLow' | 'steadyHigh' | 'overreach' | 'calibrationDays' | 'createdAt'>;
  now: number;
}

export interface PacePoint {
  date: string;
  effort: number;
  recent: number;
  base: number;
  ratio: number | null;
}

export interface PaceSignal {
  id: 'sustained' | 'noLightDay' | 'heavyHigh' | 'longWeek' | 'rough';
  message: string;
}

export interface PaceResult {
  today: DayLoad;
  recent: number;
  base: number;
  ratio: number | null;
  zone: Zone;
  daysTracked: number;
  series: PacePoint[];
  signals: PaceSignal[];
  loads: Map<string, DayLoad>;
}

function windowAvg(loads: Map<string, DayLoad>, end: string, days: number, start: string): number {
  // Average over the window, but never over days before tracking started.
  const span = Math.max(1, Math.min(days, daysBetween(start, end) + 1));
  let sum = 0;
  for (let i = 0; i < span; i++) sum += loads.get(addDays(end, -i))?.effort ?? 0;
  return sum / span;
}

export function zoneFor(ratio: number | null, s: PaceInput['settings'], calibrating: boolean): Zone {
  if (calibrating || ratio === null) return 'calibrating';
  if (ratio < s.steadyLow) return 'easing';
  if (ratio <= s.steadyHigh) return 'steady';
  if (ratio <= s.overreach) return 'stretching';
  return 'overreaching';
}

export function computePace(input: PaceInput, seriesDays = 30): PaceResult {
  const { settings: s, now } = input;
  const todayKey = toDateKey(now);
  const loads = dayLoads(input.tasks, input.breaks);
  const firstActivity = Math.min(
    s.createdAt,
    ...input.tasks.filter((t) => t.doneAt).map((t) => t.doneAt as number),
  );
  const start = toDateKey(Math.min(firstActivity, now));
  const daysTracked = daysBetween(start, todayKey) + 1;
  const calibrating = daysTracked < s.calibrationDays;

  const point = (date: string): PacePoint => {
    const recent = windowAvg(loads, date, 7, start);
    const base = windowAvg(loads, date, 28, start);
    return { date, effort: loads.get(date)?.effort ?? 0, recent, base, ratio: base > 0 ? recent / base : null };
  };

  const series: PacePoint[] = [];
  for (let i = seriesDays - 1; i >= 0; i--) series.push(point(addDays(todayKey, -i)));
  const cur = series[series.length - 1];

  const signals: PaceSignal[] = [];
  if (!calibrating) {
    let above = 0;
    for (let i = series.length - 1; i >= 0; i--) {
      const r = series[i].ratio;
      if (r !== null && r > s.steadyHigh) above++;
      else break;
    }
    if (above >= 10) signals.push({ id: 'sustained', message: `${above} days in a row above your usual load` });

    let lightDays = 0;
    for (let i = 0; i < 14; i++) {
      const date = addDays(todayKey, -i);
      const d = loads.get(date);
      const base = windowAvg(loads, date, 28, start);
      const effort = d?.effort ?? 0;
      if (effort < 0.3 * base || (effort < 0.6 * base && (d?.breaks ?? 0) >= 2)) lightDays++;
    }
    if (cur.base > 0 && lightDays === 0) signals.push({ id: 'noLightDay', message: 'No light day in the last two weeks' });

    let heavyDays = 0;
    let weekMin = 0;
    for (let i = 0; i < 7; i++) {
      const d = loads.get(addDays(todayKey, -i));
      if (!d) continue;
      if (d.highMin > 240) heavyDays++;
      weekMin += d.totalMin;
    }
    if (heavyDays >= 4) signals.push({ id: 'heavyHigh', message: `Over 4 hours of high-energy work on ${heavyDays} of the last 7 days` });
    if (weekMin > 50 * 60) signals.push({ id: 'longWeek', message: `About ${Math.round(weekMin / 60)} hours of tasks this week` });

    const weekAgo = addDays(todayKey, -6);
    const rough = input.checkins.filter((c) => !c.deletedAt && c.date >= weekAgo && c.mood <= 2).length;
    if (rough >= 3 && cur.ratio !== null && cur.ratio > s.steadyHigh)
      signals.push({ id: 'rough', message: `High load and ${rough} rough days this week` });
  }

  return {
    today: loads.get(todayKey) ?? emptyDay(todayKey),
    recent: cur.recent,
    base: cur.base,
    ratio: cur.ratio,
    zone: zoneFor(cur.ratio, s, calibrating),
    daysTracked,
    series,
    signals,
    loads,
  };
}
