// Values derived from the store, recomputed only when inputs change.
import { computed } from '@preact/signals';
import { breaks, checkins, device, energyNow, liveProjects, liveTasks, now, settings, tasks } from '../data/store';
import { buildDeck, isQuiet } from '../core/rank';
import { computePace } from '../core/pace';
import { DAY_MS, toDateKey } from '../core/dates';

/** After a rough day, mornings start easy: light tasks or a break. */
export const easyMorning = computed(() => {
  const d = new Date(now.value);
  if (d.getHours() >= 12 || energyNow.value.overridden) return false;
  const y = new Date(now.value - DAY_MS);
  const c = checkins.value.find((x) => x.date === toDateKey(y) && !x.deletedAt);
  return !!c && c.mood <= 2;
});

export const deckEnergy = computed(() => (easyMorning.value ? 'low' : energyNow.value.level));

export const deck = computed(() =>
  buildDeck({
    tasks: liveTasks.value,
    projects: liveProjects.value,
    energy: deckEnergy.value,
    timeAvailable: device.value.timeAvailable,
    now: now.value,
  }),
);

export const pace = computed(() =>
  computePace({ tasks: tasks.value, breaks: breaks.value, checkins: checkins.value, settings: settings.value, now: now.value }),
);

export const quietTasks = computed(() => liveTasks.value.filter((t) => isQuiet(t, settings.value.quietDays, now.value)));

export const reviewDue = computed(() => {
  const s = settings.value;
  if (!s.onboarded) return false;
  const last = s.lastReviewAt ?? s.createdAt;
  const today = new Date(now.value);
  if (now.value - last >= 7 * DAY_MS) return true;
  // Due on the chosen day, once.
  return today.getDay() === s.reviewDay && toDateKey(last) !== toDateKey(now.value) && now.value - last > 2 * DAY_MS;
});

export const checkInDue = computed(() => {
  const s = settings.value;
  if (!s.onboarded || !s.checkInEnabled) return false;
  const today = toDateKey(now.value);
  if (device.value.checkInDismissedFor === today) return false;
  if (checkins.value.some((c) => c.date === today && !c.deletedAt)) return false;
  const [h, m] = s.checkInTime.split(':').map(Number);
  const d = new Date(now.value);
  return d.getHours() * 60 + d.getMinutes() >= h * 60 + m;
});

export const hasAnyTasks = computed(() => liveTasks.value.some((t) => t.status !== 'done' && t.status !== 'trash'));
