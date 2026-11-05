// End-to-end check of Dropbox sync against a fake Dropbox (network is mocked
// in the browser, so no real account is needed).
// Usage: node e2e/sync.mjs  (builds its own copy with a test app key)
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const { chromium, devices } = pw;

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const VITE = `${ROOT}node_modules/vite/bin/vite.js`;
const DIST = 'dist-e2e-sync';
execFileSync(process.execPath, [VITE, 'build', '--outDir', DIST], { cwd: ROOT, env: { ...process.env, VITE_DROPBOX_APP_KEY: 'test-app-key' }, stdio: 'ignore' });

const PORT = 4181;
const APP = `http://localhost:${PORT}/`;
const server = spawn(process.execPath, [VITE, 'preview', '--outDir', DIST, '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'pipe' });
process.on('exit', () => server.kill());
await new Promise((res) => { server.stdout.on('data', (d) => d.toString().includes('Local') && res()); setTimeout(res, 8000); });

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); };

// ---------- Fake Dropbox, shared by both "phones" ----------
const box = { file: null, rev: 0, uploads: 0, tokenCalls: 0 };
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Expose-Headers': 'Dropbox-API-Result' };

async function fakeDropbox(ctx) {
  await ctx.route('https://www.dropbox.com/oauth2/authorize**', (route) => {
    const u = new URL(route.request().url());
    const ok = u.searchParams.get('client_id') === 'test-app-key' && u.searchParams.get('code_challenge_method') === 'S256';
    const back = `${u.searchParams.get('redirect_uri')}?code=${ok ? 'good-code' : 'bad'}&state=${u.searchParams.get('state')}`;
    route.fulfill({ status: 302, headers: { Location: back } });
  });
  await ctx.route('https://api.dropboxapi.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: cors });
    if (req.url().includes('oauth2/token')) {
      box.tokenCalls++;
      const body = new URLSearchParams(req.postData() ?? '');
      const ok = body.get('code') === 'good-code' && (body.get('code_verifier') ?? '').length >= 43;
      return route.fulfill({ status: ok ? 200 : 400, headers: { ...cors, 'Content-Type': 'application/json' },
        body: JSON.stringify(ok ? { access_token: 'AT', refresh_token: 'RT', expires_in: 14400, account_id: 'dbid:1' } : { error_description: 'bad code' }) });
    }
    if (req.url().includes('get_current_account')) return route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: '{"name":{"display_name":"Test Person"}}' });
    return route.fulfill({ status: 200, headers: cors, body: '{}' });
  });
  await ctx.route('https://content.dropboxapi.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: cors });
    const arg = JSON.parse(req.headers()['dropbox-api-arg'] ?? '{}');
    if (req.url().endsWith('/files/download')) {
      if (!box.file) return route.fulfill({ status: 409, headers: cors, body: '{"error_summary":"path/not_found/"}' });
      return route.fulfill({ status: 200, headers: { ...cors, 'Dropbox-API-Result': JSON.stringify({ rev: `r${box.rev}` }) }, body: box.file });
    }
    if (req.url().endsWith('/files/upload')) {
      const want = typeof arg.mode === 'object' ? arg.mode.update : null;
      const have = box.file ? `r${box.rev}` : null;
      if (want !== have) return route.fulfill({ status: 409, headers: cors, body: '{"error_summary":"path/conflict/file/"}' });
      box.file = req.postData();
      box.rev++;
      box.uploads++;
      return route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ rev: `r${box.rev}` }) });
    }
    route.fulfill({ status: 404, headers: cors, body: '' });
  });
}

