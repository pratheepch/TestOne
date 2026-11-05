# TodoFlow design system

Minimal dark, one accent. This is the source of truth for colour, type, spacing, shape, motion and speed. The product plan is in [`PLAN.md`](PLAN.md).

Source: the **Companion Dark** design system (https://claude.ai/artifact/MqCgRQzJKAQja4yqR8Mnut). TodoFlow uses its tokens, type, shapes, depth and components. Its 3D avatar is for an AI assistant, which TodoFlow doesn't have, so the avatar, `AvatarStage`, `Message` and `PromptBar`-as-chat are not used.

## Principles

1. **Dark and quiet.** Almost everything is black or near-black. Content is the only thing that stands out.
2. **One accent, used sparingly.** Yellow marks *the one thing that matters right now*: the Now card, the capture button, today's Pace ring. If everything is yellow, nothing is.
3. **Depth through fading, not decoration.** No gradients, blur or heavy shadows. Items further from focus are dimmer.
4. **Every interaction answers back.** Each tap, swipe and state change has a short animation that shows what happened.
5. **Never wait.** The UI updates on the same frame as the input; saving happens after.

## Tokens

All values come from Companion Dark's `tokens.json` and live as CSS custom properties in `src/styles/app.css`.

Colour:

| Token | Value | Use in TodoFlow |
|---|---|---|
| `ground` | `#09090a` | Page background |
| `surface` | `#141416` | Sheets, disabled controls |
| `surface-raised` | `#1c1c1f` | Cards, list rows, chips, inputs, settings rows |
| `surface-high` | `#2a2a2e` | Selected dock item, icon buttons, toast, card-back actions |
| `surface-glass` | `#1c1c1fc7` | The dock and the Now top bar, always with a 20px backdrop blur |
| `line` / `line-strong` | `#ffffff14` / `#75757c` | Hairlines / control borders (checkbox ring, toggle) |
| `ink` / `ink-muted` / `ink-faint` | `#f4f4ef` / `#a8a8a2` / `#8e8e88` | Text, secondary text, placeholders (`ink-faint` never on `surface-high`) |
| `accent` | `#fff133` | The one loud thing: the top Now card, the add button, the Pace ring, focus rings |
| `accent-soft` | `#fff1331f` | Energy pill and calm status pills, text on it stays `accent` |
| `on-accent` / `on-accent-muted` | `#0b0b08` / `#47440f` | Text on yellow / secondary text on yellow |
| `danger` | `#ff9a5c` | Delete actions, always with an icon or word |
| `success` | `#7cc8ff` | The tick in the "Done" toast. Blue, so it never relies on red vs green |

**Energy without extra colours.** One, two or three small bars in `accent` plus a label like `Low energy · ~5m` in the TaskCard's eyebrow slot.

**Pace zones without warning red.** StatusPills: *Steady* is solid `accent`, *Easing off* and *Calibrating* are `accent-soft`, *Stretching* and *Overreaching* are striped `accent`, each with words.

Type: **Instrument Sans** (variable, 400–700), bundled with the app from `@fontsource-variable/instrument-sans` instead of Google Fonts, so it works offline. The Latin subset is 30 KB and is cached by the service worker.

| Token | Size / line / weight | Use |
|---|---|---|
| `numeral` | 56 / 56 / 600, tabular | Today's points on Pace, the focus timer |
| `display` | 36 / 40 / 600 | Screen titles, onboarding headline (one per screen) |
| `title` | 24 / 30 / 500 | Task titles on cards, sheet titles |
| `heading` | 18 / 24 / 600 | Section headings |
| `body` | 16 / 24 / 400 | Rows, inputs, running text |
| `label` | 14 / 20 / 500 | Buttons, chips, metadata |
| `caption` | 12 / 16 / 500 | Card eyebrows, field labels, status pills |

Spacing: `space-1…12` = `4 · 8 · 12 · 16 · 20 · 24 · 32 · 48`. Screen gutter `space-4`, card padding `space-5`, sheet padding `space-6`, `space-2` between stacked cards.

Shape: floating chrome is a pill (`radius-pill`: dock, top bar, chips, buttons, inputs, toast). Content is a rounded rectangle: `radius-md` 16 for rows and cards, `radius-lg` 24 for the deck cards, `radius-xl` 36 for sheets.

Depth: surfaces are separated by lightness plus the `edge` top highlight, not drop shadows. `float` only on the dock and toast; `glow` only on the round add button.

Icons: 1.75px rounded line icons on a 24px grid, inheriting `currentColor`. No emoji: the check-in uses line-drawn mood faces with word labels.

Focus and touch: a solid 2px `accent` ring with a 2px offset on every control; touch targets 44px or larger.

Copy: sentence case, no exclamation marks or emoji, buttons named with a verb and an object ("Add task", "Save my day").

## Motion: a micro-animation for every interaction

Rules:

- **Fast.** 120–240 ms, never longer than 300 ms. Spring curves for anything you drag, `ease-out` for everything else.
- **Never blocks input.** Every animation can be interrupted; you can tap the next thing while the last one finishes.
- **Only `transform` and `opacity`**, so they run on the GPU at 60–120 fps.
- **Meaningful.** Each one shows where something went or what changed. No decorative loops.
- **Reduced motion.** When the system setting is on, movements become 100 ms crossfades.

| Interaction | Animation | Meaning |
|---|---|---|
| Press anything | Scales to 0.97 on touch, springs back on release | "I felt your tap" |
| Open capture | Yellow button stretches into the input bar; keyboard follows | Capture comes from that button |
| Save a task | Text shrinks into a chip that drops into the Inbox tab; tab count ticks up | Where it went |
| Inline syntax (`!low`, `#home`) | The token pops into a chip as you finish typing it | It was understood |
| Complete and skip on the Now deck | See [The Now deck](#the-now-deck) | Done, or just later |
| Complete in a list | Checkbox draws its tick, row slides off right, list closes the gap, Pace ring advances | Done, and it counted |
| Undo (toast button) | The reverse of the last motion | Exactly undone |
| Change energy | Bars fill or empty one by one; the Now list reshuffles with cards moving to their new places | Energy changed what's shown |
| Clarify card stack | Card follows the finger; a label (Next / Someday / Trash) fades in by direction; releases into its list | Where it will go |
| Switch tab | Accent dot slides under the new tab; content crossfades with an 8px shift | Where you are |
| Open a sheet | Rises with a spring; background dims to 60% | A layer on top |
| Pace ring and graphs | Ring and bars grow from zero on open; numbers count up | Your effort adds up |
| "Gone quiet" review step | Stale cards slide in one at a time with how long they've been quiet; swiping sends each to its list | Nothing disappears without you |
| Set repeat | The repeat chip flips to show the schedule (`↻ Mon`); on completing a repeat task, a copy slides back in faded, labelled with its next date | It will come back |
| Break suggestion | The Now card turns over to reveal the break, then a thin accent line runs down as a timer; on finishing it fills and fades | A real pause, with an end |
| End-of-day check-in | Sheet rises slowly (240 ms); choosing a face makes it settle gently; the sheet closes with a soft fade, never a "0 tasks" counter | A calm close to the day |
| Export backup | Icon arcs upward, then becomes a check | Saved |

Short system haptics (`navigator.vibrate`) accompany done, skip and errors where the device supports them. iOS Safari ignores it, so motion carries the feedback alone.

## The Now deck

The heart of the app: one suggestion at a time, as a stack of cards you can flick through. It should feel physical, quick and a little satisfying, like dealing cards.

### Layout

```
        ┌───────────────────────────┐
        │ ▮▮▯ Medium energy · ~20m  │   ← label (on-accent)
        │                           │
        │ Draft the project brief   │   ← title, 22/400
        │                           │
        │ Fits your energy · keeps  │   ← why it was picked, meta
        │ Website moving            │
        └───────────────────────────┘     top card: accent fill
         └─────────────────────────┘      2nd: surface-2, scale 0.95, 10px lower
           └─────────────────────┘        3rd: surface-2, scale 0.90, 20px lower, 50% opacity

          ✕ Not now          ✓ Done      ← buttons, same actions as swiping
```

- The top card is about 60% of screen height and centred where the thumb rests.
- At most **7 cards** in one pass. After that: "That's the best of what fits. Show the full list?" This avoids endless flicking, which is a way of avoiding work.

### Gestures

| Gesture | Action | What you see |
|---|---|---|
| Swipe right | **Done** | Card follows the finger and tilts up to 8°. A "Done ✓" stamp fades in on the card. On release, the tick draws, the card flies off right, the Pace ring advances |
| Swipe left | **Not now** | A "Next" stamp fades in. On release, the card flies off left and the next card rises into place, filling with the accent |
| Tap | **Actions** | The card flips over (180 ms) to show: Start timer · Defer · Someday · Edit · Split |
| Long-press | **Edit** | The card lifts slightly (scale 1.03) and the edit sheet rises |
| Pull down on the deck | **Reshuffle** | The deck re-ranks, for example after your energy changed |

How the drag feels:

- The card tracks the finger 1:1 with no lag, rotating around a point below the card, so it swings like a held card.
- **Live preview:** as the top card moves away, the card behind grows from 0.95 to 1.0 and starts taking on the accent, so you see what's next before you let go.
- **Commit threshold:** 35% of the screen width, or a quick flick (over 0.5 px/ms) at any distance.
- **Below the threshold**, the card springs back to centre with a slight overshoot.
- **Fly-off** follows the release speed and direction, so a fast flick leaves fast.
- The next card is ready on the frame the top card leaves. There is never an empty moment.

### After a swipe

- **Undo** for 4 seconds: a small toast at the bottom ("Done · Undo"). Undo flies the card back onto the deck.
- **Not now** means later today: a skipped card returns at the bottom of the deck after other suggestions, and is ranked lower for the rest of the day.
- **Skipped three times in a week:** the next time it appears, the back of the card shows "Too big? Split it · Someday · Keep" instead of going straight to the next card.

### Start timer

"Start" on the back of the card turns the card into a focus view:

- The card grows to fill the screen; the title stays, a thin accent line slowly runs down as time passes against the estimate.
- "Done" or swipe right finishes it. The real time is saved, which makes future estimates better.
- Leaving the app keeps the timer running; it's based on the start time, not a background process.

### When the deck runs out

- The last card leaves and the **lowest-energy task** rises in its place, marked "Light option".
- If there's none, a **break card** rises instead, using the same swipe rules: right to start the break, left for another idea.
- If there's nothing at all: "All clear for your energy right now." with one quiet button, "Show everything".

### Accessibility

- The ✕ and ✓ buttons below the deck do everything the swipes do, so no gesture is ever required.
- VoiceOver reads the card as "Draft the project brief, medium energy, about 20 minutes. Actions: Done, Not now, More". The swipe actions are available from the rotor.
- With reduced motion, cards crossfade in place with no tilt or flying.

### Engineering notes

- Drag uses Pointer Events and a CSS `transform` updated in `requestAnimationFrame`, never layout properties.
- Only the top three cards are in the DOM; the rest are data.
- Card springs use a small spring function (a few lines, no animation library), so input never waits on JavaScript beyond the next frame.

## Speed budget

"Fast without delay" is a testable requirement:

| Measure | Target |
|---|---|
| Response to input | Next frame (< 16 ms) for visual feedback; < 100 ms for the full update (INP) |
| Cold start (installed app) | < 1 s to an interactive Now screen |
| Initial JavaScript | < 60 KB gzipped; the AI model and charts load later |
| Data writes | Update in memory first, write to IndexedDB in the background, never wait for it |
| Lists | Render only visible rows when a list passes 100 items |

How: Preact with signals (small, fine-grained updates), all data read into memory at start, a service worker that serves the app shell from cache, and one self-hosted variable font that the service worker precaches. Milestone 1 includes a Playwright test that fails if these budgets are broken.

## Components

`Surface`, `Card` (focused yellow and normal), `NowDeck` (stack, gestures, flip, focus timer), `TaskRow`, `SwipeRow`, `Chip`, `EnergyBars`, `EnergyPill`, `TabBar`, `CaptureButton`, `Sheet`, `CardStack`, `Ring`, `BarChart`, `LineBand`, `Toast`, `Button` (primary yellow pill and quiet), `TextField`, `SegmentedControl`, `Toggle`, `RepeatControl`, `BreakCard` (with timer), `DayCheckIn`.

A development-only `/design` page shows every component in every state and energy level, and is used for visual and speed checks.

Dark is the default. A light theme is not planned for v1, but every colour is a token, so one could be added later.
