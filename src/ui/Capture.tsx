// Capture: one field, Enter saves, the sheet stays open for the next one.
// Always mounted so the keyboard can open in the same tap (iOS requires it).

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { parseCapture } from '../core/parse';
import { ruleEstimate } from '../core/estimate';
import { formatMinutes } from '../core/dates';
import { ENERGY_LABEL } from '../core/energy';
import * as S from '../data/store';
import { captureOpen, haptic } from './nav';
import { EnergyBars } from './bits';

export const captureInput: { el: HTMLInputElement | null } = { el: null };

/** Call from a click handler so iOS opens the keyboard. */
export function openCapture(): void {
  captureOpen.value = true;
  captureInput.el?.focus({ preventScroll: true });
}

export function CaptureSheet() {
  const open = captureOpen.value;
  const [text, setText] = useState('');
  const [log, setLog] = useState<{ id: string; title: string; where: string }[]>([]);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    captureInput.el = ref.current;
  }, []);
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => ref.current?.focus({ preventScroll: true }));
    } else {
      ref.current?.blur();
      setLog([]);
      setText('');
    }
  }, [open]);

  const parsed = useMemo(() => (text.trim() ? parseCapture(text) : null), [text]);
  const guess = useMemo(() => (parsed ? ruleEstimate(parsed.title) : null), [parsed?.title]);

  const close = () => (captureOpen.value = false);
  const save = () => {
    const t = S.createTask(text);
    if (!t) return;
    haptic(8);
    const where = t.status === 'waiting' ? 'Waiting' : t.deferUntil ? 'Later' : 'Inbox';
    setLog((l) => [{ id: t.id, title: t.title, where }, ...l].slice(0, 5));
    setText('');
    bumpBadge();
  };

  return (
    <>
      <div class={`sheet-backdrop${open ? ' open' : ''}`} onClick={close} />
      <div class={`sheet${open ? ' open' : ' closing'}`} role="dialog" aria-modal="true" aria-label="Add a task" aria-hidden={!open}>
        <div class="grabber" />
        <form onSubmit={(e) => { e.preventDefault(); save(); }}>
          <input
            ref={ref}
            class="input input-big"
            type="text"
            enterKeyHint="done"
            autoComplete="off"
            autoCorrect="on"
            placeholder="What's on your mind?"
            aria-label="New task"
            value={text}
            tabIndex={open ? 0 : -1}
            onInput={(e) => setText((e.target as HTMLInputElement).value)}
          />
        </form>
        <div class="capture-hint chips" aria-live="polite">
          {parsed?.tokens.map((t) => (
            <span key={t.kind + t.label} class="chip on chip-pop">{t.label}</span>
          ))}
          {parsed && guess && !parsed.energy && (
            <span class="chip soft chip-pop" key={'g' + guess.energy}>
              <EnergyBars level={guess.energy} /> {ENERGY_LABEL[guess.energy]} · ~{formatMinutes(parsed.estimateMin ?? guess.estimateMin)}
            </span>
          )}
          {!parsed && <span class="meta">Tip: <b>!low</b> <b>~10m</b> <b>@home</b> <b>#project</b> <b>tomorrow</b> <b>every mon</b></span>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button type="button" class="btn btn-quiet press" style={{ flex: 1 }} onClick={close}>Close</button>
          <button type="button" class="btn btn-primary press" style={{ flex: 2 }} disabled={!text.trim()} onClick={save}>Add task</button>
        </div>
        {!!log.length && (
          <div class="capture-log" aria-live="polite">
            {log.map((l) => (
              <div class="row" key={l.id}>
                <span class="check on"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
                <span class="row-main"><span class="row-title">{l.title}</span></span>
                <span class="meta">{l.where}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function bumpBadge(): void {
  const b = document.querySelector('.tab .badge');
  if (!b) return;
  b.classList.remove('bump');
  void (b as HTMLElement).offsetWidth;
  b.classList.add('bump');
}
