import { useState } from 'preact/hooks';
import { ZONE_LABEL, ZONE_MESSAGE, type PacePoint, type DayLoad } from '../core/pace';
import { fromDateKey, toDateKey } from '../core/dates';
import * as S from '../data/store';
import { pace } from '../ui/derived';
import { go } from '../ui/nav';
import { CountUp, Ring, Segmented } from '../ui/bits';
import { IconBack } from '../ui/icons';

const W = 340;
const H = 170;
const PAD = { l: 6, r: 6, t: 10, b: 20 };

export function PaceScreen() {
  const p = pace.value;
  const s = S.settings.value;
  const [range, setRange] = useState<'day' | 'week' | 'month'>('week');
  const ring = p.base > 0 ? p.today.effort / p.base : 0;

  return (
    <main class="screen" aria-label="Pace">
      <div class="screen-head">
        <button type="button" class="icon-btn press" aria-label="Back" onClick={() => go('now')}><IconBack /></button>
        <h1 class="screen-title" style={{ fontSize: 'var(--fs-title)' }}>Pace</h1>
      </div>

      <div style={{ display: 'grid', placeItems: 'center', gap: 12 }}>
        <Ring value={ring} size={176} stroke={14}>
          <div class="ring-big"><CountUp value={p.today.effort} /></div>
          <div class="meta">pts today{p.base > 0 ? ` · usual ${Math.round(p.base)}` : ''}</div>
        </Ring>
        <span class={`zone ${p.zone}`}>{ZONE_LABEL[p.zone]}</span>
        <p class="meta" style={{ textAlign: 'center', maxWidth: 300, margin: 0 }}>{ZONE_MESSAGE[p.zone]}</p>
      </div>

      <div class="stats">
        <div class="stat"><span class="meta">Recent</span><b><CountUp value={p.recent} /></b><span class="meta">7-day avg</span></div>
        <div class="stat"><span class="meta">Base</span><b><CountUp value={p.base} /></b><span class="meta">28-day avg</span></div>
        <div class="stat"><span class="meta">Pace</span><b>{p.ratio === null || p.zone === 'calibrating' ? '–' : p.ratio.toFixed(2)}</b><span class="meta">Recent ÷ Base</span></div>
      </div>

      {p.signals.length > 0 && (
        <section aria-label="Burnout signals">
          <h2 class="section-label">Worth noticing</h2>
          {p.signals.map((sig) => (
            <div class="signal" key={sig.id}><span style={{ color: 'var(--accent)' }}>●</span><span>{sig.message}. Plan a lighter day soon.</span></div>
          ))}
        </section>
      )}

      <h2 class="section-label">Effort</h2>
      <Segmented label="Range" value={range} onChange={setRange} options={[
        { value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' },
      ]} />
      <div class="card" style={{ marginTop: 12, padding: 12 }}>
        {range === 'day' && <DayChart d={p.today} base={p.base} />}
        {range === 'week' && <WeekChart series={p.series.slice(-7)} base={p.base} />}
        {range === 'month' && <MonthChart series={p.series} steadyLow={s.steadyLow} steadyHigh={s.steadyHigh} />}
      </div>

      <div class="stats">
        <div class="stat"><span class="meta">Done today</span><b>{p.today.tasksDone}</b></div>
        <div class="stat"><span class="meta">Breaks today</span><b>{p.today.breaks}</b></div>
        <div class="stat"><span class="meta">Tracked</span><b>{p.daysTracked}</b><span class="meta">days</span></div>
      </div>

      <h2 class="section-label">How Pace works</h2>
      <div class="card meta" style={{ lineHeight: 1.5 }}>
        Each finished task scores <b>minutes × intensity</b> (low 1, medium 2, high 3). <b>Base</b> is your usual day over 4 weeks, <b>Recent</b> is the last week. Steady work keeps Base level, and a day off barely moves it.
        <br /><br />
        It only counts what's in TodoFlow. The thresholds come from athletes' training load; for mental work they're a reasoned guide, not a medical test.
        {p.zone === 'calibrating' && <><br /><br />Zones appear after {s.calibrationDays} days. {Math.max(0, s.calibrationDays - p.daysTracked)} to go.</>}
      </div>
    </main>
  );
}

function scaleY(max: number) {
  const m = Math.max(1, max);
  return (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / m);
}

function DayChart({ d, base }: { d: DayLoad; base: number }) {
  const max = Math.max(...d.byHour, 10);
  const y = scaleY(max);
  const bw = (W - PAD.l - PAD.r) / 24;
  return (
    <figure style={{ margin: 0 }}>
      <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Effort by hour today, ${Math.round(d.effort)} points`}>
        {d.byHour.map((v, h) => v > 0 && (
          <rect class="bar" key={h} x={PAD.l + h * bw + 1} width={bw - 2} y={y(v)} height={H - PAD.b - y(v)} rx="2"
            fill="var(--accent)" opacity={[0.4, 0.4, 0.7, 1][d.byHourEnergy[h]]} style={{ animationDelay: `${h * 15}ms` }} />
        ))}
        {[0, 6, 12, 18].map((h) => <text key={h} x={PAD.l + h * bw} y={H - 4}>{h}:00</text>)}
      </svg>
      <figcaption class="legend">Brighter bars = higher-energy work. {base > 0 ? `Today ${Math.round(d.effort)} of a usual ${Math.round(base)} pts.` : ''}</figcaption>
    </figure>
  );
}

function WeekChart({ series, base }: { series: PacePoint[]; base: number }) {
  const max = Math.max(...series.map((p) => p.effort), base * 1.2, 10);
  const y = scaleY(max);
  const bw = (W - PAD.l - PAD.r) / 7;
  const today = toDateKey(Date.now());
  return (
    <figure style={{ margin: 0 }}>
      <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Effort per day this week">
        {series.map((p, i) => (
          <g key={p.date}>
            <rect class="bar" x={PAD.l + i * bw + 6} width={bw - 12} y={y(p.effort)} height={Math.max(0, H - PAD.b - y(p.effort))} rx="4"
              fill="var(--accent)" opacity={p.date === today ? 1 : 0.55} style={{ animationDelay: `${i * 40}ms` }} />
            <text x={PAD.l + i * bw + bw / 2} y={H - 4} text-anchor="middle">{fromDateKey(p.date).toLocaleDateString(undefined, { weekday: 'narrow' })}</text>
          </g>
        ))}
        {base > 0 && <line x1={PAD.l} x2={W - PAD.r} y1={y(base)} y2={y(base)} stroke="var(--text-2)" stroke-dasharray="4 4" />}
      </svg>
      <figcaption class="legend"><span><i style={{ background: 'var(--accent)' }} />Effort</span><span><i style={{ background: 'var(--text-2)' }} />Your Base</span></figcaption>
    </figure>
  );
}

function MonthChart({ series, steadyLow, steadyHigh }: { series: PacePoint[]; steadyLow: number; steadyHigh: number }) {
  const max = Math.max(...series.map((p) => Math.max(p.effort, p.recent, p.base * steadyHigh)), 10);
  const y = scaleY(max);
  const step = (W - PAD.l - PAD.r) / series.length;
  const x = (i: number) => PAD.l + i * step + step / 2;
  const line = (k: 'recent' | 'base') => series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join('');
  const band = series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.base * steadyHigh).toFixed(1)}`).join('') +
    series.slice().reverse().map((p, j) => `L${x(series.length - 1 - j).toFixed(1)},${y(p.base * steadyLow).toFixed(1)}`).join('') + 'Z';
  return (
    <figure style={{ margin: 0 }}>
      <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Effort, Recent and Base over 30 days">
        <path d={band} fill="var(--accent)" opacity="0.08" />
        {series.map((p, i) => (
          <rect class="bar" key={p.date} x={x(i) - step / 2 + 1} width={step - 2} y={y(p.effort)} height={Math.max(0, H - PAD.b - y(p.effort))} rx="1.5"
            fill="var(--text-3)" style={{ animationDelay: `${i * 10}ms` }} />
        ))}
        <path d={line('base')} fill="none" stroke="var(--text-2)" stroke-width="1.5" stroke-dasharray="4 4" />
        <path d={line('recent')} fill="none" stroke="var(--accent)" stroke-width="2" />
        <text x={PAD.l} y={H - 4}>{shortLabel(series[0].date)}</text>
        <text x={W - PAD.r} y={H - 4} text-anchor="end">Today</text>
      </svg>
      <figcaption class="legend">
        <span><i style={{ background: 'var(--accent)' }} />Recent</span>
        <span><i style={{ background: 'var(--text-2)' }} />Base</span>
        <span><i style={{ background: 'rgba(255,243,54,.25)', height: 8 }} />Steady zone</span>
      </figcaption>
    </figure>
  );
}

function shortLabel(k: string) {
  return fromDateKey(k).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

