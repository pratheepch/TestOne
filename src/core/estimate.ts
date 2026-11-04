// Automatic time / energy / context estimates, entirely on the device.
// Layer 1: keyword rules. Layer 2: your own history — similar finished or
// corrected tasks win over the rules. (An embedding model can later replace
// `similarity` without changing callers; see docs/PLAN.md.)

import type { Energy, Task } from './types';

export interface Estimate {
  estimateMin: number;
  energy: Energy;
  context?: string;
  source: 'rules' | 'history' | 'default';
}

interface Rule {
  words: string[];
  min: number;
  energy: Energy;
  context?: string;
}

// First matching rule wins, so more specific rules come first.
const RULES: Rule[] = [
  { words: ['call', 'phone', 'ring', 'text', 'whatsapp', 'sms'], min: 5, energy: 'low', context: 'phone' },
  { words: ['email', 'reply', 'respond', 'message', 'dm', 'ping', 'slack'], min: 5, energy: 'low' },
  { words: ['pay', 'renew', 'book', 'order', 'schedule', 'confirm', 'rsvp', 'cancel', 'sign', 'submit', 'send', 'forward', 'check'], min: 5, energy: 'low' },
  { words: ['buy', 'pick', 'collect', 'drop', 'return', 'post', 'groceries', 'shop', 'pharmacy'], min: 20, energy: 'low', context: 'errand' },
  { words: ['water', 'feed', 'take', 'vitamins', 'bins', 'trash', 'laundry', 'dishes'], min: 5, energy: 'low', context: 'home' },
  { words: ['read', 'watch', 'listen', 'skim'], min: 20, energy: 'low' },
  { words: ['clean', 'tidy', 'organize', 'organise', 'sort', 'declutter', 'vacuum', 'wash', 'cook', 'iron'], min: 30, energy: 'med', context: 'home' },
  { words: ['review', 'update', 'edit', 'fix', 'prepare', 'prep', 'test', 'meet', 'meeting', 'sync', 'follow', 'fill', 'file', 'backup'], min: 30, energy: 'med' },
  { words: ['gym', 'run', 'workout', 'exercise', 'yoga', 'swim', 'walk', 'cycle'], min: 45, energy: 'med' },
  { words: ['research', 'learn', 'study', 'practice', 'practise', 'analyse', 'analyze', 'investigate', 'compare'], min: 60, energy: 'high' },
  { words: ['write', 'draft', 'design', 'plan', 'build', 'create', 'develop', 'code', 'implement', 'refactor', 'outline', 'present', 'presentation', 'proposal', 'pitch', 'strategy', 'brainstorm', 'taxes', 'budget'], min: 60, energy: 'high' },
];

const CONTEXT_WORDS: Record<string, string> = {
  call: 'phone', phone: 'phone', ring: 'phone',
  buy: 'errand', shop: 'errand', store: 'errand', pharmacy: 'errand', groceries: 'errand', post: 'errand',
  home: 'home', garden: 'home', kitchen: 'home',
  computer: 'computer', laptop: 'computer', email: 'computer',
};

const STOP = new Set(['a', 'an', 'the', 'to', 'for', 'and', 'or', 'of', 'on', 'in', 'at', 'with', 'my', 'me', 'up', 'about', 'from', 'by', 'it', 'is', 'be', 'this', 'that', 'some', 'new']);

export const NICE_MINUTES = [2, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240];

function median(sorted: number[]): number {
  const m = sorted.length >> 1;
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

export function roundEstimate(min: number): number {
  let best = NICE_MINUTES[0];
  for (const n of NICE_MINUTES) if (Math.abs(n - min) < Math.abs(best - min)) best = n;
  return best;
}

function stem(w: string): string {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map(stem);
}

/** Jaccard similarity of word sets, 0..1. */
export function similarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export function ruleEstimate(title: string): Estimate {
  const words = tokenize(title);
  const raw = title.toLowerCase().split(/[^\p{L}]+/u);
  for (const rule of RULES) {
    if (rule.words.some((w) => raw.includes(w) || words.includes(stem(w)))) {
      return { estimateMin: rule.min, energy: rule.energy, context: rule.context ?? contextFrom(raw), source: 'rules' };
    }
  }
  return { estimateMin: 15, energy: 'med', context: contextFrom(raw), source: 'default' };
}

function contextFrom(words: string[]): string | undefined {
  for (const w of words) if (CONTEXT_WORDS[w]) return CONTEXT_WORDS[w];
  return undefined;
}

/** Minutes this finished/corrected task teaches us, or undefined. */
function learnedMinutes(t: Task): number | undefined {
  if (t.actualMin && t.actualMin > 0) return t.actualMin;
  if (t.estimateSource === 'user') return t.estimateMin;
  return undefined;
}

export function estimate(title: string, history: Task[]): Estimate {
  const base = ruleEstimate(title);
  const words = tokenize(title);
  const scored: { sim: number; t: Task }[] = [];
  for (const t of history) {
    if (t.deletedAt) continue;
    const teaches = learnedMinutes(t) !== undefined || t.energySource === 'user';
    if (!teaches) continue;
    const sim = similarity(words, tokenize(t.title));
    if (sim >= 0.5) scored.push({ sim, t });
  }
  if (!scored.length) return base;
  scored.sort((a, b) => b.sim - a.sim);
  const top = scored.slice(0, 7);

  const mins = top.map((s) => learnedMinutes(s.t)).filter((m): m is number => m !== undefined).sort((a, b) => a - b);
  const votes: Record<Energy, number> = { low: 0, med: 0, high: 0 };
  for (const s of top) if (s.t.energySource === 'user') votes[s.t.energy] += s.sim;
  const energyVote = (Object.entries(votes) as [Energy, number][]).sort((a, b) => b[1] - a[1])[0];

  return {
    estimateMin: mins.length ? roundEstimate(median(mins)) : base.estimateMin,
    energy: energyVote[1] > 0 ? energyVote[0] : base.energy,
    context: top.find((s) => s.t.context)?.t.context ?? base.context,
    source: 'history',
  };
}
