import { describe, expect, it } from 'vitest';
import { parseCapture } from './parse';
import { estimate, ruleEstimate } from './estimate';
import { firstOnOrAfter, nextAfter, occursOn } from './repeat';
import { buildDeck, isQuiet } from './rank';
import { computePace, zoneFor } from './pace';
import { mergeRecords } from './merge';
import { breakIdeas } from './breaks';
import { weeklyReviewIcs } from './ics';
import { addDays, DAY_MS, fromDateKey } from './dates';
import type { Task } from './types';

// 2026-11-04 is a Wednesday.
const TODAY = '2026-11-04';
const NOW = fromDateKey(TODAY).getTime() + 10 * 3600_000; // 10:00

let n = 0;
function task(p: Partial<Task> = {}): Task {
  n++;
  return {
    id: `t${n}`, createdAt: NOW, updatedAt: NOW, rev: 1, deviceId: 'd',
    title: `Task ${n}`, status: 'next', energy: 'low', energySource: 'auto', estimateMin: 15, estimateSource: 'auto',
    lastTouchedAt: NOW, skips: [], ...p,
  };
}

describe('parseCapture', () => {
  it('keeps plain text as the title', () => {
    expect(parseCapture('Buy milk', TODAY)).toMatchObject({ title: 'Buy milk', tokens: [] });
  });

  it('reads every symbol token', () => {
    const p = parseCapture('Call dentist !low ~5m @phone #health', TODAY);
    expect(p).toMatchObject({ title: 'Call dentist', energy: 'low', estimateMin: 5, context: 'phone', project: 'health' });
    expect(p.tokens.map((t) => t.kind)).toEqual(['energy', 'time', 'context', 'project']);
  });

  it('reads hours and waiting', () => {
    expect(parseCapture('Draft brief ~1.5h', TODAY).estimateMin).toBe(90);
    expect(parseCapture('Contract back w:Sam', TODAY)).toMatchObject({ title: 'Contract back', waitingOn: 'Sam' });
  });

  it('only reads date words at the end', () => {
    expect(parseCapture('Fix Monday report', TODAY)).toEqual({ title: 'Fix Monday report', tokens: [] });
    expect(parseCapture('Send report friday', TODAY)).toMatchObject({ title: 'Send report', deferUntil: '2026-11-06' });
    expect(parseCapture('Send report tomorrow', TODAY).deferUntil).toBe('2026-11-05');
    expect(parseCapture('Plan trip next week', TODAY).deferUntil).toBe('2026-11-09');
    expect(parseCapture('Pay bill in 3 days', TODAY).deferUntil).toBe('2026-11-07');
    // Same weekday means next week, not today.
    expect(parseCapture('Team lunch wed', TODAY).deferUntil).toBe('2026-11-11');
  });

  it('reads repeats', () => {
    expect(parseCapture('Water plants every sun', TODAY).repeat).toEqual({ kind: 'weekly', days: [0] });
    expect(parseCapture('Gym every mon, wed and fri', TODAY).repeat).toEqual({ kind: 'weekly', days: [1, 3, 5] });
    expect(parseCapture('Vitamins daily', TODAY).repeat).toEqual({ kind: 'daily' });
    expect(parseCapture('Timesheet weekdays', TODAY).repeat).toEqual({ kind: 'weekdays' });
    expect(parseCapture('Rent monthly', TODAY).repeat).toEqual({ kind: 'monthly', dayOfMonth: 4 });
    expect(parseCapture('Daily standup notes', TODAY).repeat).toBeUndefined();
  });

  it('never returns an empty title', () => {
    expect(parseCapture('#home', TODAY).title).toBe('#home');
  });
});

describe('estimate', () => {
  it('uses rules', () => {
    expect(ruleEstimate('Call mum')).toMatchObject({ estimateMin: 5, energy: 'low', context: 'phone' });
    expect(ruleEstimate('Write the project proposal')).toMatchObject({ estimateMin: 60, energy: 'high' });
    expect(ruleEstimate('Clean the kitchen')).toMatchObject({ estimateMin: 30, energy: 'med' });
    expect(ruleEstimate('Zorblax')).toMatchObject({ estimateMin: 15, energy: 'med', source: 'default' });
  });

  it('learns from similar finished tasks', () => {
    const hist = [
      task({ title: 'Clean the kitchen', status: 'done', actualMin: 12, energy: 'low', energySource: 'user' }),
      task({ title: 'Clean kitchen floor', status: 'done', actualMin: 18, energy: 'low', energySource: 'user' }),
    ];
    expect(estimate('Clean the kitchen', hist)).toMatchObject({ estimateMin: 15, energy: 'low', source: 'history' });
  });
});

describe('repeat', () => {
  it('finds dates', () => {
    expect(occursOn({ kind: 'weekdays' }, '2026-11-07')).toBe(false); // Saturday
    expect(firstOnOrAfter({ kind: 'weekly', days: [0] }, TODAY)).toBe('2026-11-08');
    expect(firstOnOrAfter({ kind: 'monthly', dayOfMonth: 31 }, '2026-11-01')).toBe('2026-11-30');
  });

  it('follows the schedule, not completion, and never piles up', () => {
    const r = { kind: 'weekly' as const, days: [0] };
    // Sunday 1 Nov instance finished late on Wednesday 4 Nov → next Sunday.
    expect(nextAfter(r, '2026-11-01', TODAY)).toBe('2026-11-08');
    // Missed for weeks → still only the next upcoming date.
    expect(nextAfter(r, '2026-10-04', TODAY)).toBe('2026-11-08');
    expect(nextAfter({ kind: 'daily' }, TODAY, TODAY)).toBe('2026-11-05');
  });
});

