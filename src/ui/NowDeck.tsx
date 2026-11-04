// The Now deck: one suggestion at a time, as a stack of cards.
// Spec: docs/DESIGN.md#the-now-deck

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Suggestion } from '../core/rank';
import { skipsThisWeek } from '../core/rank';
import { breakIdeas, type BreakIdea } from '../core/breaks';
import { ENERGY_LABEL } from '../core/energy';
import { addDays, formatMinutes, toDateKey } from '../core/dates';
import { describeRepeat } from '../core/repeat';
import { effortOf } from '../core/pace';
import * as S from '../data/store';
import { deck, pace } from './derived';
import { captureOpen, editTaskId, focus, go, haptic, listTab, showToast } from './nav';
import { flyOff, useSwipe, type Dir, type Release } from './swipe';
import { EnergyBars, Sheet } from './bits';
import { IconCalendar, IconCheck, IconEdit, IconPlay, IconRepeat, IconSplit, IconArchive, IconX, Tick } from './icons';

const PASS_LIMIT = 7;
const BREAK_GAP_MS = 90 * 60_000;

type Item =
  | { key: string; kind: 'task'; s: Suggestion }
  | { key: string; kind: 'break'; idea: BreakIdea }
  | { key: string; kind: 'limit' }
  | { key: string; kind: 'clear' }
  | { key: string; kind: 'first' };

interface Ghost {
  key: string;
  item: Item;
  dir: Dir;
  from: { dx: number; dy: number; rot: number };
  velocity: number;
  width: number;
}

// Session memory (resets when the app restarts, by design).
const skippedLight = new Set<string>();
const splitAsked = new Set<string>();
let lastBreakOffer = 0;
let doneThisSession = 0;

