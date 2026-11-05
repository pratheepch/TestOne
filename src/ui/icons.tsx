// Companion Dark icons: 1.75px rounded line icons on a 24px grid, inheriting currentColor.
import type { JSX } from 'preact';

type P = { size?: number } & JSX.SVGAttributes<SVGSVGElement>;

const base = (size = 20) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  'stroke-width': 1.75, 'stroke-linecap': 'round' as const, 'stroke-linejoin': 'round' as const, 'aria-hidden': true,
});

export const IconCheck = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const IconX = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconPlus = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 5v14M5 12h14" /></svg>;
export const IconClock = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
export const IconInbox = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M4 13l2.5-7h11L20 13v5H4z" /><path d="M4 13h4.5a3.5 3.5 0 007 0H20" /></svg>;
export const IconNow = ({ size, ...p }: P) => <svg {...base(size)} {...p}><rect x="5" y="4" width="14" height="13" rx="3" /><path d="M7 20h10" /></svg>;
export const IconList = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></svg>;
export const IconGear = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>;
export const IconRepeat = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M17 3l3 3-3 3" /><path d="M4 12V9a3 3 0 013-3h13" /><path d="M7 21l-3-3 3-3" /><path d="M20 12v3a3 3 0 01-3 3H4" /></svg>;
export const IconBack = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M15 5l-7 7 7 7" /></svg>;
export const IconCalendar = ({ size, ...p }: P) => <svg {...base(size)} {...p}><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>;
export const IconDownload = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>;
export const IconUpload = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 20V9M7 14l5-5 5 5M5 4h14" /></svg>;
export const IconPlay = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M8 5.5v13l10-6.5z" /></svg>;
export const IconSplit = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 20v-7M12 13L6 6M12 13l6-7M6 6v4M6 6h4M18 6v4M18 6h-4" /></svg>;
export const IconMoon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M19 14.5A7.5 7.5 0 019.5 5a7.5 7.5 0 109.5 9.5z" /></svg>;
export const IconEdit = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>;
export const IconTrash = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" /></svg>;
export const IconSpark = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" /></svg>;
export const IconWait = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M7 4h10M7 20h10M8 4c0 5 8 5 8 8s-8 3-8 8M16 4c0 5-8 5-8 8" /></svg>;
export const IconArchive = ({ size, ...p }: P) => <svg {...base(size)} {...p}><rect x="3.5" y="4" width="17" height="4.5" rx="1.5" /><path d="M5 8.5V19a1 1 0 001 1h12a1 1 0 001-1V8.5M10 12.5h4" /></svg>;

/** Mood faces for the end-of-day check-in (line icons, not emoji). 1 = rough … 5 = great. */
const MOUTHS = ['M8.5 16.5c1.6-2 5.4-2 7 0', 'M9 16c1.3-1 4.7-1 6 0', 'M9 15.5h6', 'M9 14.5c1.3 1.2 4.7 1.2 6 0', 'M8 14c1.5 2.6 6.5 2.6 8 0'];
export const IconMood = ({ mood, size = 28 }: { mood: 1 | 2 | 3 | 4 | 5; size?: number }) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    {mood === 1 ? <path d="M8 9.5l2 1-2 1M16 9.5l-2 1 2 1" /> : <><path d="M9 10v.5" /><path d="M15 10v.5" /></>}
    <path d={MOUTHS[mood - 1]} />
  </svg>
);

/** Animated tick used when completing. */
export const Tick = () => (
  <svg class="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
