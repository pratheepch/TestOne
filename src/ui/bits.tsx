// Small shared components.
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Energy } from '../core/types';
import { ENERGY_RANK } from '../core/energy';
import { toast, hideToast } from './nav';

export function EnergyBars({ level }: { level: Energy }) {
  const n = ENERGY_RANK[level];
  return (
    <span class="ebars" aria-hidden="true">
      <i class={n >= 1 ? 'on' : ''} />
      <i class={n >= 2 ? 'on' : ''} />
      <i class={n >= 3 ? 'on' : ''} />
    </span>
  );
}

export function Segmented<T extends string | number>({
  options, value, onChange, label, scroll,
}: { options: { value: T; label: ComponentChildren }[]; value: T | undefined; onChange: (v: T) => void; label: string; scroll?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('button[aria-pressed="true"]');
    setThumb(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
  }, [value, options.length]);
  return (
    <div class={`seg${scroll ? ' scroll' : ''}`} role="group" aria-label={label} ref={ref}>
      {thumb && <span class="seg-thumb" style={{ left: `${thumb.left}px`, width: `${thumb.width}px` }} />}
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" class="toggle" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />;
}

export function Stepper({ value, onChange, min, max, step = 1, format = String }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step?: number; format?: (v: number) => string;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 100) / 100)));
  return (
    <span class="stepper">
      <button type="button" class="press" aria-label="Less" onClick={() => set(value - step)}>−</button>
      <span style={{ minWidth: '3.5em', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{format(value)}</span>
      <button type="button" class="press" aria-label="More" onClick={() => set(value + step)}>+</button>
    </span>
  );
}

/** Bottom sheet. Stays mounted while closing so it can animate out. */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ComponentChildren; label: string }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    } else if (mounted) {
      setShown(false);
      const t = setTimeout(() => setMounted(false), 260);
      return () => clearTimeout(t);
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open]);
  if (!mounted) return null;
  return (
    <>
      <div class={`sheet-backdrop${shown ? ' open' : ''}`} onClick={onClose} />
      <div class={`sheet${shown ? ' open' : ' closing'}`} role="dialog" aria-modal="true" aria-label={label}>
        <div class="grabber" />
        {children}
      </div>
    </>
  );
}

export function Toast() {
  const t = toast.value;
  if (!t) return null;
  return (
    <div class="toast" key={t.id} role="status" aria-live="polite">
      <span>{t.text}</span>
      {t.undo && (
        <button type="button" onClick={() => { t.undo!.run(); hideToast(); }}>
          Undo
        </button>
      )}
    </div>
  );
}

/** Progress ring: value 0..1 (can exceed 1). */
export function Ring({ value, size = 40, stroke = 4, children }: { value: number; size?: number; stroke?: number; children?: ComponentChildren }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  const v = Math.min(shown, 1);
  return (
    <span class="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" stroke-width={stroke} />
        <circle class="ring-arc" cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" stroke-width={stroke}
          stroke-linecap="round" stroke-dasharray={c} stroke-dashoffset={c * (1 - v)} />
        {shown > 1 && (
          <circle class="ring-arc" cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--on-accent)" stroke-opacity="0.35"
            stroke-width={stroke / 2} stroke-dasharray={c} stroke-dashoffset={c * (1 - Math.min(shown - 1, 1))} />
        )}
      </svg>
      {children && <span class="ring-center">{children}</span>}
    </span>
  );
}

/** Counts a number up when it first appears. */
export function CountUp({ value, format = (v: number) => String(Math.round(v)) }: { value: number; format?: (v: number) => string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setV(value);
    const start = performance.now();
    const from = 0;
    let id = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 600);
      setV(from + (value - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [value]);
  return <>{format(v)}</>;
}