export function NowDeck() {
  const suggestions = deck.value;
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [pass, setPass] = useState(0);
  const [breakIdx, setBreakIdx] = useState(0);
  const [flipped, setFlipped] = useState<{ key: string; mode: 'actions' | 'split' } | null>(null);
  const [splitFor, setSplitFor] = useState<string | null>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const enterDir = useRef(new Map<string, Dir>());
  const seen = useRef(new Set<string>());

  const hour = new Date(S.now.value).getHours();
  const recentBreakKinds = S.breaks.value.slice().sort((a, b) => b.startedAt - a.startedAt).map((b) => b.kind);
  const ideas = useMemo(() => breakIdeas(hour, recentBreakKinds), [hour, recentBreakKinds.slice(0, 3).join()]);
  const idea = ideas[breakIdx % ideas.length];
  const breakItem: Item = { key: `break-${idea.kind}-${breakIdx}`, kind: 'break', idea };

  // Build the visible stack.
  let items: Item[] = [];
  const zone = pace.value.zone;
  const lastBreak = Math.max(0, ...S.breaks.value.map((b) => b.startedAt));
  const breakDue = S.settings.value.paceEnabled && (zone === 'stretching' || zone === 'overreaching') && doneThisSession > 0 &&
    S.now.value - lastBreak > BREAK_GAP_MS && S.now.value - lastBreakOffer > BREAK_GAP_MS;

  if (!S.liveTasks.value.length) items = [{ key: 'first', kind: 'first' }];
  else if (!suggestions.length) items = [{ key: 'clear', kind: 'clear' }];
  else if (pass >= PASS_LIMIT) items = [{ key: 'limit', kind: 'limit' }];
  else if (suggestions[0].light) {
    items = skippedLight.has(suggestions[0].task.id) ? [breakItem] : [{ key: suggestions[0].task.id, kind: 'task', s: suggestions[0] }, breakItem];
  } else {
    items = suggestions.slice(0, 3).map((s) => ({ key: s.task.id, kind: 'task' as const, s }));
    if (breakDue) items = [breakItem, ...items].slice(0, 3);
  }
  const visible = items.slice(0, 3);
  const top = visible[0];

  // Cards that come back (undo) fly in from the side they left.
  const enterClass = (key: string, pos: number) => {
    if (pos !== 0 || seen.current.has(key)) return '';
    const d = enterDir.current.get(key);
    return d ? (d === 'right' ? ' enter-right' : ' enter-left') : '';
  };
  useEffect(() => {
    for (const it of visible) seen.current.add(it.key);
    for (const g of ghosts) seen.current.delete(g.key);
  });

  const setDrag = (p: number) => {
    const d = deckRef.current;
    if (!d) return;
    d.style.setProperty('--drag', String(Math.abs(p)));
    const topEl = d.querySelector<HTMLElement>('.dcard[data-pos="0"]');
    topEl?.style.setProperty('--pr', String(Math.max(0, p)));
    topEl?.style.setProperty('--pl', String(Math.max(0, -p)));
  };

  const settle = () => {
    const d = deckRef.current;
    if (!d) return;
    d.classList.add('settling');
    setDrag(0);
    setTimeout(() => d.classList.remove('settling'), 260);
  };

  /** Perform the action for a committed swipe. Returns false to cancel the fly-off. */
  const commit = (item: Item, dir: Dir): boolean => {
    if (item.kind === 'task') {
      const t = item.s.task;
      if (dir === 'right') {
        const undo = S.completeTask(t.id);
        doneThisSession++;
        haptic(12);
        const done = S.getTask(t.id);
        showToast(done ? `Done · +${effortOf(done)} pts` : 'Done', undo);
      } else {
        if (skipsThisWeek(t, Date.now()) >= 2 && !splitAsked.has(t.id)) {
          splitAsked.add(t.id);
          setFlipped({ key: t.id, mode: 'split' });
          return false;
        }
        if (item.s.light) skippedLight.add(t.id);
        const undo = S.skipTask(t.id);
        haptic(6);
        showToast('Not now · back later today', undo);
      }
      setPass((p) => p + 1);
    } else if (item.kind === 'break') {
      lastBreakOffer = Date.now();
      if (dir === 'right') focus.value = { kind: 'break', breakKind: item.idea.kind };
      else setBreakIdx((i) => i + 1);
    }
    enterDir.current.set(item.key, dir);
    setFlipped(null);
    return true;
  };

  const release = (item: Item, r: Release) => {
    if (!commit(item, r.dir)) {
      const el = deckRef.current?.querySelector<HTMLElement>('.dcard[data-pos="0"]');
      if (el) {
        el.style.transition = 'transform 280ms var(--spring)';
        el.style.transform = '';
      }
      settle();
      return;
    }
    setGhosts((g) => [...g, { key: `${item.key}-ghost-${Date.now()}`, item, dir: r.dir, from: { dx: r.dx, dy: r.dy, rot: r.rot }, velocity: r.velocity, width: r.width }]);
    settle();
  };

  const programmatic = (dir: Dir) => {
    if (!top || (top.kind !== 'task' && top.kind !== 'break')) return;
    const width = deckRef.current?.getBoundingClientRect().width ?? 360;
    release(top, { dir, dx: 0, dy: 0, rot: 0, velocity: 0, width });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('.sheet.open, .focus')) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') programmatic('right');
      if (e.key === 'ArrowLeft') programmatic('left');
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const canSwipe = top && (top.kind === 'task' || top.kind === 'break') && !flipped;

  return (
    <>
      <div class="deck" ref={deckRef} aria-roledescription="card deck" aria-live="polite">
        {visible.slice().reverse().map((it) => {
          const pos = visible.indexOf(it);
          return (
            <DeckCard
              key={it.key}
              item={it}
              pos={pos}
              extraClass={enterClass(it.key, pos)}
              flipped={flipped?.key === it.key ? flipped.mode : null}
              enabled={pos === 0 && !!canSwipe}
              onProgress={setDrag}
              onCancel={settle}
              onRelease={(r) => release(it, r)}
              onTap={() => {
                if (it.kind === 'task') setFlipped((f) => (f?.key === it.key ? null : { key: it.key, mode: 'actions' }));
              }}
              onUnflip={() => setFlipped(null)}
              onSplit={(id) => { setFlipped(null); setSplitFor(id); }}
              onKeepAfterSplitAsk={(id) => {
                setFlipped(null);
                const undo = S.skipTask(id);
                setPass((p) => p + 1);
                showToast('Not now · back later today', undo);
              }}
              onPassReset={() => setPass(0)}
            />
          );
        })}
        {ghosts.map((g) => (
          <div
            key={g.key}
            class={`dcard leaving ${g.dir}${g.item.kind === 'break' ? ' break-card' : ''}`}
            data-pos="0"
            style={{ ['--pr' as string]: g.dir === 'right' ? 1 : 0, ['--pl' as string]: g.dir === 'left' ? 1 : 0 }}
            ref={(el) => {
              if (!el || el.dataset.anim) return;
              el.dataset.anim = '1';
              void flyOff(el, g.from, g.dir, g.velocity, g.width).then(() => setGhosts((all) => all.filter((x) => x.key !== g.key)));
            }}
          >
            <div class="dcard-inner"><Front item={g.item} /></div>
          </div>
        ))}
      </div>
      <div class="deck-buttons">
        <button type="button" class="round press" aria-label={top?.kind === 'break' ? 'Another idea' : 'Not now'} disabled={!canSwipe} onClick={() => programmatic('left')}>
          <IconX size={26} />
        </button>
        <button type="button" class="round yes press" aria-label={top?.kind === 'break' ? 'Start break' : 'Done'} disabled={!canSwipe} onClick={() => programmatic('right')}>
          {top?.kind === 'break' ? <IconPlay size={26} /> : <IconCheck size={28} />}
        </button>
      </div>
      <SplitSheet id={splitFor} onClose={() => setSplitFor(null)} />
    </>
  );
}

