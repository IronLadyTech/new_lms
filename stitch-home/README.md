# Stitch home page

The Google Stitch dashboard design, kept as a standalone page.

**Open it:** double-click `index.html`, or serve the folder — `npx serve stitch-home`.

## What this is

A design reference, not part of the app. It is deliberately isolated:

- Nothing here is imported by `src/`, and no route points at it.
- Tailwind comes from the CDN, so nothing is installed into the project.
- The LMS build never sees this folder.

Delete the folder and the app is unaffected.

## Two changes from the Stitch export

Both because the original pointed at URLs that will not last:

| Original | Now | Why |
|---|---|---|
| `lh3.googleusercontent.com/aida-public/…` logo | local `logo.png` | Stitch's asset host; the link expires |
| `lh3.googleusercontent.com/aida-public/…` avatar | initial in a red circle | same, and it matches the Profile page treatment |
| Placeholder course cards | the real `lep.png`, `100bm.png`, `mbw.png` covers, copied into `programs/` |
| `IRON LADY` set in Inter | Gemunu Libre 800 | Iron Lady's own heading face, per COMPANY_CONTEXT; loaded from Google Fonts here since the page is standalone |

Everything else is the export as given, including the sample content — "Alex Antony",
"Game Design Enthusiast", June 2022, and the three placeholder events. The middle
column is empty, as it is in the export.

## Fixes applied to the export

Spacing, radii and type are the design's own values. Only genuine defects were
changed — a footer nobody could reach is a bug in the output, not a decision.

| Problem | Measured | Fix |
|---|---|---|
| Settings / Help & Support / Log Out unreachable | sidebar needs **600px** at the design's spacing; browser zoom cuts the CSS viewport (at ~200% a 1080p screen gives **~445px**), and `body` is `h-screen overflow-hidden`, so the footer was pushed out with no scrollbar to reach it | nav block takes `flex-1 min-h-0` and scrolls; footer is `shrink-0` and stays pinned. Verified reachable at every height from 900px down to 300px |
| Brand scrolled away | logo sat inside the scrolling block | moved outside it |
| Nav rows wrapped to two lines | "Browse Courses", "Track Progress" at 16px in a 256px rail | `whitespace-nowrap` |
| Body text below 12px | **13 elements at exactly 10px** | all raised to 12px |
| No focus style anywhere | every item keyboard-reachable, none visible when focused | 2px brand outline on links and buttons |
| No responsive shell | fixed 256px rail left 134px on a 390px phone, and `overflow-hidden` blocked scrolling out of it | stacks and scrolls below `md` |
| No reduced-motion handling | — | `prefers-reduced-motion` block |

### Verified against the design

| | Spec | Rendered |
|---|---|---|
| Active pill radius | `rounded-2xl` | 16px |
| Inactive row radius | `rounded-md` | 6px |
| Panel radius | `rounded-l-[40px]` | 40px 0 0 40px |
| Panel margin | `mt-2 mb-2 mr-2` | 8px 8px 8px 0 |
| Events card radius | `rounded-3xl` | 24px |
| Main padding / gap | `px-8 py-6` / `gap-8` | 24px 32px / 32px |
| Brand margin | `mb-8` | 32px |
| Nav row spacing | `space-y-2` → tightened on request | 4px |
| Nav row height | `py-3` → tightened on request | 44px |
| Nav label size | `text-base` → reduced on request | 14px |
| Rail width | `w-64` → narrowed on request | 224px |
| Row left inset | `px-4` / `px-6` → pulled left on request | 12px (icons at 24px) |
| Icon-to-label gap | `gap-3` → tightened on request | 10px |
| Row gap | `space-y-2` → tightened on request | 2px |
| Row height | 44px → tightened on request | 40px |
| Disclosure arrows | on My Courses / Track Progress | removed on request |
| Events card | `w-80` `p-6` → reduced on request | 288px wide, `p-4` |

Sidebar needs **524px** and shows no scrollbar at that height or above. Below it —
which is what browser zoom produces — the nav list scrolls and the footer group
stays pinned, so nothing is ever out of reach.

**One thing left as drawn:** footer rows are 40px (`py-2`), under the 44px touch
minimum. Changing it would alter the design's spacing, so it is flagged rather
than silently fixed.

## Sidebar metrics, measured off the Zoho reference

| | Zoho | Ours |
|---|---|---|
| Logo | 24px | 24px |
| Row height | 28px | 28px |
| Row pitch | 36px | 36px |
| Gap between rows | 8px | 8px |
| Row radius | ~4px | 4px |
| Icon | ~16px | 16px |
| Icon → label gap | ~11px | 11px |
| Label | ~13px regular | 13px regular |

