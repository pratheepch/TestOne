# TodoFlow — a GTD todo app that follows your energy

Status: **v0.1 built** (see "What's built" at the end). Cloud sync comes next; the data layer is ready for it ([`SYNC.md`](SYNC.md)).

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
| Keeping it tidy | Stale tasks surface in the weekly review, "just one thing" Now view, guided weekly review |
| Repeats | Simple repeat control: daily, weekdays, weekly, monthly, or chosen days |
| Low energy | Suggest the lowest-energy task, or a short healthy break |
| End of day | Optional "How was your day?" check-in that never shames |
| Visual style | Minimal dark: near-black surfaces, one yellow accent, a micro-animation on every interaction, no perceptible delay |
| Motivation | **Pace**, a workload metric like a fitness training load, replaces streaks |

## Why todo apps get abandoned, and what we do about each cause

| Cause | Fix |
|---|---|
| Capture is slow, so tasks go elsewhere | Capture bar always visible; Enter saves to Inbox with no required fields |
| The list grows and becomes guilt | Tasks untouched for 21 days (configurable) are gathered into a "Gone quiet" step of the weekly review, where you keep, park or drop them in a few swipes. Nothing moves without you |
| Too many options, so you can't decide | Now view shows **one** suggested task; swipe for the next one |
| The list goes stale | 2-minute weekly review, swipe keep / someday / done / drop |
| Too much upkeep | Energy, time and type are inferred; you only correct them |
| Coming back after a break feels bad | No streaks, no overdue red, no "0 tasks done". The app opens on Now, not on the backlog |

## Screens

Bottom tab bar, three tabs plus a capture button:

1. **Now** (home)
   - Energy pill at the top: `🔋 Medium · evening`. Tap it to choose Low / Medium / High.
   - Optional time chip: "I have 10m / 30m / 1h+".
   - **The Now deck:** a stack of suggestion cards. The top card is the best task for your energy and time, filled with the accent; the next two peek out behind it. Swipe right = done, swipe left = not now and bring up the next one, tap = open the card's actions. Full interaction spec in [`DESIGN.md`](DESIGN.md#the-now-deck).
   - Each card says why it was picked, in one line ("Fits low energy · 5 min · keeps *Website* moving").
   - A task skipped three times in a week asks once: "Too big? Split it · Someday · Keep". In GTD terms a task you keep skipping usually isn't a concrete next action yet.
   - A small "show list" link expands to the top 5 matches.
   - **When nothing fits your energy** (see "Low energy and breaks" below): suggest the lowest-energy task available, or a short break.
2. **Inbox**
   - Unclarified captures. Clarify with a swipe-through card stack: *Next action? → Project? → Waiting on someone? → Someday? → Trash.*
   - The app pre-fills its guesses (energy, time, context). Clarifying one item is usually one tap to confirm.
   - Two-minute rule: tasks estimated at ≤2 min get a "Do it now" button.
3. **Lists**
   - Next, Waiting, Someday, Projects (each project shows its next action), Done (log).
4. **Capture** (floating + button, also opens from the home-screen shortcut `?capture`)
   - One text field, keyboard opens at once. Enter saves; the sheet stays open for the next task.

**Weekly review** opens from a banner on Now when it's due. Steps: empty the Inbox → **Gone quiet** (tasks untouched for 21+ days: keep / Someday / drop) → swipe through Next and Waiting → check each project has a next action → glance at Someday → export a backup (one tap). Target length is 2–5 minutes.

If the review is skipped, quiet tasks simply wait for the next one; they are never moved or deleted automatically. If more than 15 tasks have gone quiet, the step offers "Park all in Someday" as one tap.

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
| `every day`, `weekdays`, `every mon`, `every week`, `every month` | repeat |

Tokens show as chips while you type, so the syntax can be learned by seeing it, with no manual.

## Energy model

- **Default curve.** Set during onboarding with three taps ("When are you sharpest?"), then editable as a 24-hour curve. Example: high 9–12, medium 13–16, low after 20:00.
- **Override.** Tapping the energy pill sets it for the next 2 hours, then it reverts to the curve.
- **Learning (light).** Record the energy level when each task is done. Every week, nudge the curve toward when you actually finish high-energy work. Settings shows this as "Your curve has shifted"; you can accept or ignore it.
- **Matching.** Low energy shows low tasks only. Medium shows low and medium. High shows everything, with high tasks first.

## Automatic time and energy estimates (on-device AI, no cloud)

Local-only rules out cloud AI. Estimates come in two layers that run entirely on the phone:

