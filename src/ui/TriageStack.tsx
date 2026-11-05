// A swipeable stack for sorting tasks one by one: Inbox clarify and the
// weekly review steps share it.

import { useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Task } from '../core/types';
import { ENERGY_LABEL } from '../core/energy';
import { formatMinutes, NICE } from './fmt';
import * as S from '../data/store';
import { EnergyBars } from './bits';
import { editTaskId, haptic } from './nav';
import { flyOff, useSwipe, type Dir, type Release } from './swipe';

export interface TriageAction {
  label: string;
  icon?: ComponentChildren;
  primary?: boolean;
  run: (t: Task) => void;
  /** Shown only when this returns true. */
  when?: (t: Task) => boolean;
}

interface Props {
  items: Task[];
  right: TriageAction;
  left: TriageAction;
  buttons: TriageAction[];
  editable?: boolean;
  subtitle?: (t: Task) => string;
  empty: ComponentChildren;
}

export function TriageStack({ items, right, left, buttons, editable, subtitle, empty }: Props) {
  const [ghosts, setGhosts] = useState<{ key: string; t: Task; dir: Dir; r: Release }[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const visible = items.slice(0, 3);
  const top = visible[0];

  const label = (p: number) => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--drag', String(Math.abs(p)));
    const lbl = el.querySelector<HTMLElement>('.dir-label');
    if (lbl) {
      lbl.textContent = p > 0 ? right.label : p < 0 ? left.label : '';
      lbl.style.setProperty('--dl', String(Math.min(1, Math.abs(p) * 1.4)));
    }
  };

  const act = (t: Task, a: TriageAction, dir: Dir, r?: Release) => {
    haptic(8);
    const width = ref.current?.getBoundingClientRect().width ?? 360;
    setGhosts((g) => [...g, { key: `${t.id}-${Date.now()}`, t, dir, r: r ?? { dir, dx: 0, dy: 0, rot: 0, velocity: 0, width } }]);
    a.run(t);
    label(0);
  };

  if (!top && !ghosts.length) return <div class="empty">{empty}</div>;

  return (
    <div>
      <div class="stack" ref={ref}>
        {visible.slice().reverse().map((t) => (
          <TriageCard key={t.id} t={t} pos={visible.indexOf(t)} editable={editable} subtitle={subtitle?.(t)}
            onProgress={label} onCancel={() => label(0)}
            onRelease={(r) => act(t, r.dir === 'right' ? right : left, r.dir, r)} />
        ))}
        {ghosts.map((g) => (
          <div key={g.key} class="dcard leaving" data-pos="0" ref={(el) => {
            if (!el || el.dataset.anim) return;
            el.dataset.anim = '1';
            void flyOff(el, g.r, g.dir, g.r.velocity, g.r.width).then(() => setGhosts((a) => a.filter((x) => x.key !== g.key)));
          }}>
            <div class="dcard-inner"><Face t={g.t} /></div>
          </div>
        ))}
        <span class="dir-label" aria-hidden="true" />
      </div>
      {top && (
        <div class="action-grid" style={{ gridTemplateColumns: `repeat(${Math.min(4, buttons.filter((b) => !b.when || b.when(top)).length)}, 1fr)` }}>
          {buttons.filter((b) => !b.when || b.when(top)).map((b) => (
            <button type="button" key={b.label} class={`press${b.primary ? ' primary' : ''}`}
              onClick={() => act(top, b, b === left ? 'left' : 'right')}>
              {b.icon}{b.label}
            </button>
          ))}
        </div>
      )}
      {top && <p class="meta" style={{ textAlign: 'center' }}>{items.length} left · swipe right for {right.label}, left for {left.label}</p>}
    </div>
  );
}

function TriageCard({ t, pos, editable, subtitle, onProgress, onCancel, onRelease }: {
  t: Task; pos: number; editable?: boolean; subtitle?: string; onProgress: (p: number) => void; onCancel: () => void; onRelease: (r: Release) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useSwipe(ref, { enabled: pos === 0, mode: 'card', onProgress, onCancel, onRelease, onLongPress: () => (editTaskId.value = t.id) });
  return (
    <div ref={ref} class="dcard" data-pos={pos} aria-hidden={pos !== 0}>
      <div class="dcard-inner"><Face t={t} editable={editable && pos === 0} subtitle={subtitle} /></div>
    </div>
  );
}

function Face({ t, editable, subtitle }: { t: Task; editable?: boolean; subtitle?: string }) {
  const cycleEnergy = () => S.updateTask(t.id, { energy: t.energy === 'low' ? 'med' : t.energy === 'med' ? 'high' : 'low', energySource: 'user' });
  const cycleTime = () => {
    const i = NICE.indexOf(t.estimateMin);
    S.updateTask(t.id, { estimateMin: NICE[(i + 1) % NICE.length], estimateSource: 'user' });
  };
  const project = t.projectId ? S.projects.value.find((p) => p.id === t.projectId) : undefined;
  return (
    <div class="dface front">
      {subtitle && <p class="caption on-accent-muted" style={{ margin: 0 }}>{subtitle}</p>}
      <h2 class="dtitle" style={{ fontSize: 'var(--fs-title)' }}>{t.title}</h2>
      <div class="chips" style={{ marginTop: 'auto' }} data-noswipe={editable ? '' : undefined}>
        {editable ? (
          <>
            <button type="button" class="chip on-yellow press" onClick={cycleEnergy} aria-label="Change energy">
              <EnergyBars level={t.energy} /> {ENERGY_LABEL[t.energy]}{t.energySource === 'auto' ? ' ?' : ''}
            </button>
            <button type="button" class="chip on-yellow press" onClick={cycleTime} aria-label="Change time">
              ~{formatMinutes(t.estimateMin)}{t.estimateSource === 'auto' ? ' ?' : ''}
            </button>
            <button type="button" class="chip on-yellow press" onClick={() => (editTaskId.value = t.id)}>
              {project ? project.name : 'More…'}
            </button>
          </>
        ) : (
          <>
            <span class="chip on-yellow"><EnergyBars level={t.energy} /> {ENERGY_LABEL[t.energy]}</span>
            <span class="chip on-yellow">~{formatMinutes(t.estimateMin)}</span>
            {project && <span class="chip on-yellow">{project.name}</span>}
          </>
        )}
      </div>
      {editable && <p class="meta on-accent-muted" style={{ margin: '8px 0 0' }}>Tap a chip to correct the guess.</p>}
    </div>
  );
}
