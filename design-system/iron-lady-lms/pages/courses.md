# Page Override: Courses & Catalog

> Behance reference: horizontal course cards with icon block, pill tags, metrics, dual CTAs.

## Course card pattern
- **Left:** Thumbnail + program code overlay
- **Tags:** Program tier pill + "Enrolled" when active
- **Title + description** (3-line clamp)
- **Metrics:** Duration + format (from `courseDisplay.js`)
- **Progress bar:** Shown when enrolled
- **Actions:** "Learn more" (outline) + "Enroll" or "Continue" (primary)

## Iron Lady mapping
| Behance | Iron Lady |
|---------|-----------|
| Orange "Ae" icon block | Program thumbnail + code badge |
| elementary / instrumental tags | MBW / LEP / 100BM tier tags |
| 120 lessons \| 40h | Duration + format from COMPANY_CONTEXT |
| Learn more + Buy now | Learn more + Enroll / Continue |

## Course detail
- Hero grid: thumbnail + tags + metrics + CTA
- **How it works:** 4-step async flow (watch → submit → review → unlock)
- **MBW enrolled:** Program modules accordion (`MBWProgramJourney`) + progress sidebar (Behance-style rings)
- Resources as card list with play icon (async short lessons)

## Behance course interior (module page)
- **Main:** Module accordion with % complete, Continue CTA, lesson rows (Theme N + status)
- **Sidebar:** Upcoming events, recordings, task rating rings (theoretical vs practical)
- **Iron Lady mapping:** Lesson videos vs assignments; CX review step; Iron Lady red rings
