// Pointer-driven swipe for cards and rows. Tracks the finger 1:1 using
// transforms only, decides commit by distance or flick speed, and springs back
// otherwise. The caller animates the leaving element (see Ghost in NowDeck).

import { useEffect, useRef } from 'preact/hooks';
import type { RefObject } from 'preact';

export type Dir = 'left' | 'right';

export interface Release {
  dir: Dir;
  dx: number;
  dy: number;
  rot: number;
  /** px per ms, signed. */
  velocity: number;
  width: number;
}

export interface SwipeOptions {
  enabled?: boolean;
  /** 'card' tilts and lifts; 'row' slides horizontally only. */
  mode?: 'card' | 'row';
  /** Fraction of the container width needed to commit. */
  threshold?: number;
  maxRotate?: number;
  /** Which directions may commit. */
  dirs?: Dir[];
  onProgress?: (p: number) => void;
  onRelease?: (r: Release) => void;
  onCancel?: () => void;
  onTap?: (e: PointerEvent) => void;
  onLongPress?: () => void;
}

const FLICK = 0.5; // px/ms

export function useSwipe(ref: RefObject<HTMLElement>, opts: SwipeOptions): void {
  const o = useRef(opts);
  o.current = opts;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let id: number | null = null;
    let sx = 0, sy = 0, dx = 0, dy = 0, t0 = 0;
    let dragging = false;
    let width = 1;
    let samples: { x: number; t: number }[] = [];
    let raf = 0;
    let longTimer: ReturnType<typeof setTimeout> | undefined;
    let longFired = false;

    const apply = () => {
      raf = 0;
      const { mode = 'card', maxRotate = 8 } = o.current;
      if (mode === 'card') {
        const rot = (dx / width) * maxRotate;
        el.style.transform = `translate3d(${dx}px, ${dy * 0.15}px, 0) rotate(${rot}deg)`;
      } else {
        const allowed = o.current.dirs ?? ['left', 'right'];
        const d = dx > 0 ? 'right' : 'left';
        const x = allowed.includes(d) ? dx : dx * 0.15;
        el.style.transform = `translate3d(${x}px, 0, 0)`;
      }
      const thr = (o.current.threshold ?? 0.35) * width;
      o.current.onProgress?.(Math.max(-1, Math.min(1, dx / thr)));
    };

    const down = (e: PointerEvent) => {
      if (o.current.enabled === false || id !== null) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if ((e.target as HTMLElement).closest('[data-noswipe]')) return;
      id = e.pointerId;
      sx = e.clientX; sy = e.clientY; dx = 0; dy = 0; t0 = performance.now();
      dragging = false;
      longFired = false;
      width = (el.parentElement ?? el).getBoundingClientRect().width || 1;
      samples = [{ x: e.clientX, t: t0 }];
      el.style.transition = 'none';
      clearTimeout(longTimer);
      if (o.current.onLongPress)
        longTimer = setTimeout(() => {
          if (!dragging && id !== null) {
            longFired = true;
            o.current.onLongPress?.();
          }
        }, 450);
    };

    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      dx = e.clientX - sx;
      dy = e.clientY - sy;
      if (!dragging) {
        if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          dragging = true;
          clearTimeout(longTimer);
          try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        } else if (Math.abs(dy) > 10) {
          // Vertical scroll wins.
          clearTimeout(longTimer);
          id = null;
          return;
        } else return;
      }
      e.preventDefault();
      samples.push({ x: e.clientX, t: performance.now() });
      if (samples.length > 6) samples.shift();
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const springBack = () => {
      el.style.transition = 'transform 280ms var(--spring)';
      el.style.transform = '';
      o.current.onProgress?.(0);
      o.current.onCancel?.();
    };

    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      clearTimeout(longTimer);
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (!dragging) {
        el.style.transition = '';
        if (!longFired && e.type === 'pointerup' && performance.now() - t0 < 400) o.current.onTap?.(e);
        return;
      }
      const first = samples[0];
      const last = samples[samples.length - 1];
      const velocity = (last.x - first.x) / Math.max(1, last.t - first.t);
      const thr = (o.current.threshold ?? 0.35) * width;
      const dir: Dir = dx > 0 ? 'right' : 'left';
      const allowed = o.current.dirs ?? ['left', 'right'];
      const far = Math.abs(dx) > thr;
      const flick = Math.abs(velocity) > FLICK && Math.sign(velocity) === Math.sign(dx);
      if ((far || flick) && allowed.includes(dir) && e.type === 'pointerup') {
        const { mode = 'card', maxRotate = 8 } = o.current;
        o.current.onRelease?.({ dir, dx, dy: mode === 'card' ? dy * 0.15 : 0, rot: mode === 'card' ? (dx / width) * maxRotate : 0, velocity, width });
      } else springBack();
    };

    // Suppress the click that follows a drag.
    const click = (e: MouseEvent) => {
      if (dragging) { e.stopPropagation(); e.preventDefault(); dragging = false; }
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move, { passive: false });
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('click', click, true);
    return () => {
      clearTimeout(longTimer);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('click', click, true);
    };
  }, [ref.current]);
}

/** Animate an element off-screen from where the finger left it. */
export function flyOff(el: HTMLElement, from: { dx: number; dy: number; rot: number }, dir: Dir, velocity: number, width: number): Promise<void> {
  const sign = dir === 'right' ? 1 : -1;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reduce ? 100 : Math.max(150, Math.min(280, 280 - Math.abs(velocity) * 60));
  const start = `translate3d(${from.dx}px, ${from.dy}px, 0) rotate(${from.rot}deg)`;
  const end = reduce ? start : `translate3d(${sign * width * 1.4}px, ${from.dy + 40}px, 0) rotate(${sign * 18}deg)`;
  const anim = el.animate(
    [{ transform: start, opacity: 1 }, { transform: end, opacity: reduce ? 0 : 0.6 }],
    { duration, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)', fill: 'forwards' },
  );
  return anim.finished.then(() => undefined, () => undefined);
}
