// A list row. Swipe right to finish, tap to edit, tap the circle to finish.

import { useRef, useState } from 'preact/hooks';
import type { Task } from '../core/types';
import { formatMinutes, shortDate, toDateKey } from '../core/dates';
import { describeRepeat } from '../core/repeat';
import { effortOf } from '../core/pace';
import * as S from '../data/store';
import { EnergyBars } from './bits';
import { editTaskId, haptic, showToast } from './nav';
import { useSwipe } from './swipe';
import { IconRepeat } from './icons';

export function TaskRow({ t, index = 0, showProject = true }: { t: Task; index?: number; showProject?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);
  const done = t.status === 'done';
  const today = toDateKey(S.now.value);
  const project = showProject && t.projectId ? S.projects.value.find((p) => p.id === t.projectId) : undefined;

  const finish = () => {
    if (done) {
      const u = S.moveTask(t.id, 'next', 'Back to Next');
      showToast('Back in Next', u);
      return;
    }
    haptic(12);
    setLeaving(true);
    setTimeout(() => {
      const u = S.completeTask(t.id);
      const d = S.getTask(t.id);
      showToast(d ? `Done · +${effortOf(d)} pts` : 'Done', u);
    }, 220);
  };

  useSwipe(ref, {
    mode: 'row',
    dirs: ['right'],
    threshold: 0.3,
    onProgress: (p) => wrap.current?.classList.toggle('dragging', p > 0),
    onRelease: () => {
      const el = ref.current;
      if (el) { el.style.transition = 'transform 200ms var(--ease-out)'; el.style.transform = 'translateX(110%)'; }
      finish();
    },
    onTap: (e) => {
      if ((e.target as HTMLElement).closest('.check')) return;
      editTaskId.value = t.id;
    },
  });

  return (
    <div ref={wrap} class={`row-wrap${leaving ? ' collapse' : ''}`} style={{ animationDelay: `${Math.min(index, 10) * 25}ms` }}>
      <div class="row-under right"><span>{done ? 'Undo' : 'Done'}</span></div>
      <button type="button" ref={ref} class={`row${done ? ' done' : ''}`} aria-label={`${t.title}. Open`}>
        <span class={`check${done || leaving ? ' on' : ''}`} role="checkbox" aria-checked={done} aria-label={done ? 'Mark not done' : 'Mark done'}
          onClick={(e) => { e.stopPropagation(); finish(); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        <span class="row-main">
          <span class="row-title">{t.title}</span>
          <span class="row-meta">
            <EnergyBars level={t.energy} />
            <span>~{formatMinutes(t.estimateMin)}</span>
            {done && t.doneAt && <span>{shortDate(toDateKey(t.doneAt), today)} · {effortOf(t)} pts</span>}
            {t.waitingOn && <span>Waiting on {t.waitingOn}</span>}
            {t.deferUntil && t.deferUntil > today && <span>From {shortDate(t.deferUntil, today)}</span>}
            {t.repeat && <span><IconRepeat size={11} /> {describeRepeat(t.repeat)}</span>}
            {project && <span>{project.name}</span>}
            {t.context && <span>@{t.context}</span>}
          </span>
        </span>
      </button>
    </div>
  );
}
