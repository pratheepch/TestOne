# Flow — a GTD todo app that follows your energy

Status: plan, v1 scope. Nothing is built yet.

## Goals

1. **Low friction.** Capturing a task takes one tap and typing. Every other field is optional or set by the app.
2. **Matches your energy.** "What should I do now?" depends on how much energy you have, how much time you have, and where you are.
3. **Stays usable for months.** The app keeps itself tidy so you never open it to a guilt-inducing pile of old tasks.
4. **Local-only.** No account, no server, no tracking. All data stays on the device.

## Decisions so far

| Topic | Decision |
|---|---|
| Platform | PWA installed to the iPhone home screen, works offline |
| Storage | IndexedDB on the device, manual JSON export/import as backup |
| Energy | Inferred from time of day, one tap to override |
| GTD depth | Lean: Inbox, Next, Waiting, Someday, Projects. Contexts optional |
| Capture | Plain text, with optional inline shortcuts |
| Time estimates | The app estimates them automatically, and learns from you |
| Reminders | Through the system Calendar app (.ics), no push server |
| Keeping it tidy | Stale tasks auto-decay, "just one thing" Now view, guided weekly review |
| Visual style | Apple "Liquid Glass": translucent layered material, large type, motion |
| Motivation | **Pace**, a workload metric like a fitness training load, replaces streaks |

## Why todo apps get abandoned, and what we do about each cause

| Cause | Fix |
|---|---|
| Capture is slow, so tasks go elsewhere | Capture bar always visible; Enter saves to Inbox with no required fields |
| The list grows and becomes guilt | Tasks untouched for 21 days (configurable) quietly move to Someday. Nothing is deleted |
| Too many options, so you can't decide | Now view shows **one** suggested task; swipe for the next one |
| The list goes stale | 2-minute weekly review, swipe keep / someday / done / drop |
| Too much upkeep | Energy, time and type are inferred; you only correct them |
| Coming back after a break feels bad | No streaks and no overdue red. The app opens on Now, not on the backlog |

## Screens

Bottom tab bar (glass), three tabs plus a capture button:

1. **Now** (home)
   - Energy pill at the top: `🔋 Medium · evening`. Tap it to choose Low / Medium / High.
   - Optional time chip: "I have 10m / 30m / 1h+".
   - One large glass card with the best matching task. Swipe right = done, swipe left = skip and show the next one, long-press = edit.
   - A small "show list" link expands to the top 5 matches.
2. **Inbox**
   - Unclarified captures. Clarify with a swipe-through card stack: *Next action? → Project? → Waiting on someone? → Someday? → Trash.*
   - The app pre-fills its guesses (energy, time, context). Clarifying one item is usually one tap to confirm.
   - Two-minute rule: tasks estimated at ≤2 min get a "Do it now" button.
3. **Lists**
   - Next, Waiting, Someday, Projects (each project shows its next action), Done (log).
4. **Capture** (floating + button, also opens from the home-screen shortcut `?capture`)
   - One text field, keyboard opens at once. Enter saves; the sheet stays open for the next task.

**Weekly review** opens from a banner on Now when it's due. Steps: empty the Inbox → swipe through Next and Waiting → check each project has a next action → glance at Someday → export a backup (one tap). Target length is 2–5 minutes.

## Capture syntax (all optional)

```
Call dentist !low ~5m @phone #health
```

| Token | Meaning |
|---|---|
| `!low` `!med` `!high` | energy |
| `~5m` `~1h` | time (overrides the estimate) |
| `@phone` `@home` `@errand` | context |
| `#name` | project (created if new) |
| `w:Sam` | waiting on Sam |
| `tomorrow`, `fri`, `next week` | defer: hidden until that day |

Tokens show as chips while you type, so the syntax can be learned by seeing it, with no manual.

## Energy model

- **Default curve.** Set during onboarding with three taps ("When are you sharpest?"), then editable as a 24-hour curve. Example: high 9–12, medium 13–16, low after 20:00.
- **Override.** Tapping the energy pill sets it for the next 2 hours, then it reverts to the curve.
- **Learning (light).** Record the energy level when each task is done. Every week, nudge the curve toward when you actually finish high-energy work. Settings shows this as "Your curve has shifted"; you can accept or ignore it.
- **Matching.** Low energy shows low tasks only. Medium shows low and medium. High shows everything, with high tasks first.

## Automatic time and energy estimates (on-device, no AI service)

