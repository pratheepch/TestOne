import { useEffect, useState } from 'preact/hooks';
import type { Energy } from '../core/types';
import { curveFor, ENERGY_RANK, type Chronotype } from '../core/energy';
import { WEEKDAY_NAMES } from '../core/dates';
import * as S from '../data/store';
import { go, showToast } from '../ui/nav';
import { Segmented, Stepper, Toggle } from '../ui/bits';
import { pickFile } from '../ui/share';
import { addReviewToCalendar, exportNow } from './Review';
import { DropboxPanel } from '../ui/DropboxPanel';
import { IconBack, IconCalendar, IconDownload, IconUpload } from '../ui/icons';

const CYCLE: Record<Energy, Energy> = { low: 'med', med: 'high', high: 'low' };

export function SettingsScreen() {
  const s = S.settings.value;
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => { void navigator.storage?.persisted?.().then(setPersisted); }, []);
  const set = S.updateSettings;

  return (
    <main class="screen" aria-label="Settings">
      <div class="screen-head">
        <button type="button" class="icon-btn press" aria-label="Back" onClick={() => go('now')}><IconBack /></button>
        <h1 class="screen-title" style={{ fontSize: 'var(--fs-title)' }}>Settings</h1>
      </div>

      <h2 class="section-label">Your energy through the day</h2>
      <Segmented<Chronotype> label="Sharpest" value={undefined} onChange={(v) => { set({ energyCurve: curveFor(v) }); showToast('Energy curve updated'); }} options={[
        { value: 'morning', label: 'Morning person' }, { value: 'afternoon', label: 'Afternoon' }, { value: 'evening', label: 'Evening' },
      ]} />
      <div class="card" style={{ marginTop: 12 }}>
        <div class="curve" role="group" aria-label="Energy by hour. Tap an hour to change it.">
          {s.energyCurve.map((e, h) => (
            <button type="button" key={h} aria-label={`${h}:00 ${e}`} style={{ height: `${ENERGY_RANK[e] * 33}%`, opacity: e === 'low' ? 0.35 : e === 'med' ? 0.65 : 1 }}
              onClick={() => { const c = s.energyCurve.slice(); c[h] = CYCLE[e]; set({ energyCurve: c }); }} />
          ))}
        </div>
        <div class="curve-hours"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div>
        <p class="meta" style={{ marginBottom: 0 }}>Tap an hour to cycle low → medium → high. The energy pill on Now overrides it for 2 hours.</p>
      </div>

      <h2 class="section-label">Weekly review</h2>
      <div class="set-row">
        <div>Review day</div>
        <select class="input" style={{ width: 'auto', minHeight: 40 }} value={s.reviewDay} onChange={(e) => set({ reviewDay: Number((e.target as HTMLSelectElement).value) })}>
          {WEEKDAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
      </div>
      <div class="set-row">
        <div>Gone quiet after<div class="meta">Untouched tasks show up in the review</div></div>
        <Stepper value={s.quietDays} min={7} max={60} onChange={(v) => set({ quietDays: v })} format={(v) => `${v} d`} />
      </div>
      <button type="button" class="btn btn-quiet btn-block press" onClick={() => void addReviewToCalendar()}><IconCalendar /> Add review reminder to Calendar</button>

      <h2 class="section-label">End of day</h2>
      <div class="set-row">
        <div>"How was your day?" check-in</div>
        <Toggle label="Check-in" checked={s.checkInEnabled} onChange={(v) => set({ checkInEnabled: v })} />
      </div>
      {s.checkInEnabled && (
        <div class="set-row">
          <div>Ask after</div>
          <input type="time" class="input" style={{ width: 'auto', minHeight: 40 }} value={s.checkInTime} onChange={(e) => set({ checkInTime: (e.target as HTMLInputElement).value || '20:00' })} />
        </div>
      )}

      <h2 class="section-label">Pace</h2>
      <div class="set-row">
        <div>Show Pace</div>
        <Toggle label="Pace" checked={s.paceEnabled} onChange={(v) => set({ paceEnabled: v })} />
      </div>
      {s.paceEnabled && (
        <>
          <div class="set-row"><div>Steady from</div><Stepper value={s.steadyLow} min={0.5} max={1} step={0.05} onChange={(v) => set({ steadyLow: v })} format={(v) => v.toFixed(2)} /></div>
          <div class="set-row"><div>Steady up to</div><Stepper value={s.steadyHigh} min={1.1} max={1.6} step={0.05} onChange={(v) => set({ steadyHigh: v })} format={(v) => v.toFixed(2)} /></div>
          <div class="set-row"><div>Overreaching above</div><Stepper value={s.overreach} min={1.3} max={2.5} step={0.05} onChange={(v) => set({ overreach: v })} format={(v) => v.toFixed(2)} /></div>
        </>
      )}

      <h2 class="section-label">Sync</h2>
      <DropboxPanel />

      <h2 class="section-label">Your data</h2>
      <p class="meta">Your data lives on this device{persisted === false ? '. Tip: add TodoFlow to your Home Screen so iOS keeps it safe' : ''}. Export saves a copy you control.</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" class="btn btn-primary press" style={{ flex: 1 }} onClick={() => void exportNow()}><IconDownload /> Export</button>
        <button type="button" class="btn btn-quiet press" style={{ flex: 1 }} onClick={async () => {
          const text = await pickFile('application/json,.json');
          if (!text) return;
          try {
            const { added } = S.importBackup(JSON.parse(text));
            showToast(added ? `Imported ${added} changes` : 'Already up to date');
          } catch (e) {
            showToast((e as Error).message || 'Could not read that file');
          }
        }}><IconUpload /> Import</button>
      </div>
      <p class="meta">Import merges: the newest version of each item wins, nothing is duplicated.</p>
      <button type="button" class="btn btn-danger btn-block press" style={{ marginTop: 16 }} onClick={() => {
        if (confirm('Erase all TodoFlow data on this device? Export a backup first if you might want it back.')) void S.eraseAll();
      }}>Erase all data</button>

      <p class="meta" style={{ textAlign: 'center', marginTop: 32 }}>TodoFlow 0.1 · local-first</p>
    </main>
  );
}
