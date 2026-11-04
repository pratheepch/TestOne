// Edit a task. Every change saves immediately.

import { useEffect, useState } from 'preact/hooks';
import type { Energy, Repeat, Status, Task } from '../core/types';
import { NICE_MINUTES } from '../core/estimate';
import { addDays, formatMinutes, toDateKey, WEEKDAYS } from '../core/dates';
import { defaultRepeat } from '../core/repeat';
import { autoEffort } from '../core/pace';
import { taskIcs } from '../core/ics';
import * as S from '../data/store';
import { editTaskId, showToast } from './nav';
import { EnergyBars, Segmented, Sheet, Stepper } from './bits';
import { shareFile } from './share';
import { IconCalendar, IconTrash } from './icons';

const STATUS: { value: Status; label: string }[] = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'next', label: 'Next' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'someday', label: 'Someday' },
  { value: 'done', label: 'Done' },
];

export function TaskSheet() {
  const id = editTaskId.value;
  const live = id ? S.tasks.value.find((t) => t.id === id) : undefined;
  // Keep the last task while the sheet animates closed.
  const [t, setT] = useState<Task | undefined>(live);
  useEffect(() => { if (live) setT(live); }, [live]);
  const close = () => (editTaskId.value = null);
  return (
    <Sheet open={!!id && !!live} onClose={close} label="Edit task">
      {t && <Editor t={live ?? t} onClose={close} />}
    </Sheet>
  );
}

function Editor({ t, onClose }: { t: Task; onClose: () => void }) {
  const [title, setTitle] = useState(t.title);
  const [newProject, setNewProject] = useState('');
  useEffect(() => setTitle(t.title), [t.id]);
  const up = (patch: Partial<Task>) => S.updateTask(t.id, patch);
  const today = toDateKey(Date.now());
  const projects = S.liveProjects.value.filter((p) => p.status !== 'done');

  return (
    <div>
      <div class="sheet-head">
        <h2>Task</h2>
        <button type="button" class="btn btn-primary btn-sm press" onClick={onClose}>Close</button>
      </div>

      <div class="field">
        <textarea class="input" aria-label="Title" rows={2} style={{ minHeight: 64, fontSize: 'var(--fs-title)' }} value={title}
          onInput={(e) => setTitle((e.target as HTMLTextAreaElement).value)}
          onBlur={() => title.trim() && title !== t.title && up({ title: title.trim() })} />
      </div>

      <div class="field">
        <span class="flabel">Status</span>
        <Segmented label="Status" scroll options={STATUS} value={t.status} onChange={(v) => {
          if (v === 'done' && t.status !== 'done') showToast('Done', S.completeTask(t.id));
          else up({ status: v, ...(v !== 'done' ? { doneAt: undefined } : {}) });
        }} />
      </div>

      <div class="field">
        <span class="flabel">Energy {t.energySource === 'auto' && <span class="muted" style={{ textTransform: 'none' }}>· guessed</span>}</span>
        <Segmented<Energy> label="Energy" value={t.energy} onChange={(v) => up({ energy: v, energySource: 'user' })} options={[
          { value: 'low', label: <><EnergyBars level="low" /> Low</> },
          { value: 'med', label: <><EnergyBars level="med" /> Medium</> },
          { value: 'high', label: <><EnergyBars level="high" /> High</> },
        ]} />
      </div>

      <div class="field">
        <span class="flabel">Time {t.estimateSource === 'auto' && <span class="muted" style={{ textTransform: 'none' }}>· guessed</span>}</span>
        <div class="chips">
          {NICE_MINUTES.filter((m) => m <= 180).map((m) => (
            <button type="button" key={m} class="chip press" aria-pressed={t.estimateMin === m} onClick={() => up({ estimateMin: m, estimateSource: 'user' })}>
              {formatMinutes(m)}
            </button>
          ))}
        </div>
      </div>

      {t.status === 'done' && (
        <div class="field">
          <span class="flabel">Effort points {t.effortSource !== 'user' && <span class="muted" style={{ textTransform: 'none' }}>· guessed</span>}</span>
          <Stepper value={t.effortPts ?? autoEffort(t)} min={0} max={2000} step={10} onChange={(v) => up({ effortPts: v, effortSource: 'user' })} />
        </div>
      )}

      <div class="field">
        <span class="flabel">Project</span>
        <div class="chips">
          <button type="button" class="chip press" aria-pressed={!t.projectId} onClick={() => up({ projectId: undefined })}>None</button>
          {projects.map((p) => (
            <button type="button" key={p.id} class="chip press" aria-pressed={t.projectId === p.id} onClick={() => up({ projectId: p.id })}>{p.name}</button>
          ))}
        </div>
        <form class="inline" style={{ marginTop: 8 }} onSubmit={(e) => {
          e.preventDefault();
          if (!newProject.trim()) return;
          up({ projectId: S.ensureProject(newProject).id });
          setNewProject('');
        }}>
          <input class="input" placeholder="New project" value={newProject} onInput={(e) => setNewProject((e.target as HTMLInputElement).value)} />
          <button type="submit" class="btn btn-quiet press" disabled={!newProject.trim()}>Add</button>
        </form>
      </div>

      <div class="field">
        <label for="ctx">Context</label>
        <input id="ctx" class="input" placeholder="home, phone, errand…" value={t.context ?? ''}
          onChange={(e) => up({ context: (e.target as HTMLInputElement).value.replace(/^@/, '').trim().toLowerCase() || undefined })} />
      </div>

      {t.status === 'waiting' && (
        <div class="field">
          <label for="wait">Waiting on</label>
          <input id="wait" class="input" value={t.waitingOn ?? ''} onChange={(e) => up({ waitingOn: (e.target as HTMLInputElement).value.trim() || undefined })} />
        </div>
      )}

      <div class="field">
        <span class="flabel">Show from</span>
        <div class="chips">
          <button type="button" class="chip press" aria-pressed={!t.deferUntil || t.deferUntil <= today} onClick={() => up({ deferUntil: undefined })}>Now</button>
          <button type="button" class="chip press" aria-pressed={t.deferUntil === addDays(today, 1)} onClick={() => up({ deferUntil: addDays(today, 1) })}>Tomorrow</button>
          <button type="button" class="chip press" aria-pressed={t.deferUntil === addDays(today, 7)} onClick={() => up({ deferUntil: addDays(today, 7) })}>In a week</button>
          <input type="date" class="chip" aria-label="Pick a date" value={t.deferUntil ?? ''} min={today}
            onChange={(e) => up({ deferUntil: (e.target as HTMLInputElement).value || undefined })} />
        </div>
      </div>

      <RepeatControl value={t.repeat} onChange={(r) => up({ repeat: r })} />

      <div class="field">
        <label for="notes">Notes</label>
        <textarea id="notes" class="input" value={t.notes ?? ''} onChange={(e) => up({ notes: (e.target as HTMLTextAreaElement).value || undefined })} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" class="btn btn-quiet press" style={{ flex: 1 }} onClick={() => {
          const date = t.deferUntil && t.deferUntil > today ? t.deferUntil : today;
          void shareFile(`${t.title.slice(0, 40)}.ics`, 'text/calendar', taskIcs(t.id, t.title, date, 9, t.estimateMin));
        }}><IconCalendar /> Add to Calendar</button>
        <button type="button" class="btn btn-danger press" onClick={() => { const u = S.deleteTask(t.id); onClose(); showToast('Deleted', u); }} aria-label="Delete task"><IconTrash /></button>
      </div>
    </div>
  );
}

