import type { DeviceState, Energy, EnergyCurve } from './types';

export const ENERGY_RANK: Record<Energy, number> = { low: 1, med: 2, high: 3 };
export const ENERGY_LABEL: Record<Energy, string> = { low: 'Low', med: 'Medium', high: 'High' };
export const OVERRIDE_MS = 2 * 60 * 60 * 1000;

export type Chronotype = 'morning' | 'afternoon' | 'evening';

/** A sensible default day for each answer to "When are you sharpest?". */
export function curveFor(type: Chronotype): EnergyCurve {
  const c: Energy[] = Array(24).fill('low');
  const set = (from: number, to: number, e: Energy) => {
    for (let h = from; h < to; h++) c[h] = e;
  };
  if (type === 'morning') {
    set(7, 9, 'med'); set(9, 12, 'high'); set(12, 13, 'med'); set(13, 15, 'low'); set(15, 18, 'med'); set(18, 20, 'low');
  } else if (type === 'afternoon') {
    set(8, 10, 'med'); set(10, 12, 'med'); set(12, 13, 'low'); set(13, 17, 'high'); set(17, 20, 'med');
  } else {
    set(9, 12, 'low'); set(12, 15, 'med'); set(15, 17, 'med'); set(17, 22, 'high'); set(22, 24, 'med');
  }
  return c;
}

export function partOfDay(hour: number): string {
  if (hour < 5) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

export function currentEnergy(curve: EnergyCurve, device: DeviceState, now: number): { level: Energy; overridden: boolean } {
  const o = device.energyOverride;
  if (o && o.until > now) return { level: o.level, overridden: true };
  return { level: curve[new Date(now).getHours()] ?? 'med', overridden: false };
}

export function intensity(e: Energy): number {
  return ENERGY_RANK[e];
}
