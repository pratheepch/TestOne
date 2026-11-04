import { render } from 'preact';
import './styles/app.css';
import { App } from './app';
import { init } from './data/store';
import { initNav } from './ui/nav';

initNav();
render(<App />, document.getElementById('app')!);
void init();

// Ask the browser to keep our data (helps against iOS storage eviction).
void navigator.storage?.persist?.();

if (import.meta.env.PROD) {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}
