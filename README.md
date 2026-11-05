# TodoFlow

A GTD todo list that follows your energy. One task at a time, picked for the energy and time you have right now. No streaks, no guilt, and all data stays on your phone.

- **Now deck:** swipe right for done, left for not now, tap for more actions.
- **Fast capture:** type and press Enter. Time, energy and context are guessed for you. Optional shortcuts: `!low ~10m @home #project w:Sam tomorrow every mon`.
- **Pace:** a training-load style measure of your effort that rewards steady work and warns, gently, about burnout.
- **Weekly review**, **repeating tasks**, **healthy breaks** when nothing fits, and a no-shame **end-of-day check-in**.

Product plan: [`docs/PLAN.md`](docs/PLAN.md) · Design system: [`docs/DESIGN.md`](docs/DESIGN.md) · Sync readiness: [`docs/SYNC.md`](docs/SYNC.md)

## Run it

```bash
npm install
npm run dev        # http://localhost:5173  (add ?design for the component page)
npm test           # unit tests (parser, estimates, ranking, Pace, repeats, store)
npm run build      # production build in dist/
npm run e2e        # end-to-end run on an emulated iPhone (needs a build); screenshots in e2e/out/
node e2e/sync.mjs  # Dropbox sync end-to-end against a mocked Dropbox
```

## Put it on your iPhone

1. Host `dist/` on any static HTTPS host (GitHub Pages, Netlify, Cloudflare Pages…). Paths are relative, so a sub-folder works.
2. Open it in Safari, tap **Share → Add to Home Screen**.
3. It now opens full screen and works offline. Installing to the Home Screen also protects your data from Safari's storage clean-up.

Your data lives in the browser's IndexedDB on that device. Turn on **Settings → Sync with Dropbox** to keep it in your Dropbox automatically and restore it on another phone (setup: [`docs/SYNC.md`](docs/SYNC.md)). **Settings → Export** saves a one-off backup to Files or iCloud Drive.

## Tech

Vite, TypeScript, Preact with signals, `idb`, `vite-plugin-pwa`. Design system: Companion Dark (Instrument Sans, bundled). No backend, no analytics. Initial JavaScript is about 36 KB gzipped.
