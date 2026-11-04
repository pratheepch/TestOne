// Weekly review: Inbox → Gone quiet → Next & Waiting → Projects → Someday → Backup.

import { useState } from 'preact/hooks';
import type { Task } from '../core/types';
import { daysBetween, toDateKey } from '../core/dates';
import { weeklyReviewIcs } from '../core/ics';
import * as S from '../data/store';
import { quietTasks } from '../ui/derived';
import { go, showToast } from '../ui/nav';
import { InboxClarify } from '../ui/Clarify';
import { TriageStack } from '../ui/TriageStack';
import { shareFile } from '../ui/share';
import { IconArchive, IconBack, IconCalendar, IconCheck, IconDownload, IconTrash } from '../ui/icons';

const STEPS = ['Inbox', 'Gone quiet', 'Next & Waiting', 'Projects', 'Someday', 'Backup'];

export function ReviewScreen() {
  const [step, setStep] = useState(0);
  const [seen] = useState(() => new Set<string>());
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));

  return (
    <main class="screen" aria-label="Weekly review">
      <div class="screen-head">
        <button type="button" class="icon-btn press" aria-label="Close review" onClick={() => go('now')}><IconBack /></button>
        <div style={{ flex: 1 }}>
          <h1 class="screen-title" style={{ fontSize: 'var(--fs-title)' }}>{STEPS[step]}</h1>
          <span class="meta">Weekly review · step {step + 1} of {STEPS.length}</span>
        </div>
        <span class="progress-dots" aria-hidden="true">{STEPS.map((_, i) => <i key={i} class={i === step ? 'on' : ''} />)}</span>
      </div>
      <div class="step" key={step}>
        {step === 0 && <InboxStep />}
        {step === 1 && <QuietStep />}
        {step === 2 && <ActiveStep seen={seen} />}
        {step === 3 && <ProjectsStep />}
        {step === 4 && <SomedayStep />}
        {step === 5 && <BackupStep />}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        {step > 0 && <button type="button" class="btn btn-quiet press" onClick={() => setStep(step - 1)}>Back</button>}
        {step < STEPS.length - 1 ? (
          <button type="button" class="btn btn-primary press" style={{ flex: 1 }} onClick={next}>Next step</button>
        ) : (
          <button type="button" class="btn btn-primary press" style={{ flex: 1 }} onClick={() => {
            S.updateSettings({ lastReviewAt: Date.now() });
            showToast('Review done. Clear head, clear lists.');
            go('now');
          }}>Finish review</button>
        )}
      </div>
    </main>
  );
}

function InboxStep() {
  if (!S.inboxTasks.value.length) return <div class="empty"><h3>Inbox is empty.</h3>Nothing to sort. On to the next step.</div>;
  return (<><p class="meta">Decide what each captured thing is.</p><InboxClarify /></>);
}

function QuietStep() {
  const items = quietTasks.value;
  const now = Date.now();
  const days = (t: Task) => daysBetween(toDateKey(t.lastTouchedAt), toDateKey(now));
  return (
    <>
      <p class="meta">Tasks nobody has touched for {S.settings.value.quietDays}+ days. Nothing moves without you.</p>
      {items.length > 15 && (
        <button type="button" class="btn btn-quiet btn-block press" style={{ marginBottom: 12 }} onClick={() => {
          const ids = items.map((t) => t.id);
          for (const id of ids) S.updateTask(id, { status: 'someday' });
          showToast(`Parked ${ids.length} in Someday`, { label: 'Undo', run: () => ids.forEach((id) => S.updateTask(id, { status: 'next' })) });
        }}><IconArchive /> Park all {items.length} in Someday</button>
      )}
      <TriageStack
        items={items}
        subtitle={(t) => `Quiet for ${days(t)} days`}
        right={{ label: 'Keep', icon: <IconCheck size={18} />, primary: true, run: (t) => S.updateTask(t.id, {}) }}
        left={{ label: 'Someday', icon: <IconArchive size={18} />, run: (t) => S.moveTask(t.id, 'someday', 'Someday') }}
        buttons={[
          { label: 'Drop', icon: <IconTrash size={18} />, run: (t) => showToast('Dropped', S.moveTask(t.id, 'trash', 'Drop')) },
          { label: 'Someday', icon: <IconArchive size={18} />, run: (t) => S.moveTask(t.id, 'someday', 'Someday') },
          { label: 'Keep', icon: <IconCheck size={18} />, primary: true, run: (t) => S.updateTask(t.id, {}) },
        ]}
        empty={<><h3>Nothing has gone quiet.</h3>Your lists are fresh.</>}
      />
    </>
  );
}