const browser = await chromium.launch();
const errors = [];
async function phone() {
  const ctx = await browser.newContext({ ...devices['iPhone 14'] });
  await fakeDropbox(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  return { ctx, page };
}
const tasksIn = () => (box.file ? JSON.parse(box.file).data.tasks.filter((t) => !t.deletedAt).map((t) => t.title).sort() : []);

try {
  // ---- Phone A: set up, add tasks, connect ----
  const A = await phone();
  let p = A.page;
  await p.goto(APP);
  await p.getByRole('button', { name: 'Get started' }).click();
  await p.getByRole('button', { name: /^Morning/ }).click();
  await p.getByRole('button', { name: 'Add a task' }).last().click();
  const input = p.getByLabel('New task');
  for (const t of ['Call dentist', 'Write proposal']) { await input.fill(t); await input.press('Enter'); }
  await p.locator('.sheet.open').getByRole('button', { name: 'Close' }).click();
  await p.getByRole('button', { name: 'Settings' }).click();
  await p.getByRole('switch', { name: 'Sync with Dropbox' }).click();
  await p.waitForURL(APP + '**');
  await p.locator('.deck').waitFor();
  for (let i = 0; i < 40 && !box.uploads; i++) await p.waitForTimeout(250);
  await p.getByRole('button', { name: 'Settings' }).click();
  await p.getByText(/Synced .*Test Person/).waitFor({ timeout: 10000 });
  await p.screenshot({ path: `${OUT}sync-01-connected.png` });
  check('connect: sign-in round trip with PKCE', box.tokenCalls === 1);
  check('first sync uploads everything', JSON.stringify(tasksIn()) === JSON.stringify(['Call dentist', 'Write proposal']), tasksIn().join(', '));
  check('sign-in reply is removed from the address bar', !p.url().includes('code='));

  // ---- Auto-upload after a change ----
  await p.goto(APP);
  await p.getByRole('button', { name: 'Add a task' }).last().click();
  await p.getByLabel('New task').fill('Water plants');
  await p.getByLabel('New task').press('Enter');
  await p.waitForTimeout(4500);
  check('changes upload automatically', tasksIn().includes('Water plants'), tasksIn().join(', '));

  // ---- Phone B: fresh install, restore from Dropbox during onboarding ----
  const B = await phone();
  p = B.page;
  await p.goto(APP);
  await p.getByRole('button', { name: 'Restore from Dropbox' }).click();
  await p.screenshot({ path: `${OUT}sync-02-restore.png` });
  await p.getByRole('switch', { name: 'Sync with Dropbox' }).click();
  await p.waitForURL(APP + '**');
  await p.locator('.deck').waitFor({ timeout: 10000 });
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}sync-03-restored.png` });
  check('a new phone skips setup and gets the tasks back', (await p.locator('.dcard').count()) > 0);
  await p.getByRole('button', { name: /^Inbox/ }).click();
  const restored = await p.locator('.row-title').allTextContents();
  check('restored Inbox has all three tasks', ['Call dentist', 'Water plants', 'Write proposal'].every((t) => restored.includes(t)), restored.join(', '));

  // ---- Edit on B, see it on A ----
  await p.getByRole('button', { name: 'Add a task' }).last().click();
  await p.getByLabel('New task').fill('Added on phone B');
  await p.getByLabel('New task').press('Enter');
  await p.waitForTimeout(4500);
  p = A.page;
  await p.goto(APP);
  await p.waitForTimeout(1500);
  await p.getByRole('button', { name: /^Inbox/ }).click();
  check("phone A picks up phone B's task on open", await p.getByText('Added on phone B').isVisible());

  // ---- Sign-in that lands in a different browser ----
  const C = await phone();
  await C.page.goto(`${APP}?code=abc123&state=zzz`);
  await C.page.getByText('Almost connected.').waitFor();
  await C.page.screenshot({ path: `${OUT}sync-04-code.png` });
  check('foreign sign-in shows a code to paste', await C.page.getByText('abc123').isVisible());

  check('no page errors', errors.length === 0, errors.join(' | '));
} catch (e) {
  console.error(e);
  check('run completed', false, String(e).slice(0, 300));
} finally {
  await browser.close();
  server.kill();
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} sync checks passed`);
process.exit(failed ? 1 : 0);