The mistake worth recording: several passes tried to fix "the rows look cramped"
by closing the gap, when the reference has *shorter rows with more space between
them*. Row height was the variable, not spacing.

**Below the touch minimum.** 28px rows match Zoho but are under the 44px target
for touch. Acceptable for a desktop rail; it would need revisiting if this ever
has to work on a phone.

## Middle panel — prototype

Seven slots, ordered by what a learner opens the page to find out: what next,
what is due, how far along, then everything else.

| Card | Notes |
|---|---|
| Continue | The one thing most visits are for. Real source: `getContinueProgram`. |
| Hours spent | A week of study time with the trend named. Real source would be `useStreakAnalytics`. |
| Your progress | Segmented bars, labelled with counts — honest about granularity in a way a smooth bar is not. |
| Announcement | Notice and announcement merged — two cards for "things staff wrote" is one card. Sits above payment so cohort notices are not buried. |
| Registration | **Conditional.** Renders only for a registered-but-unpaid tier — a real state in this system. Unconditional, it is an ad. |
| Programmes | **Full width** under the top band (not beside the Events rail), so three equal cards fill the content row with no blank column on the right. |
| Practice Streak | Full-width card under programmes. Sample activity for layout only; production should wire `StreakAnalyticsModule` / `SubmissionHeatmap`. |
| Recent activity | **In the right rail, under Upcoming Events** — it is reference, and the rail is where reference lives. Timeline with typed markers and a connecting rule. Filters stack at 288px. |

Sample data, like the rest of the page — but the programmes, tiers and access
states are the real ones, so the shapes are testable.

## Frame

The sidebar is a structural column, not a card:

| | |
|---|---|
| Position | `fixed`, top 0 / left 0 |
| Size | 200px wide, `100vh` tall |
| Radius / margin | 0 / 0 — reaches every viewport edge |
| Content | `margin-left: 200px`, so it starts exactly where the rail ends |

The Stitch export floated both surfaces on a padded page. Pinning the rail to
the viewport means page padding, the app frame's radius and its border all had
to go, or they would each have put a gap between the pink and the screen edge.

## Across devices

Two layouts, chosen by pointer type rather than width — a 1024px tablet is a
touch device and a width query never reaches it.

| | Pointer (laptop, desktop) | Touch (phone, tablet) |
|---|---|---|
| Nav | fixed 200px rail | drawer under 768px, rail above |
| Row height | 28px | **44px** |
| Smallest text | 10px | **12px** |
| Horizontal scroll | none | none |

**Phone drawer.** Stacked, the rail was 374px tall — 44% of a 390x844 screen —
so the dashboard began below the fold and every visit started by scrolling past
the whole menu. Off-canvas gives the content the screen back and keeps all eight
items, which a five-slot bottom bar could not. Opens from a header button,
closes on backdrop tap, on Escape, and on choosing a destination; focus moves
into the drawer on open and returns to the button on close; the page behind is
locked while it is open.

## Behaviour added

The export was static markup with `href="#"` on everything. Two things now work:

- **Selection follows the click.** `Dashboard` was hard-coded as selected. A
  delegated handler moves `aria-current="page"`, and the red pill is styled off
  that attribute — so the visual state and the accessible name stay in step.
- **The collapse control collapses.** Clicking it takes the rail from 200px to
  72px, icons only; the main panel’s `margin-left` follows so content expands into
  the freed space. Clicking again restores both. The button stays reachable while
  collapsed, or there would be no way back.

## Still open — decisions, not defects

- **Four items have no page behind them**: Browse Courses, My Courses, Track
  Progress, Settings. Every link is `href="#"`. Inbox and Assignments were
  dropped in a later revision of the design.
- **The middle column is empty**, as in the export.
- **Sample content is untouched**: "Alex Antony", "Game Design Enthusiast",
  June 2022, and the three placeholder events.
- **No avatar is stored.** There is no photo field on the profile; the Profile
  page uses an initial in a red circle, which is what this does.

## If this gets built into the app

Notes from the attempt already made, worth knowing before a second one:

- **Preflight.** Tailwind's reset targets `*` and every heading, list and form
  control. Importing it into the app would restyle every existing page. It has to
  be left out — and leaving it out means bare `<button>` keeps the browser's
  `2px outset` border and grey fill, which needs resetting per element.
- **Class collisions.** A few of our global class names (`.hidden`, `.grid`) match
  utility names Tailwind generates. Without a prefix the clash is silent. `tw:` works.
- **Type size.** Our Fira Sans runs larger than the Inter this was drawn in, so the
  fit is tighter again than the numbers above.
