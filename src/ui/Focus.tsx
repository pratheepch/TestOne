// Full-screen focus timer for a task, and the timer for a break.
// Time is computed from the start timestamp, so it keeps counting while the
// app is in the background.

import { useEffect, useState } from 'preact/hooks';
import { BREAKS } from '../core/breaks';
import { formatMinutes } from '../core/dates';
import { effortOf } from '../core/pace';
import * as S from '../data/store';
import { focus, haptic, showToast } from './nav';

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function FocusView() {
  const f = focus.value;
  const [tick, setTick] = useState(Date.now());
  const [leaving, setLeaving] = useState(false);
  const [breakStart] = useState(() => Date.now());
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const exit = (after?: () => void) => {
    setLeaving(true);
    setTimeout(() => { focus.value = null; after?.(); }, 220);
  };

  if (!f) return null;

  if (f.kind === 'task') {
    const t = S.getTask(f.id);
    if (!t) return null;
    const start = t.startedAt ?? breakStart;
    const elapsed = tick - start;
    const pct = Math.min(1, elapsed / (t.estimateMin * 60_000));
    return (
      <div class={`focus${leaving ? ' out' : ''}${finished ? ' finished' : ''}`} role="dialog" aria-label="Focus timer">
        <div class="focus-line" style={{ height: `${pct * 100}%` }} />
        <span class="meta">Focus · estimate {formatMinutes(t.estimateMin)}</span>
        <h1 class="focus-title">{t.title}</h1>
        <div class="focus-time" aria-live="off">{mmss(elapsed)}</div>
        <p class="meta">{elapsed > t.estimateMin * 60_000 ? 'Over the estimate. No problem: this makes the next guess better.' : 'Leave the app if you need to. The timer keeps going.'}</p>
        <div class="focus-actions">
          <button type="button" class="btn btn-quiet press" onClick={() => { S.stopTimer(t.id); exit(); }}>Stop</button>
          <button type="button" class="btn btn-primary press" onClick={() => {
            setFinished(true);
            haptic(15);
            const undo = S.completeTask(t.id);
            const done = S.getTask(t.id);
            exit(() => showToast(done ? `Done · ${formatMinutes(done.actualMin ?? t.estimateMin)} · +${effortOf(done)} pts` : 'Done', undo));
          }}>Done</button>
        </div>
      </div>
    );
  }

  const idea = BREAKS.find((b) => b.kind === f.breakKind) ?? BREAKS[0];
  const total = idea.minutes * 60_000;
  const elapsed = tick - breakStart;
  const left = total - elapsed;
  const pct = Math.min(1, elapsed / total);
  const finish = () => {
    setFinished(true);
    haptic(15);
    S.logBreak(idea.kind, Math.max(1, Math.round(elapsed / 60_000)), breakStart);
    exit(() => showToast('Break taken. Nice.'));
  };
  if (left <= 0 && !finished) setTimeout(finish, 0);
  return (
    <div class={`focus${leaving ? ' out' : ''}${finished ? ' finished' : ''}`} role="dialog" aria-label="Break timer">
      <div class="focus-line" style={{ height: `${pct * 100}%` }} />
      <span class="meta">Break · {idea.minutes} min</span>
      <h1 class="focus-title">{idea.title}</h1>
      <p class="kind" style={{ color: 'var(--text-2)' }}>{idea.detail}</p>
      {idea.kind === 'breathe' && <Breather elapsed={elapsed} />}
      <div class="focus-time">{mmss(left)}</div>
      <div class="focus-actions">
        <button type="button" class="btn btn-quiet press" onClick={() => exit()}>Not now</button>
        <button type="button" class="btn btn-primary press" onClick={finish}>Finish</button>
      </div>
    </div>
  );
}

/** Box breathing guide: 4 s in, hold, out, hold. */
function Breather({ elapsed }: { elapsed: number }) {
  const phase = Math.floor(elapsed / 4000) % 4;
  const words = ['Breathe in', 'Hold', 'Breathe out', 'Hold'];
  const scale = phase === 0 ? 1 : phase === 1 ? 1 : phase === 2 ? 0.6 : 0.6;
  return (
    <div style={{ display: 'grid', placeItems: 'center', margin: '24px 0' }}>
      <div style={{ width: 140, height: 140, borderRadius: 28, border: '2px solid var(--accent)', transform: `scale(${scale})`, transition: 'transform 4s ease-in-out', display: 'grid', placeItems: 'center' }}>
        <span style={{ transform: `scale(${1 / scale})`, transition: 'transform 4s ease-in-out', color: 'var(--accent)', fontWeight: 600 }}>{words[phase]}</span>
      </div>
    </div>
  );
}
