// Shown when Dropbox sends the sign-in back to a browser tab that didn't start
// it (common for Home Screen apps on iOS). The code has to be pasted there.

import { useState } from 'preact/hooks';
import { orphanCode } from './nav';

export function CodeScreen() {
  const code = orphanCode.value;
  const [copied, setCopied] = useState(false);
  if (!code) return null;
  return (
    <div class="onb">
      <span class="logo">TodoFlow</span>
      <h1>Almost connected.</h1>
      <p>Copy this code, go back to TodoFlow on your Home Screen, and paste it under Settings → Sync with Dropbox.</p>
      <div class="card" style={{ wordBreak: 'break-all', fontSize: 'var(--fs-body)', margin: '16px 0' }}>{code}</div>
      <button type="button" class="btn btn-primary btn-block press" onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}>{copied ? 'Copied' : 'Copy code'}</button>
      <p class="meta" style={{ textAlign: 'center' }}>The code works for a few minutes. You can close this page afterwards.</p>
    </div>
  );
}
