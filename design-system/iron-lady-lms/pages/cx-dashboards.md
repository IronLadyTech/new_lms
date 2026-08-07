# Page Override: CX Dashboard (all `/cx/*` pages)

> Enterprise CRM-style workspace for Customer Experience moderators. Navigation matches the **participant dashboard** icon rail (`student-layout--course` + `bottom-nav`).

## Shell layout

1. **Header** — Iron Lady logo, CX badge, program tabs (LEP / 100BM / MBW), program label, theme, Admin/LMS link
2. **Left icon rail (desktop) / bottom bar (mobile)** — same pattern as participant LMS: icon + short label
3. **Content** — max 1240px, panel-based sections

### Navigation items

| Label | Route | Purpose |
|-------|-------|---------|
| Home | `/cx/home` | Command center |
| Analytics | `/cx/dashboards` | KPIs, charts, activity |
| Participants | `/cx/batches` | Batch & member management |
| Reviews | `/cx/reviews` | Submission queue |
| Profile | `/cx/profile` | Account settings |

## Analytics (`/cx/dashboards`)

### KPIs — grouped by decision, not by data source

Two labelled groups. **Within a group every tile behaves the same way**, so "is this
clickable?" is never discovered by hovering.

| Group | Tiles | Behaviour |
|---|---|---|
| **Program health** | participants, active (7d), batches, task completion, session videos, attendance (when linked) | Read-only monitoring — no links |
| **Needs action** | ready to review, awaiting resubmit, not in a batch | Always navigates to the queue that clears it; shows a visible action label + chevron |

"Needs action" renders only when at least one tile is non-zero. A mixed strip where
some tiles navigate and others don't is the anti-pattern this replaces.

### Overview — four charts (no duplicates)

- **Cohort journey by batch** — full-row width (most series, longest labels)
- Payment status by join month
- Participant activity (7d / 30d / inactive)
- Task completion (MBW/100BM) or batch assignment (LEP)

Supporting panels (not repeated in charts):
- Review queue alert (when pending)
- Session content upload coverage
- Attendance aggregate (30d, when batches have `courseIds`)
- Recent activity feed

### Tabs — each has exactly one job

- **Overview** — charts + supporting panels
- **By batch** — batch table only (participants, task %, videos)
- **By task** — completion-by-batch chart + task-by-task breakdown

The batch table belongs to **By batch alone**. Rendering it under *By task* as well
made two of the three tabs overlap.

Program enrollment bar (admins only — LEP / 100BM / MBW)

Chart segments and legend rows drill through to a participant list
(`ParticipantListModal`); the legend rows are the keyboard-accessible path.

## Chart colour — derived, not picked

Colours come from `--chart-*` tokens in `src/index.css`, per theme. **No raw hex in
chart components.**

**Cohort journey, payment and activity are ordinal** — their stages have an inherent
order, so each uses a single-hue ramp (brand red, hue 27.5°) with monotone lightness.
The reader sees the progression in the colour instead of decoding unrelated hues.
This replaced a five-hue palette that included an off-brand blue.

- "No stage yet" / "Not started" sits **outside** the ramp on `--chart-neutral` — it is
  the absence of a stage, not a step within it.
- **Task completion is status** (`good` / `warning` / `idle`) and therefore always ships
  with a Lucide icon **and** a text label. Never colour alone.
- Stacked segments carry a 2px surface-coloured stroke so fills separate without
  relying on colour difference.
- Sub-3:1 fills carry direct value labels as the contrast-relief channel.

Ramps were generated at even OKLCH lightness steps and validated per mode
(monotone L, adjacent ΔL ≥ 0.06, end contrast ≥ 2:1, single hue).
**Regenerate rather than hand-editing** — the previous hand-picked palette failed the
lightness band, the chroma floor, and sat at ΔE 8.4 for deuteranopia with no secondary
encoding.

One legend per chart. The drill legend (swatch + label + count) is the legend —
recharts' own `<Legend>` is not also rendered.
## Reviews (`/cx/reviews`)

Queue filters: All submissions · Needs review · Awaiting resubmit  
Batch filter uses real batch list from `useCxData`.

## Data scoping

- Moderators see batches where they are in `moderatorIds` or `createdBy`
- Admins see all batches for the selected program
- Program switch (admins): session + `?program=` URL param

## Icons

Lucide only — no emoji UI icons.

## UX rules

- Loading: `DashboardSkeleton` / KPI skeleton — never blank
- Panels: `.cx-panel` with head/body/foot
- Tables: `.cx-data-table` with hover rows
- Focus: `var(--primary-ring)` on interactive elements
- No layout-shifting hover transforms on cards