function ActiveStep({ seen }: { seen: Set<string> }) {
  const [, bump] = useState(0);
  const items = S.liveTasks.value.filter((t) => (t.status === 'next' || t.status === 'waiting') && !seen.has(t.id) && !t.repeat);
  const mark = (t: Task) => { seen.add(t.id); bump((n) => n + 1); };
  return (
    <>
      <p class="meta">Quick pass: is each one still right?</p>
      <TriageStack
        items={items}
        subtitle={(t) => (t.status === 'waiting' ? `Waiting${t.waitingOn ? ` on ${t.waitingOn}` : ''}` : 'Next')}
        right={{ label: 'Keep', icon: <IconCheck size={18} />, primary: true, run: (t) => { S.updateTask(t.id, {}); mark(t); } }}
        left={{ label: 'Someday', icon: <IconArchive size={18} />, run: (t) => { S.moveTask(t.id, 'someday', 'Someday'); mark(t); } }}
        buttons={[
          { label: 'Drop', icon: <IconTrash size={18} />, run: (t) => { S.moveTask(t.id, 'trash', 'Drop'); mark(t); } },
          { label: 'Done', icon: <IconCheck size={18} />, run: (t) => { S.completeTask(t.id); mark(t); } },
          { label: 'Someday', icon: <IconArchive size={18} />, run: (t) => { S.moveTask(t.id, 'someday', 'Someday'); mark(t); } },
          { label: 'Keep', icon: <IconCheck size={18} />, primary: true, run: (t) => { S.updateTask(t.id, {}); mark(t); } },
        ]}
        empty={<><h3>All reviewed.</h3>Next and Waiting look right.</>}
      />
    </>
  );
}

function ProjectsStep() {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const tasks = S.liveTasks.value;
  const stuck = S.liveProjects.value.filter(
    (p) => p.status === 'active' && !tasks.some((t) => t.projectId === p.id && (t.status === 'next' || t.status === 'inbox' || t.status === 'waiting')),
  );
  if (!stuck.length) return <div class="empty"><h3>Every project has a next step.</h3>That's what keeps them moving.</div>;
  return (
    <>
      <p class="meta">These projects have no next action. Add one, or let them rest.</p>
      <div class="rows">
        {stuck.map((p) => (
          <div class="card" key={p.id}>
            <div style={{ fontSize: 'var(--fs-body)', marginBottom: 8 }}>{p.name}</div>
            <form class="inline" onSubmit={(e) => {
              e.preventDefault();
              const text = drafts[p.id]?.trim();
              if (!text) return;
              const t = S.createTask(text);
              if (t) S.updateTask(t.id, { status: 'next', projectId: p.id, energySource: t.energySource, estimateSource: t.estimateSource });
              setDrafts({ ...drafts, [p.id]: '' });
            }}>
              <input class="input" placeholder="Next action" value={drafts[p.id] ?? ''} onInput={(e) => setDrafts({ ...drafts, [p.id]: (e.target as HTMLInputElement).value })} />
              <button type="submit" class="btn btn-primary press">Add</button>
            </form>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" class="btn btn-ghost btn-sm press" onClick={() => S.updateProject(p.id, { status: 'someday' })}>Someday</button>
              <button type="button" class="btn btn-ghost btn-sm press" onClick={() => S.updateProject(p.id, { status: 'done' })}>Complete</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function SomedayStep() {
  const items = S.liveTasks.value.filter((t) => t.status === 'someday');
  if (!items.length) return <div class="empty"><h3>Someday is empty.</h3>Nothing parked.</div>;
  return (
    <>
      <p class="meta">A glance. Bring back anything whose time has come.</p>
      <div class="rows">
        {items.map((t, i) => (
          <div class="row-wrap" key={t.id} style={{ animationDelay: `${i * 25}ms` }}>
            <div class="row">
              <span class="row-main"><span class="row-title">{t.title}</span></span>
              <button type="button" class="btn btn-quiet btn-sm press" onClick={() => showToast('Back in Next', S.moveTask(t.id, 'next', 'Next'))}>Activate</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function BackupStep() {
  const s = S.settings.value;
  return (
    <>
      <p class="meta">Your data lives only on this phone. A backup takes one tap.</p>
      <button type="button" class="btn btn-primary btn-block press" onClick={() => void exportNow()}><IconDownload /> Export backup</button>
      <p class="meta" style={{ textAlign: 'center' }}>{s.lastExportAt ? `Last backup ${new Date(s.lastExportAt).toLocaleDateString()}` : 'No backup yet'}</p>
      <h2 class="section-label">Reminder</h2>
      <button type="button" class="btn btn-quiet btn-block press" onClick={() => void addReviewToCalendar()}><IconCalendar /> Add weekly review to Calendar</button>
    </>
  );
}

export async function exportNow(): Promise<void> {
  const data = S.exportBackup();
  await shareFile(`todoflow-backup-${toDateKey(Date.now())}.json`, 'application/json', JSON.stringify(data));
}

export async function addReviewToCalendar(): Promise<void> {
  const s = S.settings.value;
  await shareFile('todoflow-weekly-review.ics', 'text/calendar', weeklyReviewIcs(s.reviewDay, 18, location.href));
}