Local-only rules out cloud AI, so estimates come in two layers:

1. **Rules.** A keyword table: verbs and nouns map to an estimate and an energy level. For example, "call/text/email/pay" → 5m, low. "write/design/plan/draft" → 1h+, high. "clean/organize" → 30m, medium. Context words such as "phone" or "buy" also suggest `@phone` or `@errand`.
2. **Learning.** When a task is done, record the actual time from first "start" to done (when tracked) or the user's correction. Similar tasks (shared keywords or project) then use that history: a per-keyword running median.

Estimates appear as soft chips (`~5m`, `low`) that can be changed with one tap. A correction teaches the model.

## Prioritising for the Now view

Score each available task (not deferred, not waiting, energy fits):

```
score = energyFit*3 + timeFit*2 + projectMomentum + ageNudge − skipPenalty
```

- `timeFit`: fits the time chip, if one is set
- `projectMomentum`: small boost for projects with recent progress
- `ageNudge`: older Next tasks rise slowly, until the decay limit
- `skipPenalty`: skipped today, so show it later

## Pace: workload instead of streaks

Streaks punish a single missed day, and that is a common moment for people to quit an app. Pace works like a training load in fitness apps: it rewards steady effort over weeks, and warns when you push much harder than you're used to.

### Name

**Pace**. It covers both halves of the idea: keep a steady pace, and don't run faster than you can sustain. It's short enough for a tab label and a widget ("Your Pace: Steady").

Alternatives considered: *Momentum* (only says "keep going", misses the burnout side), *Effort Load* (accurate but clinical), *Ember* (steady glow vs burning out; nice metaphor, less clear), *Rhythm* (good, but vaguer).

### Measuring effort

Each completed task gives **effort points**:

```
effort = minutes × intensity      intensity: low 1 · medium 2 · high 3
```

This mirrors how sports science scores a training session (duration × intensity).

- Minutes and energy come from the task's estimate, so you have nothing extra to enter.
- When you finish a task, a small chip shows the guess (`~30m · high · 90 pts`). Tap to correct it, or ignore it. A correction also improves future estimates.
- **Day effort** is the sum of the day's completed tasks.

### The two numbers

| Number | What it is | How it feels |
|---|---|---|
| **Base** | Average daily effort over the last 28 days | Your fitness: what you can normally sustain. Moves slowly |
| **Recent** | Average daily effort over the last 7 days | Your fatigue: what you've been doing lately. Moves fast |

**Pace = Recent ÷ Base.** This is the acute:chronic workload ratio used in sports science to spot people ramping up too quickly.

| Pace | Zone | Message |
|---|---|---|
| below 0.8 | **Easing off** | "Lighter week than usual." Neutral, never scolding. Rest is allowed |
| 0.8 – 1.3 | **Steady** | "You're in your sustainable range." The goal zone |
| 1.3 – 1.5 | **Stretching** | "Above your usual load. Fine for a sprint, plan some recovery." |
| above 1.5 | **Overreaching** | "Well above your usual load. This is where burnout risk rises." |

Burnout warnings get stronger when signs add up, not from a single busy day:

- Pace is in **Stretching** or **Overreaching** for 10+ days in a row
- **No light day** in the last 14 days. A light day is under 30% of Base
- **Lots of high-energy work:** high-intensity task time above about 4 hours on most days of the week. Research on deliberate practice suggests people sustain only about 4 hours of deeply demanding work per day
- **Long weeks:** estimated task time above about 50 hours a week. Studies of working hours find output per hour drops sharply past about 50, and health risks rise from 55

The message names the signals it saw, for example: "3 weeks above your usual load and no light day in 16 days."

### What "the graph stays up" means

Because Base is a 28-day average, working steadily keeps it level. One day off barely lowers it, and a week off lowers it gently. That rewards consistency without the "you broke your streak" moment.

### Graphs

- **Day:** effort by hour, with bars coloured by energy level (blue, teal, amber). Today's total is compared with your Base.
- **Week:** a bar for each day, with your Base as a horizontal reference line.
- **Month:** daily bars plus two lines, Recent and Base. A shaded band shows the Steady zone (0.8–1.3 × Base), so you can see when you left it.
- **Now screen:** a small glass ring shows today's effort against your Base, with the zone word underneath. Tap it to open the graphs.

### Honest limits

