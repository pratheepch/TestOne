import { render } from 'preact';
import '@fontsource-variable/instrument-sans/wght.css';
import './styles/app.css';
import { App } from './app';
import { init } from './data/store';
import { getDevice } from './data/db';
import { initNav } from './ui/nav';

initNav();
render(<App />, document.getElementById('app')!);
void init().then(async () => {
  // Load Dropbox sync only when it's in use (or a sign-in is coming back).
  let pending = false;
  try { pending = !!localStorage.getItem('tf-dropbox-pending'); } catch { /* ignore */ }
  const back = /[?&](code|error)=/.test(location.search);
  if (pending || back || (await getDevice('dropbox'))) {
    const m = await import('./sync');
    await m.startSync();
  }
});

// Ask the browser to keep our data (helps against iOS storage eviction).
void navigator.storage?.persist?.();

if (import.meta.env.PROD) {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}
