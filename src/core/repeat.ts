import type { Repeat } from './types';
import { addDays, dayOfWeek, daysInMonth, fromDateKey, WEEKDAYS } from './dates';

/** Does the repeat rule fall on this date? */
export function occursOn(r: Repeat, key: string): boolean {
  const dow = dayOfWeek(key);
  switch (r.kind) {
    case 'daily':
      return true;
    case 'weekdays':
      return dow >= 1 && dow <= 5;
    case 'weekly':
      return (r.days?.length ? r.days : [dow]).includes(dow);
    case 'monthly': {
      const d = fromDateKey(key);
      const want = Math.min(r.dayOfMonth ?? 1, daysInMonth(d.getFullYear(), d.getMonth()));
      return d.getDate() === want;
    }
  }
}

/** First date on or after `from` that the rule falls on. */
export function firstOnOrAfter(r: Repeat, from: string): string {
  let k = from;
  for (let i = 0; i < 400; i++) {
    if (occursOn(r, k)) return k;
    k = addDays(k, 1);
  }
  return from;
}

/**
 * Next scheduled date after finishing an instance. Counted from the schedule,
 * not from completion: the next date after both the instance's own date and
 * today. Missed dates in between are skipped, so copies never pile up.
 */
export function nextAfter(r: Repeat, instanceDate: string, today: string): string {
  const base = instanceDate > today ? instanceDate : today;
  return firstOnOrAfter(r, addDays(base, 1));
}

export function describeRepeat(r: Repeat): string {
  switch (r.kind) {
    case 'daily':
      return 'Daily';
    case 'weekdays':
      return 'Weekdays';
    case 'weekly': {
      const days = (r.days ?? []).slice().sort();
      if (!days.length) return 'Weekly';
      return days.map((d) => cap(WEEKDAYS[d])).join(', ');
    }
    case 'monthly':
      return `Monthly · ${ordinal(r.dayOfMonth ?? 1)}`;
  }
}

/** Default rule details when the person picks a kind in the repeat control. */
export function defaultRepeat(kind: Repeat['kind'], today: string): Repeat {
  if (kind === 'weekly') return { kind, days: [dayOfWeek(today)] };
  if (kind === 'monthly') return { kind, dayOfMonth: fromDateKey(today).getDate() };
  return { kind };
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
