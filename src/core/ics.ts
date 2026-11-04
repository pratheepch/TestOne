// Calendar files (.ics). A PWA can't write to the iOS calendar directly, so we
// hand Calendar a file and let it do the reminding.

import { fromDateKey } from './dates';

const ICS_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function local(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

function wrap(events: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TodoFlow//EN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR', ''].join('\r\n');
}

/** Recurring weekly review, 15 minutes, with a link back into the app. */
export function weeklyReviewIcs(reviewDay: number, hour: number, appUrl: string, now = new Date()): string {
  const start = new Date(now);
  start.setHours(hour, 0, 0, 0);
  const diff = (reviewDay - start.getDay() + 7) % 7;
  start.setDate(start.getDate() + diff);
  const end = new Date(start.getTime() + 15 * 60_000);
  const url = `${appUrl.replace(/[?#].*$/, '')}?review`;
  return wrap([
    'BEGIN:VEVENT',
    `UID:todoflow-weekly-review@todoflow`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${local(start)}`,
    `DTEND:${local(end)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${ICS_DAYS[reviewDay]}`,
    'SUMMARY:TodoFlow weekly review',
    `DESCRIPTION:${esc(`Two minutes to tidy your lists. Open: ${url}`)}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'TRIGGER:PT0M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Weekly review',
    'END:VALARM',
    'END:VEVENT',
  ]);
}

/** One-off event for a task. */
export function taskIcs(id: string, title: string, dateKey: string, hour: number, minutes: number, now = new Date()): string {
  const start = fromDateKey(dateKey);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start.getTime() + Math.max(15, minutes) * 60_000);
  return wrap([
    'BEGIN:VEVENT',
    `UID:todoflow-${id}@todoflow`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${local(start)}`,
    `DTEND:${local(end)}`,
    `SUMMARY:${esc(title)}`,
    'END:VEVENT',
  ]);
}
