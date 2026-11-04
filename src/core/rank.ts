// Picks what the Now deck shows.

import type { Energy, Project, Task } from './types';
import { ENERGY_LABEL, ENERGY_RANK } from './energy';
import { DAY_MS, daysBetween, formatMinutes, toDateKey } from './dates';

export interface Suggestion {
  task: Task;
  score: number;
  why: string;
  /** Shown when nothing fits the current energy. */
  light?: boolean;
}

export interface RankInput {
  tasks: Task[];
  projects: Project[];
  energy: Energy;
  timeAvailable?: number;
  now: number;
}

/** Can this task be suggested at all right now? */
export function isAvailable(t: Task, today: string): boolean {
  if (t.deletedAt) return false;
  if (t.status !== 'next' && t.status !== 'inbox') return false;
  if (t.deferUntil && t.deferUntil > today) return false;
  return true;
}

export function skippedToday(t: Task, now: number): number {
  const today = toDateKey(now);
  return t.skips.filter((s) => toDateKey(s) === today).length;
}

export function skipsThisWeek(t: Task, now: number): number {
  return t.skips.filter((s) => now - s < 7 * DAY_MS).length;
}

function energyFit(task: Energy, current: Energy): number {
  const t = ENERGY_RANK[task];
  const c = ENERGY_RANK[current];
  if (t > c) return 0;
  if (current === 'high') return [0, 0.3, 0.6, 1][t];
  if (current === 'med') return t === 2 ? 1 : 0.7;
  return 1;
}

function momentum(tasks: Task[], now: number): Set<string> {
  const s = new Set<string>();
  for (const t of tasks) if (t.projectId && t.status === 'done' && t.doneAt && now - t.doneAt < 3 * DAY_MS) s.add(t.projectId);
  return s;
}

function scoreTask(t: Task, input: RankInput, moving: Set<string>, today: string) {
  const fit = energyFit(t.energy, input.energy);
  const timeOk = input.timeAvailable ? t.estimateMin <= input.timeAvailable : true;
  const ageDays = (input.now - t.createdAt) / DAY_MS;
  const age = Math.min(ageDays / 21, 1) * 0.5;
  const proj = t.projectId && moving.has(t.projectId) ? 0.5 : 0;
  const due = t.repeat && t.scheduledFor && t.scheduledFor <= today ? 0.5 : 0;
  const inbox = t.status === 'inbox' ? -0.3 : 0;
  const skip = skippedToday(t, input.now) * 2;
  const score = fit * 3 + (input.timeAvailable && timeOk ? 2 : 0) + proj + age + due + inbox - skip;
  return { fit, timeOk, proj, due, ageDays, score };
}

function whyLine(t: Task, s: ReturnType<typeof scoreTask>, input: RankInput, projects: Map<string, Project>): string {
  const parts: string[] = [];
  parts.push(`Fits ${ENERGY_LABEL[input.energy].toLowerCase()} energy`);
  if (input.timeAvailable) parts.push(`${formatMinutes(t.estimateMin)} fits your time`);
  if (s.due) parts.push('repeats today');
  if (s.proj && t.projectId) parts.push(`keeps ${projects.get(t.projectId)?.name ?? 'a project'} moving`);
  else if (s.ageDays > 10) parts.push(`waiting ${Math.round(s.ageDays)} days`);
  if (t.status === 'inbox') parts.push('from Inbox');
  return parts.slice(0, 3).join(' · ');
}

/**
 * The deck: tasks that fit energy and time, best first. Tasks skipped today
 * sink to the bottom. If nothing fits, the lightest available task is offered
 * as a "light option".
 */
export function buildDeck(input: RankInput): Suggestion[] {
  const today = toDateKey(input.now);
  const moving = momentum(input.tasks, input.now);
  const projects = new Map(input.projects.map((p) => [p.id, p]));
  const avail = input.tasks.filter((t) => isAvailable(t, today));

  const fitting: Suggestion[] = [];
  for (const t of avail) {
    const s = scoreTask(t, input, moving, today);
    if (s.fit > 0 && s.timeOk) fitting.push({ task: t, score: s.score, why: whyLine(t, s, input, projects) });
  }
  fitting.sort((a, b) => b.score - a.score || a.task.createdAt - b.task.createdAt);
  if (fitting.length) return fitting;

  // Nothing fits: lightest task first (any energy), shortest as tie-break.
  const light = avail
    .slice()
    .sort((a, b) => ENERGY_RANK[a.energy] - ENERGY_RANK[b.energy] || a.estimateMin - b.estimateMin || skippedToday(a, input.now) - skippedToday(b, input.now));
  return light.slice(0, 1).map((t) => ({
    task: t,
    score: 0,
    light: true,
    why: `Nothing fits your energy perfectly. This one is the lightest · ${formatMinutes(t.estimateMin)}`,
  }));
}

export function isQuiet(t: Task, quietDays: number, now: number): boolean {
  if (t.deletedAt || t.repeat) return false;
  if (t.status !== 'next' && t.status !== 'waiting' && t.status !== 'inbox') return false;
  return daysBetween(toDateKey(t.lastTouchedAt), toDateKey(now)) >= quietDays;
}
