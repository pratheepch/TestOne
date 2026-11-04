// Development-only page (?design) showing tokens and components.
import { useState } from 'preact/hooks';
import type { Energy } from '../core/types';
import { EnergyBars, Ring, Segmented, Stepper, Toggle } from '../ui/bits';
import { go } from '../ui/nav';
import { IconBack } from '../ui/icons';

const COLORS = ['--bg', '--surface-1', '--surface-2', '--surface-3', '--text-1', '--text-2', '--text-3', '--accent', '--accent-dim', '--on-accent'];

export function DesignScreen() {
  const [e, setE] = useState<Energy>('med');
  const [on, setOn] = useState(true);
  const [n, setN] = useState(21);
  return (
    <main class="screen">
      <div class="screen-head">
        <button type="button" class="icon-btn press" aria-label="Back" onClick={() => go('now')}><IconBack /></button>
        <h1 class="screen-title">Design</h1>
      </div>
      <h2 class="section-label">Colour</h2>
      <div class="swatches">
        {COLORS.map((c) => <div class="swatch" key={c}><div style={{ background: `var(${c})` }} /><span>{c}</span></div>)}
      </div>
      <h2 class="section-label">Type</h2>
      <div style={{ fontSize: 'var(--fs-display)', fontWeight: 600 }}>Display 34</div>
      <div style={{ fontSize: 'var(--fs-title)' }}>Title 22 regular</div>
      <div style={{ fontSize: 'var(--fs-body)' }}>Body 17</div>
      <div class="meta">Meta 13</div>
      <div class="section-label" style={{ margin: 0 }}>Label 11</div>
      <h2 class="section-label">Controls</h2>
      <div style={{ display: 'grid', gap: 12 }}>
        <Segmented<Energy> label="Energy" value={e} onChange={setE} options={[{ value: 'low', label: 'Low' }, { value: 'med', label: 'Medium' }, { value: 'high', label: 'High' }]} />
        <div class="chips">
          <span class="chip on"><EnergyBars level={e} /> {e}</span><span class="chip">~15m</span><span class="chip soft">@home</span>
        </div>
        <div class="inline"><Toggle label="Demo" checked={on} onChange={setOn} /><Stepper value={n} min={7} max={60} onChange={setN} /><Ring value={0.7} size={48} stroke={5} /></div>
        <div style={{ display: 'flex', gap: 8 }}><button class="btn btn-primary press">Primary</button><button class="btn btn-quiet press">Quiet</button><button class="btn btn-ghost press">Ghost</button></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span class="zone steady">Steady</span><span class="zone easing">Easing off</span><span class="zone stretching">Stretching</span>
        </div>
      </div>
    </main>
  );
}
