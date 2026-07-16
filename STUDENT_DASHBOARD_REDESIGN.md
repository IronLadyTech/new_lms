# Student Dashboard Redesign — Iron Lady LMS

> **Inspired by:** [Behance — LMS for IT school](./BEHANCE_LMS_REFERENCE.md)  
> **Brand reference:** [COMPANY_CONTEXT.md](./COMPANY_CONTEXT.md)  
> **Status:** Phase 1 implemented (Student Home + CX Home layout); MBW documented for Phase 2

---

## Design intent

Adapt the Behance case-study patterns — **card grid**, **schedule-first dashboard**, **persona-style welcome**, **pastel content zones**, **pill stat chips** — while keeping Iron Lady identity: red `#F52929`, cream `#F7F6E4`, gold `#F5B301`, Gemunu Libre headings, ambitious leadership tone.

**Do not copy:** forest-green palette, IT-school copy, or Behance assets (designer license restricts reuse).

---

## Pattern mapping (Behance → Iron Lady)

| Behance pattern | Iron Lady interpretation | Student Home | MBW | CX |
|-----------------|-------------------------|--------------|-----|-----|
| Goals / persona quote | Welcome + program tagline | Hero: greeting + “Elevating a million women to the top” | Hero tagline (Business War Tactics) | Moderator greeting + program badge |
| 5W “Why?” cards | Motivation chips (maximize, community, tactics) | Goal pills under hero | Quarter module focus | Batch purpose / review SLA |
| Pastel section backgrounds | Cream / beige / soft pink zones | Programs strip, continue card | Lesson sidebar bands (Phase 2) | Stat cards, batch cards |
| Calendar / schedule grid | Upcoming events panel | Schedule panel → full calendar | Quarterly timeline (existing journey) | Session reminders per batch |
| Short async lessons | Continue learning CTA | Primary CTA → MBW / course | Resume next task | N/A (moderator view) |
| Dashboard stat chips | At-a-glance counts | Enrolled, pending, events, activity | Milestones complete / next task | Batches, reviews, learners |
| User flow / IA | Bottom nav unchanged | Home → MBW → Calendar → Profile | MBW journey accordion | CX tabs: Home, Batches, Review |
| Pill tags for process | Program badges | MBW / LEP / 100BM colors | Module labels | `cx-program-badge` |
| Streak / progress heatmap | Submission streak analytics | Progress section (bottom) | Progress band in hero | Batch completion board |

---

## Layout wireframe — Student Home (`/app/home`)

```
┌─────────────────────────────────────────────────────────────┐
│  [Marketing banner carousel — optional, full bleed]          │
├─────────────────────────────────────────────────────────────┤
│  DASHBOARD HERO (cream surface, red accent border)           │
│  Good morning · FIRSTNAME          [Program badge: MBW]      │
│  Elevating a million women to the top                        │
│  Pick up where you left off…              [Continue MBW →]   │
├──────────────┬──────────────┬──────────────┬─────────────────┤
│  Programs 2  │ Pending 3    │ Events 4     │ Activity 5      │  ← stat pills
├──────────────────────────────┬──────────────────────────────┤
│  CONTINUE LEARNING (pink-soft)│  SCHEDULE (beige)            │
│  MBW · Next task title        │  Mon 12 · Live Q&A           │
│  [Open tasks]                 │  Wed 14 · Buddy huddle       │
│                               │  [View calendar →]           │
├──────────────────────────────┴──────────────────────────────┤
│  PROGRAMS (beige zone) — course cards grid                   │
├──────────────────────────────┬──────────────────────────────┤
│  Announcements               │  Last activity               │
├──────────────────────────────┴──────────────────────────────┤
│  Your progress — streak / heatmap (compact)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Layout wireframe — MBW (`/app/mbw`)

Existing **MBWProgramHero** + journey accordion maps to Behance “continue + schedule”:

| Zone | Current component | Redesign note |
|------|-------------------|---------------|
| Hero | `MBWProgramHero` | Keep; align copy with Q1–Q4 from COMPANY_CONTEXT |
| Progress | `MBWProgramProgressBand` | Maps to Behance timeline — already strong |
| Schedule | Quarterly sections | Phase 2: mini “this quarter” chip row under hero |
| Lessons | Accordion + lesson view | Phase 2: softer pastel row hover (cream tint) |
| CTA | Resume button | Primary red — on brand |

**Phase 2 MBW tasks:** pastel `--il-beige` section headers; quarter pill navigation (Q1–Q4).

---

## Layout wireframe — CX Home (`/cx/home`)

```
┌─────────────────────────────────────────────────────────────┐
│  CX HERO                                                     │
│  Hi, NAME · MBW · Customer Experience                        │
│  Support your cohort — reviews, reminders, tracking          │
├──────────────┬──────────────┬──────────────┬─────────────────┤
│  Batches 3   │ Reviews 5    │ Learners 42  │ Tasks 12        │
├──────────────────────────────┴──────────────────────────────┤
│  Batches (cards + session reminder)                          │
├─────────────────────────────────────────────────────────────┤
│  Module-wise tracking (TaskTrackingBoard)                    │
├─────────────────────────────────────────────────────────────┤
│  Pending reviews list                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Brand tokens (dashboard-specific)

