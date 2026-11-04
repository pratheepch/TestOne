import { useEffect, useState } from 'preact/hooks';
import type { Energy } from '../core/types';
import { ENERGY_LABEL, partOfDay } from '../core/energy';
import { ZONE_LABEL } from '../core/pace';
import * as S from '../data/store';
import { checkInDue, easyMorning, pace, quietTasks, reviewDue } from '../ui/derived';
import { checkInOpen, go, haptic } from '../ui/nav';
import { EnergyBars, Ring, Segmented } from '../ui/bits';
import { NowDeck } from '../ui/NowDeck';
import { IconGear } from '../ui/icons';

const TIMES = [
  { value: 10, label: '10m' },
  { value: 30, label: '30m' },
  { value: 600, label: '1h+' },
];

export function NowScreen() {
  const [energyOpen, setEnergyOpen] = useState(false);
  const e = S.energyNow.value;
  const hour = new Date(S.now.value).getHours();
  const p = pace.value;
  const time = S.device.value.timeAvailable;

  useEffect(() => {
    if (checkInDue.value) {
      const t = setTimeout(() => (checkInOpen.value = true), 600);
      return () => clearTimeout(t);
    }
  }, [checkInDue.value]);

  const ringValue = p.base > 0 ? p.today.effort / p.base : Math.min(1, p.today.effort / 120);

  return (
    <main class="screen" aria-label="Now">
      <div class="now-top">
        <button type="button" class="energy-pill press" aria-expanded={energyOpen} aria-label={`Energy: ${ENERGY_LABEL[e.level]}. Change`} onClick={() => setEnergyOpen((o) => !o)}>
          <EnergyBars level={e.level} />
          <span>{ENERGY_LABEL[e.level]} · {partOfDay(hour)}</span>
          {!e.overridden && <span class="auto">auto</span>}
        </button>
        <span class="spacer" />
        {S.settings.value.paceEnabled && (
          <button type="button" class="mini-ring press" aria-label={`Pace: ${ZONE_LABEL[p.zone]}. Today ${Math.round(p.today.effort)} points`} onClick={() => go('pace')}>
            <Ring value={ringValue} size={32} stroke={3.5} />
          </button>
        )}
        <button type="button" class="icon-btn press" style={{ width: 40, height: 40 }} aria-label="Settings" onClick={() => go('settings')}>
          <IconGear size={18} />
        </button>
      </div>

      {energyOpen && (
        <div class="energy-pop surface" role="dialog" aria-label="Set energy">
          <p class="meta" style={{ margin: '0 0 8px' }}>How much energy do you have right now? Lasts 2 hours.</p>
          <Segmented<Energy | 'auto'> label="Energy" value={e.overridden ? e.level : 'auto'} onChange={(v) => {
            haptic(6);
            if (v === 'auto') S.setDeviceState({ energyOverride: undefined });
            else S.overrideEnergy(v);
            S.now.value = Date.now();
            setTimeout(() => setEnergyOpen(false), 220);
          }} options={[
            { value: 'auto', label: 'Auto' },
            { value: 'low', label: <><EnergyBars level="low" /> Low</> },
            { value: 'med', label: <><EnergyBars level="med" /> Med</> },
            { value: 'high', label: <><EnergyBars level="high" /> High</> },
          ]} />
        </div>
      )}

      <div class="time-row">
        <span class="meta">I have</span>
        {TIMES.map((t) => (
          <button type="button" key={t.value} class="chip press" aria-pressed={time === t.value}
            onClick={() => S.setTimeAvailable(time === t.value ? undefined : t.value)}>{t.label}</button>
        ))}
      </div>

      {reviewDue.value && (
        <button type="button" class="banner press" onClick={() => go('review')}>
          <span style={{ flex: 1 }}><b>Weekly review</b> · about 2 minutes{quietTasks.value.length ? ` · ${quietTasks.value.length} gone quiet` : ''}</span>
          <span class="meta">Start</span>
        </button>
      )}
      {easyMorning.value && (
        <p class="meta" style={{ margin: '0 0 12px' }}>Easy start after yesterday. Only light things this morning.</p>
      )}

      <NowDeck />
    </main>
  );
}