export function RepeatControl({ value, onChange }: { value?: Repeat; onChange: (r: Repeat | undefined) => void }) {
  const today = toDateKey(Date.now());
  const kind = value?.kind ?? 'off';
  return (
    <div class="field">
      <span class="flabel">Repeat</span>
      <Segmented label="Repeat" scroll value={kind} onChange={(k) => onChange(k === 'off' ? undefined : defaultRepeat(k as Repeat['kind'], today))} options={[
        { value: 'off', label: 'Off' },
        { value: 'daily', label: 'Daily' },
        { value: 'weekdays', label: 'Weekdays' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
      ]} />
      {value?.kind === 'weekly' && (
        <div class="chips" style={{ marginTop: 8 }}>
          {WEEKDAYS.map((d, i) => {
            const on = value.days?.includes(i) ?? false;
            return (
              <button type="button" key={d} class="chip press" aria-pressed={on} onClick={() => {
                const days = on ? (value.days ?? []).filter((x) => x !== i) : [...(value.days ?? []), i];
                if (days.length) onChange({ kind: 'weekly', days: days.sort() });
              }}>{d[0].toUpperCase() + d.slice(1)}</button>
            );
          })}
        </div>
      )}
      {value?.kind === 'monthly' && (
        <div style={{ marginTop: 8 }} class="inline">
          <span class="meta">Day of month</span>
          <Stepper value={value.dayOfMonth ?? 1} min={1} max={31} onChange={(v) => onChange({ kind: 'monthly', dayOfMonth: v })} />
        </div>
      )}
    </div>
  );
}