| Token | Value | Usage |
|-------|-------|--------|
| `--dash-zone-cream` | `var(--il-cream)` | Page bg (light), hero gradient |
| `--dash-zone-beige` | `var(--il-beige)` | Programs section, schedule panel |
| `--dash-zone-pink` | `var(--il-pink-soft)` | Continue learning card |
| `--dash-zone-red` | `color-mix(in srgb, var(--il-red) 8%, var(--il-cream))` | Hero subtle tint |
| Stat pill active | `var(--primary-subtle)` + red text | Quick stats |
| Section heading | `var(--font-heading)` | All dashboard h1/h2 |

---

## Copy guidelines (on-brand)

| Location | Copy |
|----------|------|
| Hero eyebrow | Time greeting + optional program name |
| Hero sub | Tagline or contextual line from COMPANY_CONTEXT |
| Empty schedule | “No live sessions scheduled — check back soon.” |
| Empty progress | “Start building your streak — open a program below.” |
| CX hero sub | “Reviews, reminders, and cohort tracking for {program}.” |
| CTAs | Continue MBW tasks · Open tasks · View calendar · Browse programs |

Avoid: “IT career”, “bootcamp”, generic blue SaaS tone.

---

## Component inventory

| Component | Path | Used on |
|-----------|------|---------|
| `HomeDashboardHero` | `src/components/home/HomeDashboardHero.jsx` | Home |
| `HomeQuickStats` | `src/components/home/HomeQuickStats.jsx` | Home |
| `HomeContinueCard` | `src/components/home/HomeContinueCard.jsx` | Home |
| `HomeSchedulePanel` | `src/components/home/HomeSchedulePanel.jsx` | Home |
| `CxDashboardHero` | `src/components/cx/CxDashboardHero.jsx` | CX Home |
| `CxQuickStats` | `src/components/cx/CxQuickStats.jsx` | CX Home |

---

## Implementation phases

### Phase 1 ✅ (this release)
- Student Home dashboard grid layout
- CX Home hero + stat pills
- Shared dashboard CSS in `index.css`
- This document

### Phase 2 (follow-up)
- MBW quarter pills + beige section bands
- Mini month calendar widget on Home (not just list)
- Persona-style “Your B-HAG” optional field on profile → show on Home hero
- Mobile: stack dashboard grid, sticky continue CTA

### Phase 3 (follow-up)
- Admin dashboard visual alignment
- Animated transitions (Behance case study mentions After Effects — subtle CSS only)

---

## Mobile behavior

| Breakpoint | Behavior |
|------------|----------|
| `< 640px` | Single column; stats 2×2 grid; banner height reduced |
| `640–960px` | Continue + schedule stack; courses 1 col |
| `> 960px` | Full 2-column dashboard main row |

---

## Files touched (Phase 1)

- `src/pages/student/Home.jsx` — dashboard layout
- `src/pages/cx/CXHome.jsx` — CX dashboard layout
- `src/components/home/*` — new home dashboard components
- `src/components/cx/CxDashboardHero.jsx`, `CxQuickStats.jsx`
- `src/index.css` — `.dashboard-*` and `.cx-dashboard-*` styles

---

*For brand rules see `.cursor/rules/iron-lady-brand-context.mdc`.*
