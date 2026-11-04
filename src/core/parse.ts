// Capture syntax. Everything is optional; plain text always works.
//   Call dentist !low ~5m @phone #health w:Sam tomorrow every mon
// Symbol tokens (!, ~, @, #, w:) work anywhere. Word tokens (dates, repeats)
// only count at the end of the text, so "Fix Monday report" stays a title.

import type { Energy, Repeat } from './types';
import { addDays, dayOfWeek, toDateKey } from './dates';

export type TokenKind = 'energy' | 'time' | 'context' | 'project' | 'waiting' | 'defer' | 'repeat';

export interface ParsedToken {
  kind: TokenKind;
  raw: string;
  label: string;
}

export interface ParsedCapture {
  title: string;
  energy?: Energy;
  estimateMin?: number;
  context?: string;
  project?: string;
  waitingOn?: string;
  deferUntil?: string;
  repeat?: Repeat;
  tokens: ParsedToken[];
}

const ENERGY: Record<string, Energy> = {
  l: 'low', low: 'low', m: 'med', med: 'med', medium: 'med', h: 'high', high: 'high', hi: 'high',
};
const ENERGY_LABEL: Record<Energy, string> = { low: 'Low energy', med: 'Medium energy', high: 'High energy' };

const DAY_WORDS: [RegExp, number][] = [
  [/^sun(day)?$/, 0],
  [/^mon(day)?$/, 1],
  [/^tue(s|sday)?$/, 2],
  [/^wed(nesday)?$/, 3],
  [/^thu(r|rs|rsday)?$/, 4],
  [/^fri(day)?$/, 5],
  [/^sat(urday)?$/, 6],
];
const DAY_RE = 'sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?';
const DAY_LIST_RE = `(?:${DAY_RE})(?:\\s*(?:,|and|&)\\s*(?:${DAY_RE}))*`;

function dayIndex(word: string): number | undefined {
  const w = word.toLowerCase();
  for (const [re, i] of DAY_WORDS) if (re.test(w)) return i;
  return undefined;
}

const SHORT_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function parseCapture(input: string, today: string = toDateKey(new Date())): ParsedCapture {
  const out: ParsedCapture = { title: '', tokens: [] };
  let text = ` ${input.trim()} `;

  const take = (re: RegExp, fn: (m: RegExpExecArray) => ParsedToken | null) => {
    let m: RegExpExecArray | null;
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    const hits: RegExpExecArray[] = [];
    while ((m = g.exec(text))) hits.push(m);
    for (const h of hits.reverse()) {
      const tok = fn(h);
      if (!tok) continue;
      out.tokens.unshift(tok);
      text = text.slice(0, h.index) + ' ' + text.slice(h.index + h[0].length);
    }
  };

  take(/\s!(low|l|med|medium|m|high|hi|h)(?=\s)/i, (m) => {
    const e = ENERGY[m[1].toLowerCase()];
    out.energy = e;
    return { kind: 'energy', raw: m[0].trim(), label: ENERGY_LABEL[e] };
  });
  take(/\s~(\d+(?:\.\d+)?)\s*(m|min|mins|h|hr|hrs)?(?=\s)/i, (m) => {
    const n = parseFloat(m[1]);
    const unit = (m[2] ?? 'm').toLowerCase();
    const min = Math.max(1, Math.round(unit.startsWith('h') ? n * 60 : n));
    out.estimateMin = min;
    return { kind: 'time', raw: m[0].trim(), label: min >= 60 ? `~${+(min / 60).toFixed(1)}h` : `~${min}m` };
  });
  take(/\s@([\p{L}\p{N}_-]+)(?=\s)/iu, (m) => {
    out.context = m[1].toLowerCase();
    return { kind: 'context', raw: m[0].trim(), label: `@${out.context}` };
  });
  take(/\s#([\p{L}\p{N}_-]+)(?=\s)/iu, (m) => {
    out.project = m[1];
    return { kind: 'project', raw: m[0].trim(), label: `#${m[1]}` };
  });
  take(/\sw:(\S+)(?=\s)/i, (m) => {
    out.waitingOn = m[1];
    return { kind: 'waiting', raw: m[0].trim(), label: `Waiting on ${m[1]}` };
  });

  // Word tokens, peeled off the end one at a time.
  const repeatRe = new RegExp(
    `\\s(every\\s+(?:day|weekday|weekdays|week|month|${DAY_LIST_RE})|daily|weekdays|weekly|monthly)\\s*$`, 'i');
  const deferRe = new RegExp(`\\s(today|tomorrow|tmrw?|next\\s+week|in\\s+(\\d+)\\s+days?|(?:on\\s+)?(${DAY_RE}))\\s*$`, 'i');

  for (let guard = 0; guard < 3; guard++) {
    const before = text;
    if (!out.repeat) {
      const m = repeatRe.exec(text);
      if (m && text.slice(0, m.index).trim()) {
        const r = parseRepeat(m[1], today);
        if (r) {
          out.repeat = r.repeat;
          out.tokens.push({ kind: 'repeat', raw: m[1], label: `↻ ${r.label}` });
          text = text.slice(0, m.index) + ' ';
        }
      }
    }
    if (!out.deferUntil) {
      const m = deferRe.exec(text);
      if (m && text.slice(0, m.index).trim()) {
        const d = parseDefer(m[1], today);
        if (d) {
          out.deferUntil = d;
          out.tokens.push({ kind: 'defer', raw: m[1], label: deferLabel(m[1]) });
          text = text.slice(0, m.index) + ' ';
        }
      }
    }
    if (text === before) break;
  }

  // Chips in the order they were typed.
  const lower = input.toLowerCase();
  out.tokens.sort((a, b) => lower.indexOf(a.raw.toLowerCase()) - lower.indexOf(b.raw.toLowerCase()));
  out.title = text.replace(/\s+/g, ' ').trim() || input.trim();
  return out;
}

