# Iron Lady LMS — Redesign Plan (Phases 2–4)

> **Phase 1 (reference analysis):** see [`BEHANCE_LMS_REFERENCE.md`](./BEHANCE_LMS_REFERENCE.md)
> **Design system:** [`design-system/iron-lady-lms/MASTER.md`](./design-system/iron-lady-lms/MASTER.md)
> **Brand rules:** [`COMPANY_CONTEXT.md`](./COMPANY_CONTEXT.md)
> **Prior redesign log:** [`STUDENT_DASHBOARD_REDESIGN.md`](./STUDENT_DASHBOARD_REDESIGN.md)
> **Status:** Home / CourseDetail / MBW already redesigned. This plan covers the remaining pages + system hardening.
>
> **Guardrails (from brief):** UI/UX/responsiveness/accessibility only. No API, backend, routing, or DB changes. Reuse components. Explain plan → wait for approval → implement one page at a time.

---

## Phase 2 — How the LMS currently works

### Stack
React 19 · react-router-dom v7 · Firebase (service layer in `src/services`) · lucide-react · plain global CSS (`src/index.css`) · Chart.js/Recharts · HLS.js. Theme via `data-theme` attribute (dark default), `ThemeContext`.

### Routing (unchanged — do not touch)
| Path | Page | Shell |
|------|------|-------|
| `/app/home` | Home dashboard | `StudentLayout` |
| `/app/progress` | Progress | `StudentLayout` |
| `/app/calendar` | Calendar | `StudentLayout` |
| `/app/profile` | Profile | `StudentLayout` |
| `/app/support` | Support | `StudentLayout` |
| `/app/course/:courseId` | Course detail | `StudentLayout` |
| `/app/mbw` (`?lesson=`) | MBW program / lesson | `StudentLayout` |
| `/cx/*` | CX moderator app | `CXLayout` |
| `/admin`, `/superadmin`, `/portal` | Staff | own shells |

`StudentLayout` = `app-header` (brand, ThemeToggle, NotificationBell, admin link) + `#main-content` + `BottomNav` (Home · Calendar · Progress · Support · Profile). Route-aware body classes via pathname regex.

### Page-by-page current state

| Page | Tier | Layout today | Key problems |
|------|------|--------------|--------------|
| **Home** | ✅ redesigned | Banner → hero → quick stats → continue+schedule → programs grid → announcements → activity+pending → streak module | Guest sees only banner+locked (dashboard gated on `!isGuest`); programs stat hint no-op; dead `CourseThumbnail` import; two loading idioms |
| **Course Detail** | ✅ redesigned | Hero (media+tags+meta+progress+CTA) → How-it-works → (MBW) journey+progress panel → resources | `resumeHref` dead ternary; non-MBW courses get no progress/modules; no error state on bad id; blank-line formatting regression |
| **MBW** | ✅ redesigned | Overview (hero+journey) or focused lesson (topbar+lesson view+curriculum drawer) via `?lesson=` | Enroll CTA unstyled; guest = bare lock; ~325-line component, `successBanner`/`toast` duplication; scroll-timer races |
| **Progress** | ⚠️ legacy | `<h1>` → MBW promo card → resources list → activity log | **Emoji icons**; **no loading state**; **shows no actual progress metrics** despite rich MBW data; sequential resource fetches (slow) |
| **Profile** | ⚠️ legacy | `<h1>` → initials avatar → ThemeToggle → form → admin buttons → support → sign out | **Failure message styled green**; no card grouping; duplicate ThemeToggle (also header); no avatar upload; no sign-out confirm |
| **Calendar** | ⚠️ legacy | `<h1>` → thin wrapper around `LearnerCalendar` | Plain-text loading; silent error (console only) |
| **Support** | ⚠️ legacy | `<h1>` → notice → create-ticket form → tickets (list + thread) | Notice type by string-matching message text; two-col list+thread risky on mobile; plain-text loading; no search/pagination |

### Shared infra inventory (reuse these)
- **CSS families:** `.btn*` (closest to a real primitive), `.dashboard-*`, `.home-*`, `.cx-*`, `.mbw-*`, `.stat-card`, `.course-card`, `.confirm-dialog`, `.field` (best form pattern), `.badge*`.
- **JSX primitives (only 5):** `DashboardSkeleton`, `SkipLink`, `ThemeToggle`, `ConfirmDialog`, `CourseThumbnail`.
- **Hooks/services:** `useAuth`, `useTaskEngine`, `useMbwEnrollment`, `useStreakAnalytics`, `useAttendanceAnalytics`; `courseService`, `eventService`, `ticketService`, `mbwService`, etc.

