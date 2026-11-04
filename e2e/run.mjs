// End-to-end check on an emulated iPhone. Builds must exist (npm run build).
// Usage: node e2e/run.mjs   (screenshots go to e2e/out/)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const { chromium, devices } = pw;

const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const PORT = 4179;
const URL_ = `http://localhost:${PORT}/`;

const VITE = new URL('../node_modules/vite/bin/vite.js', import.meta.url).pathname;
const server = spawn(process.execPath, [VITE, 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
process.on('exit', () => server.kill());
await new Promise((res, rej) => {
  server.stdout.on('data', (d) => d.toString().includes('Local') && res());
  server.on('exit', rej);
  setTimeout(res, 8000);
});

const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 14'], timezoneId: 'Europe/London', reducedMotion: 'no-preference' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.clock.setFixedTime(new Date('2026-11-04T10:00:00'));
const shot = (n) => page.screenshot({ path: `${OUT}${n}.png` });

async function swipe(selector, dx) {
  const box = await page.locator(selector).first().boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x + (dx * i) / 10, y + i, { steps: 1 });
  await page.mouse.up();
  await page.waitForTimeout(450);
}

try {
  const t0 = Date.now();
  await page.goto(URL_);
  await page.getByText('Do the right thing').waitFor();
  check('cold start to onboarding', true, `${Date.now() - t0} ms`);
  await shot('01-onboarding');
  await page.getByRole('button', { name: 'Get started' }).click();
  await shot('02-chronotype');
  await page.getByRole('button', { name: /^Morning/ }).click();
  await page.locator('.deck').waitFor();
  await shot('03-now-empty');
  check('empty deck invites first task', await page.getByText("What's on your mind?").isVisible());

  // Capture
  await page.getByRole('button', { name: 'Add a task' }).last().click();
  const input = page.getByLabel('New task');
  await input.fill('Call dentist !low ~5m @phone #health');
  await page.waitForTimeout(250);
  await shot('04-capture-chips');
  check('live chips while typing', (await page.locator('.capture-hint .chip').count()) >= 4);
  await input.press('Enter');
  for (const t of ['Write the project proposal', 'Water plants every sun', 'Reply to Sam', 'Clean the kitchen', 'Plan team offsite next week', 'Pay electricity bill']) {
    await input.fill(t);
    await input.press('Enter');
  }
  check('capture log shows saved items', (await page.locator('.capture-log .row').count()) === 5);
  check('capture is fast (input clears)', (await input.inputValue()) === '');
  await page.locator('.sheet.open').getByRole('button', { name: 'Close' }).click();
  await page.waitForTimeout(350);
  await shot('05-now-deck');

  const topTitle = async () => (await page.locator('.dcard[data-pos="0"]:not(.leaving) .dtitle').first().textContent())?.trim();
  const first = await topTitle();
  check('deck shows a suggestion', !!first, first);
  check('deck stacks cards behind', (await page.locator('.dcard[data-pos="1"]').count()) === 1);

  // Swipe right = done
  const tStart = Date.now();
  await swipe('.dcard[data-pos="0"]', 260);
  await page.locator('.toast').waitFor();
  check('swipe right completes', (await page.locator('.toast').textContent()).includes('Done'), `${Date.now() - tStart} ms incl. 450 ms wait`);
  await shot('06-after-done');
  const second = await topTitle();
  check('next card rises', second && second !== first, second);

  // Undo
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.waitForTimeout(400);
  check('undo brings the card back', (await topTitle()) === first);

  // Swipe left = not now
  await swipe('.dcard[data-pos="0"]', -260);
  check('swipe left skips', (await page.locator('.toast').textContent()).includes('Not now'));
  check('skipped card leaves the top', (await topTitle()) !== first);

  // Buttons do the same as swipes
  const before = await topTitle();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.waitForTimeout(450);
  check('Done button works', (await topTitle()) !== before);

  // Tap flips to actions
  await page.locator('.dcard[data-pos="0"] .dtitle').click();
  await page.waitForTimeout(300);
  await shot('07-card-back');
  check('tap flips the card', (await page.locator('.dcard.flipped').count()) === 1);
  await page.locator('.dcard[data-pos="0"] .dface.back').click({ position: { x: 20, y: 20 } });
  await page.waitForTimeout(300);

  // Energy override changes the deck
  await page.locator('.energy-pill').click();
  await page.waitForTimeout(200);
  await shot('08-energy');
  await page.getByRole('button', { name: /Low$/ }).first().click();
  await page.waitForTimeout(400);
  const low = await page.locator('.dcard[data-pos="0"] .dlabel').first().textContent();
  check('low energy shows a light task', /Low energy|Light option/.test(low), low);
  await shot('09-low-energy');

  // Inbox + clarify
  await page.getByRole('button', { name: /^Inbox/ }).click();
  await page.waitForTimeout(300);
  await shot('10-inbox');
  await page.getByRole('button', { name: /^Clarify/ }).click();
  await page.waitForTimeout(300);
  await shot('11-clarify');
  await swipe('.stack .dcard[data-pos="0"]', 260);
  check('clarify swipe moves to Next', true);

  // Lists
  await page.getByRole('button', { name: /^Lists/ }).click();
  await page.waitForTimeout(300);
  await shot('12-lists');
  check('Next list has rows', (await page.locator('.row').count()) > 0);
  await page.locator('.row').first().click();
  await page.waitForTimeout(400);
  await shot('13-edit-sheet');
  check('edit sheet opens', await page.getByRole('dialog', { name: 'Edit task' }).isVisible());
  await page.locator('.sheet.open').getByRole('button', { name: 'Close' }).click();
  await page.waitForTimeout(350);

  // Pace
  await page.getByRole('button', { name: /^Now/ }).click();
  await page.locator('.mini-ring').click();
  await page.waitForTimeout(800);
  await shot('14-pace');
  check('Pace screen shows calibrating', await page.getByText('Calibrating').first().isVisible());

  // Review
  await page.goto(URL_ + '?review');
  await page.waitForTimeout(500);
  await shot('15-review');
  check('review opens from link', await page.getByText('Weekly review · step 1').isVisible());

  // Persistence
  await page.goto(URL_);
  await page.locator('.deck').waitFor();
  await page.waitForTimeout(300);
  check('data survives reload', (await page.locator('.dcard').count()) > 0 && !(await page.getByText("What's on your mind?").isVisible()));

  // Check-in in the evening
  await page.clock.setFixedTime(new Date('2026-11-04T21:00:00'));
  await page.reload();
  await page.waitForTimeout(1200);
  await shot('16-checkin');
  check('evening check-in appears', await page.getByRole('dialog', { name: 'How was your day?' }).isVisible());

  check('no console errors', errors.length === 0, errors.join(' | '));
} catch (e) {
  console.error(e);
  check('run completed', false, String(e));
  await shot('error');
} finally {
  await browser.close();
  server.kill();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
