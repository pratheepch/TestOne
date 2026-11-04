# TodoFlow design system

Minimal dark, one accent. This is the source of truth for colour, type, spacing, shape, motion and speed. The product plan is in [`PLAN.md`](PLAN.md).

Reference: a dark todo UI screenshot shared in the planning chat. It shows a black page, near-black rounded cards, and one bright yellow used only for the focused item and the main action. We take its style (palette, type, spacing, shape), not its exact layout or branding.

## Principles

1. **Dark and quiet.** Almost everything is black or near-black. Content is the only thing that stands out.
2. **One accent, used sparingly.** Yellow marks *the one thing that matters right now*: the Now card, the capture button, today's Pace ring. If everything is yellow, nothing is.
3. **Depth through fading, not decoration.** No gradients, blur or heavy shadows. Items further from focus are dimmer.
4. **Every interaction answers back.** Each tap, swipe and state change has a short animation that shows what happened.
5. **Never wait.** The UI updates on the same frame as the input; saving happens after.

## Tokens

Colour (sampled from the reference):

| Token | Value | Use |
|---|---|---|
| `bg` | `#000000` | Page |
| `surface-1` | `#0E0E0E` | Containers, tab bar, sheets |
| `surface-2` | `#181818` | Cards, list rows |
| `surface-3` | `#232323` | Pressed state, chips, inputs |
| `border` | `#FFFFFF0F` (6% white) | 1px edge on surfaces |
| `text-1` | `#FFFFFF` at 92% | Titles |
| `text-2` | `#FFFFFF` at 55% | Metadata (time, date, counts) |
| `text-3` | `#FFFFFF` at 30% | Disabled, faded upcoming items |
| `accent` | `#FFF336` | The single accent |
| `on-accent` | `#0A0A0A` | Text and icons on yellow |
| `accent-dim` | `#FFF336` at 60% | Labels on dark ("High energy") |

**Energy without extra colours.** With one accent, energy is shown by *amount*, not hue: one, two or three small bars (▮▯▯ / ▮▮▯ / ▮▮▮) in `accent-dim`, and a label like `Low energy · ~5m` in the slot where the reference shows "High Priority".

**Pace zones without warning red.** Zones use the accent's strength plus wording. *Steady* is solid accent; *Easing off* is dimmed; *Stretching* and *Overreaching* use a diagonal-striped accent pattern and a plain-language message. That keeps one accent and still works for colour-blind users.

Type: the system font stack (`-apple-system`, SF Pro) — close to the reference's clean grotesk, and nothing to download.

| Token | Size / weight | Use |
|---|---|---|
| `display` | 34 / 600 | Screen titles |
| `title` | 22 / 400 | Task title on cards (regular weight, as in the reference) |
| `body` | 17 / 400 | Lists, inputs |
| `meta` | 13 / 400 | Time, date, counts |
| `label` | 11 / 600, +2% tracking | Energy label, section headers |

Sizes follow the system text-size setting (Dynamic Type) and scale up to 200%.

Spacing (4-pt grid): `4 · 8 · 12 · 16 · 20 · 24 · 32`. Card padding 20, gap between cards 8, screen side margin 16.

Shape: radius `12` for cards and chips, `24` for containers and sheets, `999` (pill) for buttons, the tab bar and the energy pill. Icons are 1.5px outline, 16 and 20 px.

Touch targets are at least 44 × 44 pt. Contrast is at least 4.5:1 for text, which `text-2` on `surface-2` meets.

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
| Complete (swipe right or tap) | Checkbox draws its tick, card slides off right, list closes the gap, Pace ring advances | Done, and it counted |
| Skip (swipe left) | Card slides left and tucks under the stack; next card rises and fills with yellow | Not gone, just later |
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

## Speed budget

"Fast without delay" is a testable requirement:

| Measure | Target |
|---|---|
| Response to input | Next frame (< 16 ms) for visual feedback; < 100 ms for the full update (INP) |
| Cold start (installed app) | < 1 s to an interactive Now screen |
| Initial JavaScript | < 60 KB gzipped; the AI model and charts load later |
| Data writes | Update in memory first, write to IndexedDB in the background, never wait for it |
| Lists | Render only visible rows when a list passes 100 items |

How: Preact with signals (small, fine-grained updates), all data read into memory at start, a service worker that serves the app shell from cache, and no web fonts. Milestone 1 includes a Playwright test that fails if these budgets are broken.

## Components

`Surface`, `Card` (focused yellow and normal), `TaskRow`, `SwipeRow`, `Chip`, `EnergyBars`, `EnergyPill`, `TabBar`, `CaptureButton`, `Sheet`, `CardStack`, `Ring`, `BarChart`, `LineBand`, `Toast`, `Button` (primary yellow pill and quiet), `TextField`, `SegmentedControl`, `Toggle`, `RepeatControl`, `BreakCard` (with timer), `DayCheckIn`.

A development-only `/design` page shows every component in every state and energy level, and is used for visual and speed checks.

Dark is the default. A light theme is not planned for v1, but every colour is a token, so one could be added later.
