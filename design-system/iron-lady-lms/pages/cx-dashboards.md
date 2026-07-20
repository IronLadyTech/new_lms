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

KPI strip: participants, active (7d), batches, task completion, pending reviews, awaiting resubmit, session videos, attendance (when linked).

Overview — **four charts only** (no duplicates):
- Cohort journey by batch (payment + progress stage)
- Payment status by join month
- Participant activity (7d / 30d / inactive)
- Task completion donut (MBW/100BM) or batch assignment (LEP)

Supporting panels (not repeated in charts):
- Review queue alert (when pending)
- Session content upload coverage
- Attendance aggregate (30d, when batches have `courseIds`)
- Recent activity feed

Tabs:
- **Overview** — charts + supporting panels
- **By batch** — batch table with participants, task %, videos
- **By task** — completion-by-batch chart + task-by-task breakdown

Program enrollment bar (admins only — LEP / 100BM / MBW)

No chart click-through drill-down (unlike Zoho Analytics).
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
