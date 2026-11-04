// Navigation and overlay state.
import { signal } from '@preact/signals';
import type { Undo } from '../data/store';

export type Route = 'now' | 'inbox' | 'lists' | 'pace' | 'review' | 'settings' | 'design';

export const route = signal<Route>('now');
export const captureOpen = signal(false);
export const editTaskId = signal<string | null>(null);
export const checkInOpen = signal(false);
export const focus = signal<{ kind: 'task'; id: string } | { kind: 'break'; breakKind: string } | null>(null);
export const listTab = signal<'next' | 'waiting' | 'someday' | 'projects' | 'done'>('next');
export const projectFilter = signal<string | null>(null);

export function go(r: Route): void {
  if (route.value === r) return;
  route.value = r;
  try {
    history.pushState({ r }, '', r === 'now' ? location.pathname : `${location.pathname}#${r}`);
  } catch { /* ignore */ }
}

export function initNav(): void {
  const params = new URLSearchParams(location.search);
  if (params.has('capture')) captureOpen.value = true;
  if (params.has('review')) route.value = 'review';
  if (params.has('design') && import.meta.env.DEV) route.value = 'design';
  const h = location.hash.slice(1) as Route;
  if (['inbox', 'lists', 'pace', 'review', 'settings'].includes(h)) route.value = h;
  if (params.size) history.replaceState(null, '', location.pathname + location.hash);
  addEventListener('popstate', (e) => {
    route.value = ((e.state as { r?: Route } | null)?.r ?? 'now');
  });
}

// ---------- Toast with Undo ----------
export interface ToastMsg {
  id: number;
  text: string;
  undo?: Undo;
}
export const toast = signal<ToastMsg | null>(null);
let tid = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(text: string, undo?: Undo, ms = 4000): void {
  clearTimeout(timer);
  toast.value = { id: ++tid, text, undo };
  timer = setTimeout(() => (toast.value = null), ms);
}

export function hideToast(): void {
  clearTimeout(timer);
  toast.value = null;
}

/** Short haptic tick where supported (iOS Safari ignores it; motion carries feedback there). */
export function haptic(ms = 8): void {
  try {
    navigator.vibrate?.(ms);
  } catch { /* ignore */ }
}
