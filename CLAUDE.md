# Iron Lady LMS — Agent Guide

React 19 + Vite + Firebase LMS. Plain global CSS in `src/index.css` (token-driven, `data-theme` light/dark).

## UI/UX workflow — run for EVERY UI task (build or change)

Before writing UI code:

1. **Read the design system** — `design-system/iron-lady-lms/MASTER.md`.
2. **Check the page override** — `design-system/iron-lady-lms/pages/<page>.md`. If it exists, its rules win over MASTER; if not, use MASTER.
3. **Brand tokens win** — colours/fonts come from `COMPANY_CONTEXT.md` (red `#F52929` / cream `#F7F6E4` / gold `#F5B301`, Gemunu Libre + Fira Sans). These **override** any generic ui-ux-pro-max palette.
4. **Reference the Behance patterns** — `DESIGN_ANALYSIS.md` (the analysed "LMS for IT school" screens). Structure/interaction only, never colours or assets.
5. **Validate with the plugin** — run the `ui-ux-pro-max` skill's UX query for the component type
   (`python scripts/search.py "<keywords>" --domain ux`) and satisfy its High-severity rules before finishing.

> The ui-ux-pro-max **auto design-system recommender mis-detects this as a kids app** (Claymorphism, blue/pink, Baloo/Comic fonts). **Ignore its palette/font output.** Use only its UX *rules*. `COMPANY_CONTEXT.md` + `MASTER.md` are the authority.

## Non-negotiable UX rules

- **Icons:** `lucide-react` only — never emojis as UI icons.
- **Tokens:** use CSS variables (`--primary`, `--space-*`, `--radius-*`, `--shadow-*`, `--z-*`) — no raw hex in components.
- **Focus:** visible `:focus-visible` ring via `var(--primary-ring)` / `var(--primary)`.
- **Clickable:** `cursor: pointer`; hover feedback via shadow/opacity/colour — **no layout-shifting transforms**.
- **Motion:** 150–300ms; respect `prefers-reduced-motion`.
- **Touch:** ≥44×44px targets on nav and primary actions; body text ≥16px on mobile.
- **States:** every async view has skeleton/loading, empty, and error states — never a frozen blank.
- **Feedback:** success vs. error must be semantically distinct (`.alert-success` / `.alert-error` + `role`), never colour-only or inferred from message text.
- **Contrast:** 4.5:1 body; test light AND dark.
- **Honesty:** never render fake/placeholder data (fake progress %, invented names, made-up points). If real data doesn't exist, omit the element or show a real alternative.

## Shared primitives (reuse before inventing)

- `src/components/ui/` — `PageHeader`, `EmptyState`, `SectionCard`, `DashboardSkeleton`, `SkipLink`
- `src/components/ConfirmDialog.jsx` + `src/hooks/useConfirm.js` — confirms
- `.btn` / `.btn-primary` / `.btn-outline` / `.btn-sm`; `.field` form pattern; `course-progress-ring` / `mbw-section-ring` rings

## Hard constraints (redesign work)

UI/UX/responsiveness/accessibility ONLY. Do **not** change routing, APIs, service signatures, Firebase/Firestore structure, or business logic. Reuse existing hooks/services (`useAuth`, `useTaskEngine`, `useStreakAnalytics`, `getEvents`, `getGroup`, …). Verify each change with `npm run build`.

## Key docs

| File | Purpose |
|---|---|
| `design-system/iron-lady-lms/MASTER.md` | Design system (tokens, components, anti-patterns) |
| `design-system/iron-lady-lms/pages/*.md` | Per-page overrides |
| `COMPANY_CONTEXT.md` | Brand, programs, colours, fonts (authoritative) |
| `DESIGN_ANALYSIS.md` | Behance reference analysis (all screens) |
| `LMS_REDESIGN_PLAN.md` | Phase 2–4 audit + roadmap + progress |

## Build

`npm run dev` (5173) · `npm run build` · `npm run preview`
