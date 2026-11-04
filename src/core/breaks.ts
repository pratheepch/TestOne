// Healthy break ideas for when nothing fits, or when Pace runs high.

export interface BreakIdea {
  kind: string;
  title: string;
  detail: string;
  minutes: number;
  /** Local hours (inclusive start, exclusive end) when it makes sense. */
  hours?: [number, number];
}

export const BREAKS: BreakIdea[] = [
  { kind: 'walk', title: 'Quick walk', detail: 'Outside if you can. No phone needed.', minutes: 7, hours: [6, 22] },
  { kind: 'breathe', title: 'Box breathing', detail: 'In 4 · hold 4 · out 4 · hold 4. Repeat.', minutes: 2 },
  { kind: 'water', title: 'Drink a glass of water', detail: 'Slowly. That counts as a break.', minutes: 1 },
  { kind: 'stretch', title: 'Stretch', detail: 'Neck, shoulders, back. Gently.', minutes: 3 },
  { kind: 'daylight', title: 'Step into daylight', detail: 'Or open a window and breathe some fresh air.', minutes: 2, hours: [7, 19] },
  { kind: 'eyes', title: 'Rest your eyes', detail: 'Look at something far away for 20 seconds. Blink slowly.', minutes: 1 },
  { kind: 'snack', title: 'Healthy snack', detail: 'Some fruit, nuts or yoghurt.', minutes: 5, hours: [7, 21] },
  { kind: 'tidy', title: 'Tidy one small surface', detail: 'Just one. A desk corner is enough.', minutes: 3, hours: [7, 22] },
  { kind: 'rest', title: 'Eyes-closed rest', detail: 'Lie down or lean back. Set no goals.', minutes: 10 },
];

/** Ideas that fit the hour, least recently used first. */
export function breakIdeas(hour: number, recentKinds: string[]): BreakIdea[] {
  const fits = BREAKS.filter((b) => !b.hours || (hour >= b.hours[0] && hour < b.hours[1]));
  const recent = new Set(recentKinds.slice(0, 3));
  const fresh = fits.filter((b) => !recent.has(b.kind));
  const used = fits.filter((b) => recent.has(b.kind));
  return [...fresh, ...used];
}
