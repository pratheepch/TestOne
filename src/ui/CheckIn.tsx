// End-of-day check-in: "How was your day?" Never shames.

import { useState } from 'preact/hooks';
import type { DayCheckIn } from '../core/types';
import { toDateKey } from '../core/dates';
import * as S from '../data/store';
import { pace } from './derived';
import { checkInOpen } from './nav';
import { Sheet } from './bits';

const FACES: { mood: DayCheckIn['mood']; face: string; label: string }[] = [
  { mood: 1, face: '😣', label: 'Rough' },
  { mood: 2, face: '😕', label: 'Meh' },
  { mood: 3, face: '😐', label: 'Okay' },
  { mood: 4, face: '🙂', label: 'Good' },
  { mood: 5, face: '😄', label: 'Great' },
];

export function reflection(done: number, mood?: DayCheckIn['mood']): string {
  if (mood && mood <= 2) return "Thanks for being honest. Tomorrow starts fresh, and it'll open with something light.";
  if (done === 0) return 'Not every day is a task day. Rest, life and invisible work count too. One day barely moves your Pace.';
  if (done === 1) return 'You moved one thing forward today. That counts.';
  return `You moved ${done} things forward today.`;
}

export function CheckInSheet() {
  const open = checkInOpen.value;
  const [mood, setMood] = useState<DayCheckIn['mood'] | undefined>();
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const done = pace.value.today.tasksDone;

  const close = () => {
    checkInOpen.value = false;
    setTimeout(() => { setMood(undefined); setNote(''); setSaved(false); }, 300);
  };

  return (
    <Sheet open={open} onClose={() => { S.setDeviceState({ checkInDismissedFor: toDateKey(Date.now()) }); close(); }} label="How was your day?">
      <div class="sheet-head"><h2>How was your day?</h2></div>
      <p class="kind">{reflection(done, saved ? mood : undefined)}</p>
      <div class="faces" role="radiogroup" aria-label="Mood">
        {FACES.map((f) => (
          <button type="button" key={f.mood} role="radio" aria-checked={mood === f.mood} aria-label={f.label}
            class={`face${mood === f.mood ? ' on' : ''}`} onClick={() => setMood(f.mood)}>{f.face}</button>
        ))}
      </div>
      <div class="field">
        <input class="input" placeholder="Anything to remember? (optional)" value={note} maxLength={140}
          onInput={(e) => setNote((e.target as HTMLInputElement).value)} />
      </div>
      {!saved ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" class="btn btn-ghost press" onClick={() => { S.setDeviceState({ checkInDismissedFor: toDateKey(Date.now()) }); close(); }}>Not today</button>
          <button type="button" class="btn btn-primary press" style={{ flex: 1 }} disabled={!mood} onClick={() => {
            if (!mood) return;
            S.saveCheckIn(mood, note.trim() || undefined);
            setSaved(true);
            setTimeout(close, 1600);
          }}>Save</button>
        </div>
      ) : (
        <p class="meta" style={{ textAlign: 'center' }}>Saved. Rest well.</p>
      )}
    </Sheet>
  );
}