1. **Rules.** A keyword table: verbs and nouns map to an estimate and an energy level. For example, "call/text/email/pay" → 5m, low. "write/design/plan/draft" → 1h+, high. "clean/organize" → 30m, medium. Context words such as "phone" or "buy" also suggest `@phone` or `@errand`.
2. **Small on-device model.** A sentence-embedding model (`all-MiniLM-L6-v2` or similar, ~23 MB compressed) runs in the browser through Transformers.js (WebAssembly). Each task title becomes a vector; the app finds the most similar past tasks (your own completed and corrected tasks, plus ~500 built-in labelled examples) and uses their time, energy and context. It understands meaning ("ring the plumber" ≈ "call dentist") and gets more personal with every task you finish or correct, with no training step. The model downloads once after install, in the background; the rules cover the gap and act as a fallback.

The same vectors can suggest a project for Inbox items and spot duplicates. A generative model (200–400 MB) is not worth its download and memory cost in a web app. If generative features are wanted later, a native iOS app could use Apple's built-in on-device model with no download.

Estimates appear as soft chips (`~5m`, `low`) that can be changed with one tap. A correction teaches the model.

## Repeating tasks

A single **repeat chip** on the task, with five options and nothing else:

| Option | Example |
|---|---|
| Daily | Take vitamins |
| Weekdays | Check timesheet |
| Weekly (pick days) | Water plants: Sun · Gym: Mon, Wed, Fri |
| Monthly (same date) | Pay rent on the 1st |
| Off | — |

- When you complete a repeating task, its next copy is created at once and hidden until its next date. It reappears on Now that day.
- Repeats are counted from the **schedule**, not from when you finished, so a late "water plants" doesn't shift next Sunday.
- **Missed repeats don't pile up.** If you miss several, only one copy is shown, never a backlog of overdue copies.
- Repeating tasks never go "quiet", so they stay out of that weekly review step.
- Each completion counts for Pace like any other task.

## Low energy and breaks

When the current energy level has no matching task, Now does not show an empty screen:

1. **Lowest-energy task first.** If any available task is low energy (even outside the current filters), show it: "Nothing fits your energy perfectly. This one is light: *Reply to Sam* · ~5m".
2. **Otherwise, a break.** If there's no light task, or you skip it, Now offers one break card with a built-in timer:

| Break | Length |
|---|---|
| Quick walk, ideally outside | 5–10 min |
| Box breathing (4 in, 4 hold, 4 out, 4 hold) | 2 min |
| Drink a glass of water | 1 min |
| Stretch neck, shoulders and back | 3 min |
| Step into daylight or open a window | 2 min |
| Look at something far away (20 s) and blink slowly | 1 min |
| Healthy snack | 5 min |
| Tidy one small surface | 3 min |
| Short lie-down or eyes-closed rest | 10 min |

- Swipe left for another idea; swipe right to start it. "Not now" closes it.
- Breaks are picked to fit the time of day (no "step into daylight" at 23:00) and the last few are not repeated.
- A finished break is logged as rest. It earns no effort points, but the Pace screen can show "2 breaks taken today", and breaks count towards having a light day.
- When Pace is **Stretching** or **Overreaching**, the same break card can appear between tasks, at most once every 90 minutes.

## End-of-day check-in

An optional "How was your day?" sheet, shown once, the first time you open the app after your chosen evening time (default 20:00). It never sends notifications and never asks twice in a day.

- **One tap:** five faces from rough to great. An optional one-line note ("Kids were sick", "Big launch").
- **Never shaming.** The sheet doesn't show a task count. It reflects what happened in kind words:
  - Tasks done: "You moved 4 things forward today."
  - No tasks done: "Not every day is a task day. Rest, life and invisible work count too." Base barely moves after one day, and the check-in says so if asked.
  - Rough day: "Thanks for being honest. Tomorrow starts fresh." The next morning, Now starts with a light task or a break.
- Answers are private and stay on the device. They feed Pace: several rough days while Pace is **Stretching** or **Overreaching** strengthen the burnout signal ("High load and three rough days this week").
- Skipping it is fine. There's a "Don't ask today" option, and the check-in can be turned off in Settings.

## Prioritising for the Now view

Score each available task (not deferred, not waiting, energy fits):

```
score = energyFit*3 + timeFit*2 + projectMomentum + ageNudge − skipPenalty
```

- `timeFit`: fits the time chip, if one is set
- `projectMomentum`: small boost for projects with recent progress
- `ageNudge`: older Next tasks rise slowly, until they go quiet (21 days)
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
- **Day effort** is the sum of the day's completed tasks. Dropped or trashed tasks count for nothing.

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
- **Rough days:** three or more "rough" end-of-day check-ins in a week while Pace is above Steady

The message names the signals it saw, for example: "3 weeks above your usual load and no light day in 16 days."

### What "the graph stays up" means

Because Base is a 28-day average, working steadily keeps it level. One day off barely lowers it, and a week off lowers it gently. That rewards consistency without the "you broke your streak" moment.

### Graphs

