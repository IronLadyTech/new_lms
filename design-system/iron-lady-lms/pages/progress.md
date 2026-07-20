# Page Override: Student Progress (`/app/progress`)

Overrides MASTER for the learner progress hub.

## Layout order
1. Page header — eyebrow, title, subtitle
2. Stats strip — 4 pills (programs, overall progress, resources, streak)
3. Two-column shell (desktop):
   - **Primary:** MBW milestone panel (when enrolled) → enrolled program cards
   - **Secondary:** resources → activity log → streak (numbers)
4. Mobile: single column — programs, resources, activity, streak

## Visual zones
- Stats: white surface pills, red value numerals (match home `dashboard-stats`)
- Program cards: thumbnail + ring + bar + primary CTA (no program code labels)
- MBW panel: cream gradient card (reuse `course-progress-panel`)
- Resources: `resource-card` rows with type icon
- Activity: `activity-list` with type pills

## Loading
- Per-section skeletons — never block entire page on one slow fetch
- Program cards skeleton while courses load

## Connected data
- Stats pills scroll to: Programs, Resources, Streak sections
- Resources + activity scoped to enrolled Firestore course IDs (incl. program→course resolve)
- Activity log sorted newest-first; streak follows activity log in layout
- Resource filter tabs per enrolled program

## Copy
- Subtitle: "Track milestones, materials, and momentum across your Iron Lady programs."
- Empty programs: "Enroll in a program to start tracking your progress." → CTA Explore programs
- Empty resources: "Lesson materials appear here once your cohort publishes them."

## CTAs
- MBW enrolled → "Continue MBW" / panel "Continue to study"
- 100BM → "Open tasks" → `/app/100bm`
- LEP / course → "Open program" → course detail
- No fake progress percentages
