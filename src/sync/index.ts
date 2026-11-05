// Dropbox sync controller: connection state, sign-in, and automatic syncing
// (after changes, when the app opens or comes back, and when back online).

import { effect, signal } from '@preact/signals';
import * as S from '../data/store';
import { getDevice, setDevice } from '../data/db';
import { AuthError, DropboxStore, authorizeUrl, exchangeCode, randomString, type Tokens } from './dropbox';
import { syncOnce } from './engine';
import { DROPBOX_APP_KEY, redirectUri } from './config';
import { orphanCode } from '../ui/nav';

export type SyncStatus = 'off' | 'connecting' | 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncState {
  status: SyncStatus;
  account?: string;
  lastSyncAt?: number;
  error?: string;
  /** Sign-in started on this device and waits for a pasted code. */
  awaitingCode?: boolean;
}

interface Saved {
  tokens: Tokens;
  account?: string;
  lastSyncAt?: number;
}

const KEY = 'dropbox';
const PENDING = 'tf-dropbox-pending';
const DEBOUNCE_MS = 3000;
const RESYNC_ON_OPEN_MS = 30_000;

export const sync = signal<SyncState>({ status: 'off' });

export const isConfigured = () => !!DROPBOX_APP_KEY;

let saved: Saved | null = null;
let client: DropboxStore | null = null;
let running = false;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let started = false;

const local = { snapshot: S.snapshot, applyRemote: S.applyRemote, differsFrom: S.differsFrom };

function setState(patch: Partial<SyncState>): void {
  sync.value = { ...sync.value, ...patch };
}

async function persist(): Promise<void> {
  await setDevice(KEY, saved);
}

function makeClient(s: Saved): DropboxStore {
  return new DropboxStore(DROPBOX_APP_KEY, s.tokens, (t) => {
    if (saved) {
      saved.tokens = t;
      void persist();
    }
  });
}

/** Call once after the store is ready. Safe to call again. */
export async function startSync(): Promise<void> {
  if (started) return;
  started = true;
  saved = (await getDevice<Saved>(KEY)) ?? null;
  if (readPending()) setState({ awaitingCode: true });
  await handleRedirect();
  if (saved) {
    client = makeClient(saved);
    setState({ status: 'idle', account: saved.account, lastSyncAt: saved.lastSyncAt });
    void syncNow();
  }

  // After local changes, sync a moment later.
  let first = true;
  effect(() => {
    void S.localChanges.value;
    if (first) { first = false; return; }
    if (!client) return;
    clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), DEBOUNCE_MS);
  });
  document.addEventListener('visibilitychange', () => {
    if (!client) return;
    if (document.hidden) {
      // Leaving the app: send anything waiting right away.
      if (timer) { clearTimeout(timer); timer = undefined; void syncNow(); }
    } else if (Date.now() - (sync.value.lastSyncAt ?? 0) > RESYNC_ON_OPEN_MS) {
      void syncNow();
    }
  });
  addEventListener('online', () => client && void syncNow());
  addEventListener('offline', () => client && setState({ status: 'offline' }));
}

export async function syncNow(): Promise<void> {
  if (!client) return;
  if (running) { again = true; return; }
  if (!navigator.onLine) { setState({ status: 'offline' }); return; }
  running = true;
  timer = undefined;
  setState({ status: 'syncing', error: undefined });
  try {
    await syncOnce(client, local);
    const at = Date.now();
    if (saved) { saved.lastSyncAt = at; void persist(); }
    setState({ status: 'idle', lastSyncAt: at });
  } catch (e) {
    const msg = e instanceof TypeError ? "Couldn't reach Dropbox. It will try again." : (e as Error).message;
    setState({ status: navigator.onLine ? 'error' : 'offline', error: msg });
    if (e instanceof AuthError) await forget();
  } finally {
    running = false;
    if (again) { again = false; void syncNow(); }
  }
}

// ---------- Sign-in ----------
interface Pending { verifier: string; state: string }

function readPending(): Pending | null {
  try {
    const p = localStorage.getItem(PENDING);
    return p ? (JSON.parse(p) as Pending) : null;
  } catch {
    return null;
  }
}

function clearPending(): void {
  try { localStorage.removeItem(PENDING); } catch { /* ignore */ }
  setState({ awaitingCode: false });
}

/** Start sign-in: go to Dropbox, which sends us back with a code. */
export async function connect(): Promise<void> {
  if (!DROPBOX_APP_KEY) throw new Error('Dropbox is not set up in this build yet.');
  const pending: Pending = { verifier: randomString(64), state: randomString(16) };
  try { localStorage.setItem(PENDING, JSON.stringify(pending)); } catch { /* ignore */ }
  setState({ status: 'connecting', awaitingCode: true, error: undefined });
  location.href = await authorizeUrl(DROPBOX_APP_KEY, redirectUri(), pending.verifier, pending.state);
}

/** Finish sign-in with a code (from the redirect, or pasted by hand). */
export async function finishWithCode(code: string): Promise<void> {
  const pending = readPending();
  if (!pending) throw new Error('Start connecting from this app first, then paste the code.');
  setState({ status: 'connecting', error: undefined });
  try {
    const tokens = await exchangeCode(DROPBOX_APP_KEY, code.trim(), pending.verifier, redirectUri());
    saved = { tokens };
    client = makeClient(saved);
    saved.account = await client.accountName().catch(() => undefined);
    await persist();
    clearPending();
    setState({ status: 'idle', account: saved.account });
    await syncNow();
  } catch (e) {
    setState({ status: 'error', error: (e as Error).message });
    throw e;
  }
}

/** Handle ?code=&state= when Dropbox sends the browser back here. */
async function handleRedirect(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const state = params.get('state');
  const denied = params.get('error');
  if (!code && !denied) return;
  history.replaceState(null, '', location.pathname + location.hash);
  if (denied) { clearPending(); setState({ status: saved ? 'idle' : 'off' }); return; }
  const pending = readPending();
  if (!pending || pending.state !== state) {
    // Sign-in started in the Home Screen app but came back in a browser tab
    // that can't see it. Show the code so it can be pasted there.
    orphanCode.value = code;
    return;
  }
  await finishWithCode(code!).catch(() => undefined);
}

async function forget(): Promise<void> {
  saved = null;
  client = null;
  clearTimeout(timer);
  await setDevice(KEY, null);
}

/** Stop syncing. Data stays on this device and in Dropbox. */
export async function disconnect(): Promise<void> {
  const c = client;
  await forget();
  clearPending();
  setState({ status: 'off', account: undefined, lastSyncAt: undefined, error: undefined });
  await c?.revoke();
}

export function cancelConnect(): void {
  clearPending();
  setState({ status: saved ? 'idle' : 'off', error: undefined });
}

/** Is a Dropbox connection or a returning sign-in present? Cheap check for startup. */
export async function shouldStart(): Promise<boolean> {
  return !!(await getDevice(KEY)) || new URLSearchParams(location.search).has('code') || !!readPending();
}