---

## Phase 3 — Comparison with Behance reference

The reference's transferable principles — **pastel section zones**, **schedule-first dashboard**, **pill stat chips**, **card grids**, **visible progress before unlock**, **soft borders over hard lines** — are already applied to Home/Course/MBW with Iron Lady brand (red/cream/gold, Gemunu Libre/Fira Sans) substituted for the off-brand forest-green palette.

### Remaining gaps vs. the reference's design quality
| Dimension | Reference intent | IL today | Gap |
|-----------|------------------|----------|-----|
| **Consistency** | One UI kit across all screens | 2 polish tiers; ~12 badge families; 5 card patterns | Extract primitives; lift 4 legacy pages |
| **Progress viz** | Progress always visible (rings/bars) | Rich on MBW; **absent on Progress page**; fake on CourseCard | Real progress data everywhere |
| **Empty/loading states** | Considered states | 3 loading idioms; missing on Progress/Calendar | Standardize skeleton + EmptyState |
| **Tokens/spacing** | Systematic scale | No spacing/z-index scale; undefined `--shadow-sm` | Add token scales |
| **Navigation** | Clear IA to core content | Core MBW not in nav | Nav review |
| **Icons** | Consistent icon set | Emoji on Progress | lucide everywhere |

---

## Phase 4 — Implementation roadmap

**Sequencing rationale:** the brief prioritizes Dashboard → Course → Lesson → Course Work → Tasks → Profile → Calendar → Support. Home/Course/MBW are already done, so the highest-value *new* work is the 4 legacy pages + a thin shared-primitive layer that de-risks them. Order below front-loads the primitives that every later page reuses, then does legacy pages by impact.

### Step 0 — Design-system hardening (small, enabling)
- Add token scales to `:root` in `index.css`: `--space-*` (4→48), `--radius-sm/md/lg/pill`, `--z-*`, define missing `--shadow-sm`. Non-breaking additions.
- Extract minimal shared primitives used by the legacy pages: `<EmptyState>`, `<PageHeader>` (eyebrow+title+sub), `<SectionCard>`. Keep `.btn`/`ConfirmDialog` as-is.
- **Reuse:** existing tokens, `DashboardSkeleton`, `.btn`, `.field`.

### Priority pages
1. **Dashboard (Home)** — polish, not rebuild. Fix guest dashboard (show preview instead of only banner), fix no-op stat hint, remove dead import, unify loading, real progress on `CourseCard`. *Reuse:* all existing home components.
2. **Course Details** — add progress panel for non-MBW courses; error state for bad id; clean blank-line formatting; per-type resource icons. *Reuse:* `CourseProgressPanel`, `CourseHowItWorks`.
3. **Lesson Page (MBW lesson mode)** — style enroll CTA; guest journey preview; reduce `successBanner`/`toast` duplication. *Reuse:* `MBWLessonView`, `TaskContent`.
4. **Course Work / Task Components** — standardize task header/status pills via a shared `<StatusPill>`; consistent watch-threshold copy from prop. *Reuse:* `TaskContent`, submission components.
5. **Profile** — group into cards (identity / preferences / account); fix failure-green bug; single ThemeToggle; sign-out confirm via `ConfirmDialog`. *Reuse:* `.field`, `ConfirmDialog`, `PageHeader`.
6. **Calendar** — skeleton loading; visible error state; `PageHeader`. *Reuse:* `LearnerCalendar`, `PageHeader`, `EmptyState`.
7. **Support** — responsive list/thread (stack on mobile); status-driven notice (not string match); skeleton; `PageHeader`. *Reuse:* `ConfirmDialog`, `useConfirm`, `PageHeader`, `EmptyState`.
8. **Progress** — biggest win: show real progress (MBW rings + per-course bars) via existing progress utils; lucide icons; skeleton; `Promise.all` fetch. *Reuse:* `CourseProgressPanel` pattern, `StreakAnalyticsModule`, `ActivityLogList`.

### Responsive behavior (all pages)
Single column < 640px; stat/quick grids 2×2 on mobile; two-column panels stack; content never hidden behind fixed bottom nav (bottom padding). Standardize on 640 / 768 / 1024 breakpoints.

### Non-goals
No routing/API/DB/backend changes. No new dependencies. No wholesale rewrite of already-redesigned pages.

---

*Living document. Update as pages ship. Verify against brand rules in `COMPANY_CONTEXT.md`.*