describe('buildDeck', () => {
  const base = { projects: [], now: NOW };

  it('filters by energy and puts the best fit first', () => {
    const tasks = [task({ title: 'hard', energy: 'high' }), task({ title: 'med', energy: 'med' }), task({ title: 'easy', energy: 'low' })];
    expect(buildDeck({ ...base, tasks, energy: 'med' }).map((s) => s.task.title)).toEqual(['med', 'easy']);
    expect(buildDeck({ ...base, tasks, energy: 'high' })[0].task.title).toBe('hard');
  });

  it('respects time, deferral and status', () => {
    const tasks = [
      task({ title: 'long', estimateMin: 60 }),
      task({ title: 'later', deferUntil: addDays(TODAY, 1) }),
      task({ title: 'someday', status: 'someday' }),
      task({ title: 'short', estimateMin: 5 }),
    ];
    expect(buildDeck({ ...base, tasks, energy: 'low', timeAvailable: 10 }).map((s) => s.task.title)).toEqual(['short']);
  });

  it('sinks tasks skipped today', () => {
    const tasks = [task({ title: 'skipped', skips: [NOW - 1000], createdAt: NOW - 30 * DAY_MS }), task({ title: 'fresh' })];
    expect(buildDeck({ ...base, tasks, energy: 'low' }).map((s) => s.task.title)).toEqual(['fresh', 'skipped']);
  });

  it('offers the lightest task when nothing fits', () => {
    const tasks = [task({ title: 'big', energy: 'high', estimateMin: 60 }), task({ title: 'medium', energy: 'med', estimateMin: 30 })];
    const deck = buildDeck({ ...base, tasks, energy: 'low' });
    expect(deck).toHaveLength(1);
    expect(deck[0]).toMatchObject({ light: true, task: { title: 'medium' } });
  });

  it('marks quiet tasks', () => {
    expect(isQuiet(task({ lastTouchedAt: NOW - 22 * DAY_MS }), 21, NOW)).toBe(true);
    expect(isQuiet(task({ lastTouchedAt: NOW - 22 * DAY_MS, repeat: { kind: 'daily' } }), 21, NOW)).toBe(false);
    expect(isQuiet(task({ lastTouchedAt: NOW - 3 * DAY_MS }), 21, NOW)).toBe(false);
  });
});

describe('pace', () => {
  const settings = { steadyLow: 0.8, steadyHigh: 1.3, overreach: 1.5, calibrationDays: 14, createdAt: NOW - 60 * DAY_MS };

  function doneOn(daysAgo: number, min: number, energy: Task['energy'] = 'med'): Task {
    return task({ status: 'done', doneAt: NOW - daysAgo * DAY_MS, estimateMin: min, energy });
  }

  it('maps ratios to zones', () => {
    expect(zoneFor(0.5, settings, false)).toBe('easing');
    expect(zoneFor(1, settings, false)).toBe('steady');
    expect(zoneFor(1.4, settings, false)).toBe('stretching');
    expect(zoneFor(2, settings, false)).toBe('overreaching');
    expect(zoneFor(1, settings, true)).toBe('calibrating');
  });

  it('stays steady with steady work, and one day off barely matters', () => {
    const tasks = Array.from({ length: 40 }, (_, i) => doneOn(i + 1, 60));
    const p = computePace({ tasks, breaks: [], checkins: [], settings, now: NOW });
    expect(p.zone).toBe('steady');
    expect(p.base).toBeGreaterThan(100);
  });

  it('flags overreaching and sustained load', () => {
    const tasks = [
      ...Array.from({ length: 30 }, (_, i) => doneOn(i + 15, 30)),
      ...Array.from({ length: 15 }, (_, i) => doneOn(i, 240, 'high')),
    ];
    const p = computePace({ tasks, breaks: [], checkins: [], settings, now: NOW });
    expect(['stretching', 'overreaching']).toContain(p.zone);
    expect(p.signals.map((s) => s.id)).toContain('noLightDay');
  });

  it('calibrates for the first two weeks', () => {
    const p = computePace({ tasks: [doneOn(0, 30)], breaks: [], checkins: [], settings: { ...settings, createdAt: NOW - 3 * DAY_MS }, now: NOW });
    expect(p.zone).toBe('calibrating');
    expect(p.today.tasksDone).toBe(1);
    expect(p.today.effort).toBe(60);
  });
});

describe('merge', () => {
  it('keeps the newer record and reports changes', () => {
    const a = task({ id: 'x', updatedAt: 1, title: 'old' });
    const b = task({ id: 'x', updatedAt: 2, title: 'new' });
    const c = task({ id: 'y' });
    const r = mergeRecords([a], [b, c]);
    expect(r.merged.find((t) => t.id === 'x')?.title).toBe('new');
    expect(r.changed).toHaveLength(2);
    expect(mergeRecords([b], [a]).changed).toHaveLength(0);
  });
});

describe('breaks and calendar', () => {
  it('fits breaks to the hour and avoids repeats', () => {
    expect(breakIdeas(23, []).some((b) => b.kind === 'daylight')).toBe(false);
    expect(breakIdeas(12, ['walk'])[0].kind).not.toBe('walk');
  });

  it('builds a weekly review event', () => {
    const ics = weeklyReviewIcs(0, 18, 'https://example.com/app/?x', new Date(NOW));
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=SU');
    expect(ics).toContain('https://example.com/app/?review');
    expect(ics).toContain('DTSTART:20261108T180000');
  });
});