function parseRepeat(raw: string, today: string): { repeat: Repeat; label: string } | null {
  const s = raw.toLowerCase().replace(/\s+/g, ' ');
  if (s === 'daily' || s === 'every day') return { repeat: { kind: 'daily' }, label: 'Daily' };
  if (s === 'weekdays' || s === 'every weekday' || s === 'every weekdays')
    return { repeat: { kind: 'weekdays' }, label: 'Weekdays' };
  if (s === 'weekly' || s === 'every week') {
    const d = dayOfWeek(today);
    return { repeat: { kind: 'weekly', days: [d] }, label: `Every ${SHORT_DAY[d]}` };
  }
  if (s === 'monthly' || s === 'every month') {
    const dom = Number(today.slice(8, 10));
    return { repeat: { kind: 'monthly', dayOfMonth: dom }, label: 'Monthly' };
  }
  const days = s.replace(/^every /, '').split(/\s*(?:,|and|&)\s*/).map(dayIndex).filter((d): d is number => d !== undefined);
  if (!days.length) return null;
  const uniq = [...new Set(days)].sort();
  return { repeat: { kind: 'weekly', days: uniq }, label: `Every ${uniq.map((d) => SHORT_DAY[d]).join(', ')}` };
}

function parseDefer(raw: string, today: string): string | null {
  const s = raw.toLowerCase().replace(/\s+/g, ' ').replace(/^on /, '');
  if (s === 'today') return today;
  if (s === 'tomorrow' || s === 'tmr' || s === 'tmrw') return addDays(today, 1);
  if (s === 'next week') {
    // Next Monday.
    const dow = dayOfWeek(today);
    return addDays(today, ((8 - dow) % 7) || 7);
  }
  const inDays = /^in (\d+) days?$/.exec(s);
  if (inDays) return addDays(today, Number(inDays[1]));
  const d = dayIndex(s);
  if (d === undefined) return null;
  const diff = (d - dayOfWeek(today) + 7) % 7 || 7;
  return addDays(today, diff);
}

function deferLabel(raw: string): string {
  const s = raw.replace(/^on\s+/i, '');
  return s[0].toUpperCase() + s.slice(1).toLowerCase();
}
