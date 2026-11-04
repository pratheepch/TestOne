import { useState } from 'preact/hooks';
import type { Task } from '../core/types';
import { shortDate, toDateKey } from '../core/dates';
import * as S from '../data/store';
import { TaskRow } from '../ui/TaskRow';
import { Segmented } from '../ui/bits';
import { listTab, projectFilter, showToast } from '../ui/nav';

const TABS = [
  { value: 'next' as const, label: 'Next' },
  { value: 'waiting' as const, label: 'Waiting' },
  { value: 'someday' as const, label: 'Someday' },
  { value: 'projects' as const, label: 'Projects' },
  { value: 'done' as const, label: 'Done' },
];

export function ListsScreen() {
  const tab = listTab.value;
  const pf = projectFilter.value;
  const all = S.liveTasks.value;
  const today = toDateKey(S.now.value);
  const project = pf ? S.projects.value.find((p) => p.id === pf) : undefined;

  const byStatus = (status: Task['status']) =>
    all
      .filter((t) => t.status === status && (!pf || t.projectId === pf))
      .sort((a, b) => (a.deferUntil ?? '').localeCompare(b.deferUntil ?? '') || a.createdAt - b.createdAt);

  return (
    <main class="screen" aria-label="Lists">
      <div class="screen-head">
        <h1 class="screen-title">{project ? project.name : 'Lists'}</h1>
        {project && <button type="button" class="btn btn-quiet btn-sm press" onClick={() => (projectFilter.value = null)}>All</button>}
      </div>
      <Segmented label="List" scroll value={tab} onChange={(v) => (listTab.value = v)} options={pf ? TABS.filter((t) => t.value !== 'projects') : TABS} />
      <div style={{ height: 16 }} />
      {tab === 'projects' ? <Projects /> : tab === 'done' ? <DoneLog tasks={byStatus('done')} today={today} /> : <Plain tasks={byStatus(tab)} tab={tab} />}
    </main>
  );
}

const EMPTY: Record<string, [string, string]> = {
  next: ['Nothing next.', 'Add something with +, or clarify your Inbox.'],
  waiting: ['Not waiting on anyone.', 'Add w:Name when capturing to track it here.'],
  someday: ['Someday is empty.', 'Park ideas here so they stop nagging you.'],
};

function Plain({ tasks, tab }: { tasks: Task[]; tab: string }) {
  if (!tasks.length) return <div class="empty"><h3>{EMPTY[tab][0]}</h3>{EMPTY[tab][1]}</div>;
  return <div class="rows">{tasks.map((t, i) => <TaskRow key={t.id} t={t} index={i} />)}</div>;
}

function DoneLog({ tasks, today }: { tasks: Task[]; today: string }) {
  const [limit, setLimit] = useState(50);
  if (!tasks.length) return <div class="empty"><h3>Nothing done yet.</h3>Finished tasks collect here.</div>;
  const sorted = tasks.slice().sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)).slice(0, limit);
  const groups = new Map<string, Task[]>();
  for (const t of sorted) {
    const k = toDateKey(t.doneAt ?? t.updatedAt);
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  return (
    <>
      {[...groups].map(([day, ts]) => (
        <section key={day}>
          <h2 class="section-label">{shortDate(day, today)} · {ts.length}</h2>
          <div class="rows">{ts.map((t, i) => <TaskRow key={t.id} t={t} index={i} />)}</div>
        </section>
      ))}
      {tasks.length > limit && <button type="button" class="btn btn-quiet btn-block press" style={{ marginTop: 16 }} onClick={() => setLimit((l) => l + 50)}>Show more</button>}
    </>
  );
}

function Projects() {
  const [name, setName] = useState('');
  const tasks = S.liveTasks.value;
  const projects = S.liveProjects.value.filter((p) => p.status !== 'done');
  return (
    <>
      <form class="inline" style={{ marginBottom: 16 }} onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        S.ensureProject(name);
        setName('');
      }}>
        <input class="input" placeholder="New project" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        <button type="submit" class="btn btn-quiet press" disabled={!name.trim()}>Add</button>
      </form>
      {!projects.length && <div class="empty"><h3>No projects yet.</h3>Type #name when capturing to start one.</div>}
      <div class="rows">
        {projects.map((p, i) => {
          const open = tasks.filter((t) => t.projectId === p.id && (t.status === 'next' || t.status === 'inbox' || t.status === 'waiting'));
          const next = open.filter((t) => t.status === 'next' || t.status === 'inbox');
          return (
            <div class="row-wrap" key={p.id} style={{ animationDelay: `${i * 25}ms` }}>
              <button type="button" class="row" onClick={() => { projectFilter.value = p.id; listTab.value = 'next'; }}>
                <span class="row-main">
                  <span class="row-title">{p.name}</span>
                  <span class="row-meta">
                    {next.length ? <span>{next.length} next action{next.length > 1 ? 's' : ''}</span> : <span style={{ color: 'var(--accent)' }}>No next action</span>}
                    {p.status === 'someday' && <span>Someday</span>}
                  </span>
                </span>
                <span class="btn btn-ghost btn-sm" role="button" tabIndex={0} onClick={(e) => {
                  e.stopPropagation();
                  S.updateProject(p.id, { status: 'done' });
                  showToast(`${p.name} completed`, { label: 'Undo', run: () => S.updateProject(p.id, { status: 'active' }) });
                }}>Complete</span>
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
