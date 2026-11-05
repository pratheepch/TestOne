// "Sync with Dropbox": one switch, a status line, and the paste-code fallback.

import { useEffect, useState } from 'preact/hooks';
import { cancelConnect, connect, disconnect, finishWithCode, isConfigured, startSync, sync, syncNow } from '../sync';
import { Toggle } from './bits';
import { showToast } from './nav';

function ago(t?: number): string {
  if (!t) return 'not yet';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(t).toLocaleDateString();
}

export function DropboxPanel({ compact = false }: { compact?: boolean }) {
  const st = sync.value;
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { void startSync(); }, []);

  if (!isConfigured()) {
    return (
      <div class="card meta">
        Dropbox sync is built but not switched on in this version yet. It needs the app's Dropbox key, which comes in the next update.
      </div>
    );
  }

  const connected = st.status !== 'off' && st.status !== 'connecting';
  const status =
    st.status === 'syncing' ? 'Syncing…'
      : st.status === 'offline' ? "Offline. Changes will sync when you're back online."
        : st.status === 'error' ? st.error ?? 'Something went wrong.'
          : `Synced ${ago(st.lastSyncAt)}${st.account ? ` · ${st.account}` : ''}`;

  return (
    <div>
      <div class="set-row">
        <div>
          Sync with Dropbox
          <div class="meta">{connected ? status : 'Keeps everything in Apps/TodoFlow in your Dropbox.'}</div>
        </div>
        <Toggle label="Sync with Dropbox" checked={connected || st.status === 'connecting'} onChange={async (on) => {
          if (on) {
            try { await connect(); } catch (e) { showToast((e as Error).message); }
          } else if (confirm('Stop syncing? Your data stays on this phone and in Dropbox.')) {
            await disconnect();
            showToast('Dropbox sync is off');
          }
        }} />
      </div>

      {connected && (
        <button type="button" class="btn btn-quiet btn-block press" disabled={st.status === 'syncing'} onClick={() => void syncNow()}>
          {st.status === 'error' ? 'Try again' : 'Sync now'}
        </button>
      )}

      {st.awaitingCode && !connected && (
        <form class="card" style={{ marginTop: 8 }} onSubmit={async (e) => {
          e.preventDefault();
          if (!code.trim()) return;
          setBusy(true);
          try {
            await finishWithCode(code);
            showToast('Connected to Dropbox');
            setCode('');
          } catch (err) {
            showToast((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}>
          <p class="meta" style={{ marginTop: 0 }}>
            Finish signing in. If Dropbox showed you a code instead of coming back here, paste it below.
          </p>
          <input class="input" placeholder="Paste the code from Dropbox" value={code} autoComplete="off"
            onInput={(e) => setCode((e.target as HTMLInputElement).value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" class="btn btn-ghost press" onClick={cancelConnect}>Cancel</button>
            <button type="submit" class="btn btn-primary press" style={{ flex: 1 }} disabled={!code.trim() || busy}>Connect Dropbox</button>
          </div>
        </form>
      )}

      {!compact && (
        <p class="meta">
          Turn it on and everything saves to your Dropbox automatically. On another phone, or after reinstalling, turn it on again and your tasks come back. TodoFlow can only see its own folder.
        </p>
      )}
    </div>
  );
}
