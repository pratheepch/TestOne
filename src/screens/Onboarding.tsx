import { useState } from 'preact/hooks';
import { curveFor, type Chronotype } from '../core/energy';
import * as S from '../data/store';
import { EnergyBars } from '../ui/bits';

const LOGO = (
  <span class="logo"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" /></svg>TodoFlow</span>
);

export function Onboarding() {
  const [step, setStep] = useState(0);
  const pick = (c: Chronotype) => {
    S.updateSettings({ energyCurve: curveFor(c), onboarded: true });
    void navigator.storage?.persist?.();
  };
  if (step === 0) {
    return (
      <div class="onb">
        {LOGO}
        <h1>Do the right thing for the energy you have.</h1>
        <p>TodoFlow shows one task at a time, picked for your energy and time. No streaks, no guilt, and everything stays on this phone.</p>
        <div style={{ marginTop: 'auto' }}>
          <button type="button" class="btn btn-primary btn-block press" style={{ minHeight: 56 }} onClick={() => setStep(1)}>Get started</button>
        </div>
      </div>
    );
  }
  return (
    <div class="onb" key="q">
      {LOGO}
      <h1 style={{ fontSize: '2rem' }}>When are you sharpest?</h1>
      <p>This sets your usual energy through the day. You can change it any time.</p>
      <div style={{ marginTop: 'auto' }}>
        <button type="button" class="choice press" onClick={() => pick('morning')}>
          <span style={{ color: 'var(--accent)' }}><EnergyBars level="high" /></span>
          <span>Morning<small>Best before lunch, slower later</small></span>
        </button>
        <button type="button" class="choice press" onClick={() => pick('afternoon')}>
          <span style={{ color: 'var(--accent)' }}><EnergyBars level="med" /></span>
          <span>Afternoon<small>Slow start, strong after lunch</small></span>
        </button>
        <button type="button" class="choice press" onClick={() => pick('evening')}>
          <span style={{ color: 'var(--accent)' }}><EnergyBars level="low" /></span>
          <span>Evening<small>Come alive later in the day</small></span>
        </button>
      </div>
    </div>
  );
}