function DeckCard(props: {
  item: Item; pos: number; extraClass: string; flipped: 'actions' | 'split' | null; enabled: boolean;
  onProgress: (p: number) => void; onCancel: () => void; onRelease: (r: Release) => void; onTap: () => void;
  onUnflip: () => void; onSplit: (id: string) => void; onKeepAfterSplitAsk: (id: string) => void; onPassReset: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { item } = props;
  useSwipe(ref, {
    enabled: props.enabled,
    mode: 'card',
    onProgress: props.onProgress,
    onCancel: props.onCancel,
    onRelease: props.onRelease,
    onTap: (e) => {
      if ((e.target as HTMLElement).closest('button, a')) return;
      if (props.flipped) props.onUnflip();
      else props.onTap();
    },
    onLongPress: item.kind === 'task' ? () => { haptic(10); editTaskId.value = item.s.task.id; } : undefined,
  });

  // Clear any inline transform left by a cancelled drag when this card moves position.
  useEffect(() => {
    const el = ref.current;
    if (el && props.pos !== 0) { el.style.transform = ''; el.style.transition = ''; }
  }, [props.pos]);

  const label =
    item.kind === 'task'
      ? `${item.s.task.title}, ${ENERGY_LABEL[item.s.task.energy]} energy, about ${formatMinutes(item.s.task.estimateMin)}`
      : item.kind === 'break' ? `Break idea: ${item.idea.title}` : undefined;

  return (
    <div
      ref={ref}
      class={`dcard${props.flipped ? ' flipped' : ''}${item.kind === 'break' ? ' break-card' : ''}${props.extraClass}`}
      data-pos={props.pos}
      aria-hidden={props.pos !== 0}
      aria-label={props.pos === 0 ? label : undefined}
      role={props.pos === 0 && label ? 'group' : undefined}
    >
      <div class="dcard-inner">
        <Front item={item} onPassReset={props.onPassReset} />
        {item.kind === 'task' && props.pos === 0 && (
          <Back
            mode={props.flipped ?? 'actions'}
            s={item.s}
            onDone={props.onUnflip}
            onSplit={() => props.onSplit(item.s.task.id)}
            onKeep={() => props.onKeepAfterSplitAsk(item.s.task.id)}
          />
        )}
      </div>
    </div>
  );
}

function Front({ item, onPassReset }: { item: Item; onPassReset?: () => void }) {
  if (item.kind === 'task') {
    const t = item.s.task;
    const project = t.projectId ? S.projects.value.find((p) => p.id === t.projectId) : undefined;
    return (
      <div class="dface front">
        <div class="dlabel">
          <EnergyBars level={t.energy} />
          <span>{item.s.light ? 'Light option · ' : ''}{ENERGY_LABEL[t.energy]} energy · ~{formatMinutes(t.estimateMin)}</span>
          {t.repeat && <IconRepeat size={14} />}
        </div>
        <h2 class="dtitle">{t.title}</h2>
        <span class="stamp done"><Tick /> Done</span>
        <span class="stamp next">Next</span>
        <p class="dwhy">{item.s.why}</p>
        <div class="dfoot">
          {project && <span>{project.name}</span>}
          {t.context && <span>@{t.context}</span>}
          {t.repeat && <span><IconRepeat size={12} /> {describeRepeat(t.repeat)}</span>}
        </div>
      </div>
    );
  }
  if (item.kind === 'break') {
    return (
      <div class="dface front">
        <div class="dlabel"><span>Break · {item.idea.minutes} min</span></div>
        <h2 class="dtitle">{item.idea.title}</h2>
        <span class="stamp done">Start</span>
        <span class="stamp next">Another</span>
        <p class="dwhy">{item.idea.detail}<br /><br />Swipe right to start, left for another idea.</p>
      </div>
    );
  }
  if (item.kind === 'limit') {
    return (
      <div class="dface front">
        <div class="deck-empty">
          <h2>That's the best of what fits.</h2>
          <p class="meta">Flicking through more rarely helps. Pick one, or look at everything.</p>
          <button type="button" class="btn btn-quiet press" style={{ background: 'rgba(0,0,0,.12)', color: 'inherit' }} onClick={() => { listTab.value = 'next'; go('lists'); }}>Show the full list</button>
          <button type="button" class="btn btn-ghost press" style={{ color: 'inherit' }} onClick={onPassReset}>Go through again</button>
        </div>
      </div>
    );
  }
  if (item.kind === 'clear') {
    return (
      <div class="dface front">
        <div class="deck-empty">
          <h2>All clear for your energy right now.</h2>
          <p class="meta" style={{ color: 'inherit', opacity: 0.7 }}>Nothing is waiting for you today.</p>
          <button type="button" class="btn btn-quiet press" style={{ background: 'rgba(0,0,0,.12)', color: 'inherit' }} onClick={() => { listTab.value = 'next'; go('lists'); }}>Show everything</button>
        </div>
      </div>
    );
  }
  return (
    <div class="dface front">
      <div class="deck-empty">
        <h2>What's on your mind?</h2>
        <p style={{ opacity: 0.7, margin: 0 }}>Add a task. TodoFlow guesses the time and energy it needs, then shows it here when it fits.</p>
        <button type="button" class="btn press" style={{ background: 'var(--on-accent)', color: 'var(--accent)' }} onClick={() => (captureOpen.value = true)}>Add a task</button>
      </div>
    </div>
  );
}

function Back({ mode, s, onDone, onSplit, onKeep }: { mode: 'actions' | 'split'; s: Suggestion; onDone: () => void; onSplit: () => void; onKeep: () => void }) {
  const t = s.task;
  const today = toDateKey(Date.now());
  const act = (fn: () => void) => () => { fn(); onDone(); };
  if (mode === 'split') {
    return (
      <div class="dface back">
        <p class="meta">Skipped a few times this week</p>
        <h3 class="back-title" style={{ fontSize: 'var(--fs-title)', fontWeight: 400, marginTop: 8 }}>Too big? A task you keep skipping usually isn't a clear next step yet.</h3>
        <div class="back-actions" style={{ marginTop: 'auto' }}>
          <button type="button" class="primary wide press" onClick={onSplit}><IconSplit /> Split it into steps</button>
          <button type="button" class="press" onClick={act(() => showToast('Moved to Someday', S.moveTask(t.id, 'someday', 'Someday')))}><IconArchive /> Someday</button>
          <button type="button" class="press" onClick={onKeep}><IconX /> Keep for later</button>
        </div>
      </div>
    );
  }
  return (
    <div class="dface back">
      <p class="meta">{t.title}</p>
      <div class="back-actions" style={{ marginTop: 'auto' }}>
        <button type="button" class="primary wide press" onClick={act(() => { S.startTimer(t.id); focus.value = { kind: 'task', id: t.id }; })}>
          <IconPlay /> Start focus timer
        </button>
        <button type="button" class="press" onClick={act(() => showToast('Moved to tomorrow', undoable(t.id, { deferUntil: addDays(today, 1) }, 'Tomorrow')))}>
          <IconCalendar /> Tomorrow
        </button>
        <button type="button" class="press" onClick={act(() => showToast('Moved to next week', undoable(t.id, { deferUntil: addDays(today, 7) }, 'Next week')))}>
          <IconCalendar /> Next week
        </button>
        <button type="button" class="press" onClick={act(() => showToast('Moved to Someday', S.moveTask(t.id, 'someday', 'Someday')))}>
          <IconArchive /> Someday
        </button>
        <button type="button" class="press" onClick={onSplit}><IconSplit /> Split</button>
        <button type="button" class="wide press" onClick={act(() => (editTaskId.value = t.id))}><IconEdit /> Edit details</button>
      </div>
    </div>
  );
}

function undoable(id: string, patch: Partial<import('../core/types').Task>, label: string) {
  const before = S.getTask(id);
  S.updateTask(id, patch);
  return before ? { label, run: () => S.updateTask(id, { deferUntil: before.deferUntil, status: before.status }) } : undefined;
}

function SplitSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [text, setText] = useState('');
  const t = id ? S.getTask(id) : undefined;
  useEffect(() => setText(''), [id]);
  return (
    <Sheet open={!!id} onClose={onClose} label="Split task">
      <div class="sheet-head"><h2>Split into steps</h2></div>
      {t && <p class="meta" style={{ marginTop: -8 }}>{t.title}</p>}
      <div class="field">
        <label for="split">One small, concrete step per line</label>
        <textarea id="split" class="input" value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          placeholder={'Find last year\'s numbers\nEmail Sam for the template\nDraft first paragraph'} />
      </div>
      <button type="button" class="btn btn-primary btn-block press" disabled={!text.trim()} onClick={() => {
        if (!id) return;
        const parts = text.split('\n').map((s) => s.trim()).filter(Boolean);
        S.splitTask(id, parts);
        showToast(`Split into ${parts.length} steps`);
        onClose();
      }}>Split</button>
    </Sheet>
  );
}
