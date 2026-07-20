# Page Override: Student Home (`/app/home`)

Overrides MASTER for dashboard layout.

## Layout order
1. Banner carousel (optional, full bleed)
2. Dashboard hero — greeting, program badge, tagline, primary CTA
3. Quick stats — 4 pills (programs, pending, events, activity)
4. Main row — Continue learning (pink-soft) | Schedule (beige)
5. Programs grid — beige zone
6. Announcements (if any)
7. Activity + pending assignments (2-col desktop)
8. Streak/progress module (compact `homeVariant`)

## Loading
Use `DashboardSkeleton` — no plain "Loading…" text alone.

## Copy
- Tagline: "Elevating a million women to the top"
- Empty schedule: "No live sessions scheduled — check back soon."
- Programs subtitle: journey order LEP → 100BM → MBW; locked stay visible as upcoming

## Program access
- Cards sorted LEP → 100BM → MBW
- States: open (enrolled/included), upcoming (next step), locked
- No self-enroll into locked tracks — CTA is Speak to our Counsellor
- Direct `/app/mbw` and `/app/100bm` blocked with ProgramLockedPanel when not entitled

## CTAs
- MBW access → "Continue MBW tasks"
- Single open program → "Continue {code}"
- None → "Browse programs"