- **Day:** effort by hour, with bar brightness showing energy level (dim = low, full accent = high). Today's total is compared with your Base.
- **Week:** a bar for each day, with your Base as a horizontal reference line.
- **Month:** daily bars plus two lines, Recent and Base. A shaded band shows the Steady zone (0.8–1.3 × Base), so you can see when you left it.
- **Now screen:** a small accent ring shows today's effort against your Base, with the zone word underneath. Tap it to open the graphs.

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
  doneAt?, doneEnergy?, actualMin?, skipCount,
  repeat?: { kind: 'daily'|'weekdays'|'weekly'|'monthly', days?: number[] /* 0=Sun */, dayOfMonth?: number },
  repeatSeriesId?: string
}
Project { id, name, status: 'active'|'someday'|'done', createdAt }
Settings { energyCurve[24], quietDays: 21, reviewDay, lastReviewAt, lastExportAt, checkInTime: '20:00', checkInEnabled: true }
DayCheckIn { date, mood: 1|2|3|4|5, note?: string }
BreakLog { id, kind, startedAt, minutes }
EstimateStats { keyword, medianMin, count, energyVotes }
// Task also stores effortPts and effortSource: 'auto'|'user' when done
DayLoad { date, effortPts, highIntensityMin, totalMin, tasksDone, breaks }  // cached rollup; Recent/Base computed from it
PaceSettings { enabled: true, steadyLow: 0.8, steadyHigh: 1.3, overreach: 1.5, calibrationDays: 14 }
```

Export is a single versioned JSON file shared through `navigator.share` (Save to Files / iCloud Drive). Import merges by `id`, keeping the newer `updatedAt`. Call `navigator.storage.persist()` on first run so iOS is less likely to evict the data.

## Design system

The visual design, motion and speed budget live in [`DESIGN.md`](DESIGN.md): minimal dark, one yellow accent, a micro-animation for every interaction, and no perceptible delay.

## Tech stack

- Vite + TypeScript + Preact with signals (small, fast on mobile)
- Transformers.js for the on-device embedding model, loaded lazily
- `idb` for IndexedDB, `vite-plugin-pwa` for the service worker and manifest
- No backend, no analytics
- Vitest for the parser, estimator and scoring; Playwright for mobile-viewport flows

## Build milestones

1. **M1 Core loop:** capture, Inbox, Next, Done, IndexedDB, PWA install, design tokens and core components
2. **M2 Energy:** curve onboarding, energy pill, Now card with swipe
3. **M3 Smart capture:** inline syntax parser, rule-based estimator, clarify card stack
4. **M4 GTD:** Projects, Waiting, Someday, defer dates, contexts, repeat control
5. **M5 Keeping it tidy:** weekly review with "Gone quiet" step, low-energy fallback and break cards, export/import, `.ics`
6. **M6 Pace:** effort points, Recent/Base/Pace zones, burnout signals, day/week/month graphs, Now ring, end-of-day check-in
7. **M7 Learning:** on-device embedding model for estimates, energy curve suggestions, polish and accessibility

## Decided in planning

1. Quiet tasks (21+ days untouched) go to the weekly review, not silently to Someday.
2. Repeats: a simple repeat control in v1.
3. Low energy: suggest the lowest-energy task, otherwise a healthy break.
4. Name: **TodoFlow**.
5. Dropped tasks earn no effort points.
6. End of day: an optional "How was your day?" check-in that never shames, including on days with no tasks done.

## What's built (v0.1)

Everything in milestones M1–M6, plus parts of M7:

- Capture with live chips, Inbox, clarify card stack, Next / Waiting / Someday / Projects / Done lists, edit sheet
- The Now deck: swipe, flip for actions, undo, 7-card pass limit, split prompt after repeated skips, focus timer, light option, break cards, "all clear"
- Energy curve (onboarding + editor), 2-hour override, time chips, easy mornings after a rough day
- Repeats (daily, weekdays, weekly days, monthly), schedule-based, never piling up
- Weekly review (Inbox, Gone quiet, Next & Waiting, Projects, Someday, Backup), review link from Calendar
- Pace: effort points, Recent / Base / Pace zones, burnout signals, day / week / month graphs, Now ring
- End-of-day check-in that never shames
- Export / import (merge), `.ics` for the weekly review and for single tasks
- Estimates from keyword rules plus your own history (similar finished or corrected tasks)

Not yet built:

- **On-device embedding model** for estimates. The estimator has the same interface, but uses word similarity for now. The model host (Hugging Face) couldn't be reached from the build environment, so this needs testing on a real device before shipping
- Energy-curve learning ("Your curve has shifted") from when you actually finish high-energy work
- Pull-down to reshuffle the deck (the deck already re-ranks itself when energy or time changes)
- Cloud sync (next version)