- **Calibrating:** for the first 14 days the app shows only your effort, with no zone, because Base isn't meaningful yet.
- **Only what's in the app:** effort counts only tasks you track. Work that isn't in the app is invisible, and the screen says so.
- **Not a medical measure:** the 0.8–1.3 and 1.5 thresholds come from athletes' training loads. Applying them to mental work is a reasoned analogy, not a validated test. Zones are framed as "risk is rising", never as a burnout percentage or diagnosis.
- **Adjustable:** you can change the thresholds in Settings, or hide Pace entirely.

## Calendar integration (within PWA limits)

A PWA can't read or write the iOS calendar directly. Instead:

- **Weekly review event:** export a recurring `.ics` event once. iOS Calendar sends the reminder, and its link (`https://…/?review`) opens the app on the review.
- **Task → calendar:** the "Schedule" action on a task creates a one-off `.ics` event that opens in Calendar to add. Optional, and meant for time-bound items such as appointments.
- No background sync. The calendar is the reminder system and the app stays the list.

## Data model (IndexedDB via `idb`)

```ts
Task {
  id, title, notes?,
  status: 'inbox'|'next'|'waiting'|'someday'|'done'|'trash',
  energy: 'low'|'med'|'high', energySource: 'auto'|'user',
  estimateMin: number, estimateSource: 'auto'|'user',
  context?: string, projectId?: string, waitingOn?: string,
  deferUntil?: date, createdAt, updatedAt, lastTouchedAt,
  doneAt?, doneEnergy?, actualMin?, skipCount
}
Project { id, name, status: 'active'|'someday'|'done', createdAt }
Settings { energyCurve[24], decayDays: 21, reviewDay, lastReviewAt, lastExportAt }
EstimateStats { keyword, medianMin, count, energyVotes }
// Task also stores effortPts and effortSource: 'auto'|'user' when done
DayLoad { date, effortPts, highIntensityMin, totalMin, tasksDone }  // cached rollup; Recent/Base computed from it
PaceSettings { enabled: true, steadyLow: 0.8, steadyHigh: 1.3, overreach: 1.5, calibrationDays: 14 }
```

Export is a single versioned JSON file shared through `navigator.share` (Save to Files / iCloud Drive). Import merges by `id`, keeping the newer `updatedAt`. Call `navigator.storage.persist()` on first run so iOS is less likely to evict the data.

## Visual design: Liquid Glass

- Layered translucent surfaces: `backdrop-filter: blur(24px) saturate(180%)`, a thin inner highlight border, soft shadows. A slowly drifting colour field behind the glass.
- The background colour follows energy: cool blue for low, teal for medium, warm amber for high, so you can see your current state at a glance.
- SF Pro via the `-apple-system` font stack, large titles, generous touch targets (≥44pt), safe-area insets.
- Spring physics for swipes, a short haptic-style "settle" when a card leaves.
- Light and dark themes; `prefers-reduced-transparency` and `prefers-reduced-motion` fall back to solid surfaces and no motion.

## Tech stack

- Vite + TypeScript + Preact (small, fast on mobile)
- `idb` for IndexedDB, `vite-plugin-pwa` for the service worker and manifest
- No backend, no analytics
- Vitest for the parser, estimator and scoring; Playwright for mobile-viewport flows

## Build milestones

1. **M1 Core loop:** capture, Inbox, Next, Done, IndexedDB, PWA install, glass shell
2. **M2 Energy:** curve onboarding, energy pill, Now card with swipe
3. **M3 Smart capture:** inline syntax parser, rule-based estimator, clarify card stack
4. **M4 GTD:** Projects, Waiting, Someday, defer dates, contexts
5. **M5 Keeping it tidy:** auto-decay, weekly review flow, export/import, `.ics`
6. **M6 Pace:** effort points, Recent/Base/Pace zones, burnout signals, day/week/month graphs, Now ring
7. **M7 Learning:** estimate history, energy curve suggestions, polish and accessibility

## Open questions

1. Decay window: is 21 days right, or should decayed tasks be shown once in the weekly review first?
2. Recurring tasks (e.g. "water plants every Sun"): v1 or later?
3. Should Now be able to suggest a short break or rest at low energy when nothing fits?
4. App name: "Flow" is a placeholder.
5. Pace: should trashed or dropped tasks count as small effort (deciding is work too), or nothing?
6. Pace: add an optional one-tap "How drained do you feel?" check at the end of the day? It would sharpen the burnout signal but adds a little friction.
