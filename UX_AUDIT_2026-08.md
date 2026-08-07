# Iron Lady LMS — End-to-End UX, Accessibility & Production-Readiness Audit

**Date:** 2026-08-07 · **Branch:** `main` @ `edf28b6` · **Scope:** 234 source files, 48,906 LOC
**Method:** Static audit of every route, layout, shared primitive, service, and the full 15,502-line stylesheet; production build executed; WCAG contrast computed from actual token values.
**Reviewer roles:** Senior Product Designer · UX Researcher · Design Architect · QA Engineer · Paying customer

---

## 0. Verdict

**Not ready for production launch.** The product is further along than most internal LMS builds — the CX
workspace, the program/task engine, and several shared primitives (`CxKpiStrip`, `ConfirmDialog`,
`EmptyState`, `useFocusTrap`) are genuinely well-made. But four classes of defect block launch:

| Blocker | Evidence |
|---|---|
| **Performance** — no code splitting at all | 1,800 kB main JS (513 kB gz) + 533 kB Firebase + 236 kB CSS on *every* route including the login page. `React.lazy` appears 0 times in the codebase. |
| **Accessibility** — the primary CTA fails WCAG AA | White on `--primary #f52929` = **4.01:1** (AA needs 4.5:1). This is every "Sign in", "Submit", "Review", "Continue" button in the product. |
| **Data layer** — unbounded Firestore reads | `getAllUsers()` and `getAllActivities()` read entire collections then slice client-side. Only 4 `limit()` calls exist across 36 `getDocs()` calls. |
| **Verification** — effectively no test coverage | One 34-line Playwright smoke spec for 48,906 lines. The project's own `HANDOFF.md` ranks this as risk #1. |

Everything below is grounded in a specific file and line. Nothing is inferred from screenshots.

**What I could not test** (no running instance, no credentials in this session): real network waterfalls,
actual Firestore latency, screen-reader announcement order in NVDA/VoiceOver, and real-device touch
behaviour. Findings in those areas are derived from code and are marked as such.

---

## 1. Scorecard

| Dimension | Score | One-line assessment |
|---|:---:|---|
| Visual design | 6.5/10 | Strong, distinctive brand. Undermined by 54 uncontrolled type sizes and contrast failures. |
| UI components | 6/10 | Excellent primitives exist but adoption is ~40%. Three different form patterns coexist. |
| UX & user journey | 5.5/10 | Learner journey is coherent; admin/CX journey is unaddressable (no URLs). |
| Information architecture | 5/10 | No search, no breadcrumbs, no pagination. Admin has 13 flat tabs. |
| Dashboard experience | 7/10 | Best area of the product. Real drill-down, honest empty states, validated chart ramps. |
| Functionality | 5/10 | Core loop works. Certificates, assessments, discussion, self-serve unlock: absent. |
| Micro-interactions | 6.5/10 | Reduced-motion respected in 10 places. Feedback is semantic. Some dead-end states. |
| Performance | **3/10** | Zero code splitting. Unbounded queries. Unpaginated lists. |
| Responsive design | 6/10 | Real mobile thought (safe-area insets, bottom nav) but 15 ad-hoc breakpoints. |
| Accessibility | **4/10** | Global focus ring exists; primary CTA contrast, modal traps, and labels fail. |
| Design system | 5/10 | Documented well. 81% of spacing declarations bypass the tokens. Two undefined tokens shipped. |
| Architecture | 5.5/10 | Clean service layer. Admin navigation held in `useState` instead of the router. |
| **Overall** | **5.4/10** | Strong foundation, launch-blocking gaps. |

---

## 2. Critical issues — must fix before production

### C-1 · Zero code splitting: 2.6 MB shipped on every route

**Problem.** The production build emits a single 1,800.30 kB application chunk (513.12 kB gzipped),
plus 532.91 kB Firebase and 236.38 kB CSS. `grep -rn "React.lazy\|Suspense" src` returns **nothing**.
[App.jsx](src/App.jsx) statically imports every page; [AdminPanel.jsx:36-42](src/components/admin/AdminPanel.jsx#L36-L42)
statically pulls in `ZohoIntegration` (1,331 lines), `StorageManager`, `MBWAdminDashboard`, `EventCalendar`,
and `AdminOverviewCharts` (which pulls all of Recharts).

A first-time learner opening `/auth/login` downloads and parses the entire Zoho CRM integration, the storage
manager, the admin charting stack, and hls.js — none of which they will ever have permission to see.

- **Severity:** 🔴 Critical
- **User impact:** On a 3G connection (~400 kbps effective), ~680 kB gzipped is **13–20 s** before the login
  form is interactive. Iron Lady's audience is predominantly mobile, predominantly India, frequently on
  mid-tier Android. This is the single worst experience in the product and it happens *before* the user has
  seen anything.
- **Business impact:** Login-screen abandonment is the highest-leverage funnel step in an LMS — it gates
  100% of activation and 100% of returning-session engagement. Google/SOASTA data puts bounce probability
  at +123% when load goes 1 s → 10 s.
- **Root cause:** [vite.config.js](vite.config.js) does vendor chunking (`react-vendor`, `firebase-vendor`)
  but the app itself was never route-split, and admin components are imported eagerly at module scope.
- **Fix:**
  1. `React.lazy` + `Suspense` for all six route groups in [App.jsx](src/App.jsx): auth, student, CX, admin,
     superadmin, portal. Fallback = existing `DashboardSkeleton`.
  2. Lazy-load `ZohoIntegration`, `StorageManager`, `AdminOverviewCharts`, `EventCalendar` inside `AdminPanel`
     — a tab is only mounted when selected, so it should only be *fetched* when selected.
  3. Lazy-load `WatchGatedVideo` so hls.js (~150 kB) is fetched only on lesson pages.
  4. Split the stylesheet. A single 236 kB CSS file is loaded in full for the login page.
- **Expected improvement:** Auth-route JS drops from ~513 kB gz to **~90–120 kB gz**. Estimated LCP on
  mid-tier Android/3G: **~14 s → ~3.5 s**.

```
Version A (current)                     Version B (proposed)
──────────────────────                  ──────────────────────
/auth/login                             /auth/login
  index.js       1,800 kB  ▓▓▓▓▓▓▓▓▓▓     auth.chunk.js     45 kB  ▓
  firebase       533 kB    ▓▓▓            firebase-auth    180 kB  ▓▓▓
  index.css      236 kB    ▓▓             base.css          38 kB  ▓
  ─────────────────────────                ────────────────────────
  ~680 kB gz · TTI ~14 s                   ~110 kB gz · TTI ~3.5 s
```

---

### C-2 · Primary CTA fails WCAG 1.4.3 AA — every button, every screen

**Problem.** [index.css:440-446](src/index.css#L440-L446) defines `.btn-primary { background: var(--primary); color: white }`.
Measured against the actual token value `#f52929`:

| Pair | Ratio | WCAG AA (4.5:1) |
|---|---:|---|
| `#ffffff` on `--primary #f52929` (every primary button label) | **4.01:1** | ❌ FAIL |
| `--primary` as link text on `#ffffff` (global `a` colour) | **4.01:1** | ❌ FAIL |
| `--primary` as link text on `--bg #f7f6e4` (light-mode page bg) | **3.68:1** | ❌ FAIL |
| `--primary` on `--surface #1e181a` (dark cards) | **4.36:1** | ❌ FAIL |
| `--il-gold #f5b301` on `#ffffff` (`--accent`) | **1.85:1** | ❌ FAIL |
| `--border #d4cfc0` on `#ffffff` (light) | 1.56:1 | ❌ FAIL (1.4.11, 3:1) |
| `--border #3d3234` on `--surface` (dark) | 1.42:1 | ❌ FAIL (1.4.11, 3:1) |

- **Severity:** 🔴 Critical
- **User impact:** Every call-to-action label in the product is below legible-contrast threshold for users
  with low vision, and for *anyone* on a phone in sunlight. Card and input borders are effectively invisible
  in both themes — users cannot see where a field begins.
- **Business impact:** WCAG 2.1 AA is a procurement precondition for corporate L&D buyers and a legal
  exposure in several jurisdictions. It also directly suppresses CTA click-through.
- **Root cause:** `#F52929` is the brand red and is genuinely non-negotiable per `COMPANY_CONTEXT.md`.
  The error is using it *as a text background at full strength* rather than deriving an accessible on-brand
  variant. `--il-red-deep #c8102e` already exists in the palette and is closer.
- **Fix — keeps the brand, passes AA:**
  ```css
  /* Button surface stays brand red; label darkens the surface, not the brand. */
  --primary-cta-bg: #d41f1f;   /* existing --il-red-hover; white on it = 5.06:1 ✅ */
  --primary-text:   #c8102e;   /* existing --il-red-deep; on #fff = 5.87:1 ✅ */

  .btn-primary { background: var(--primary-cta-bg); color: #fff; }
  a            { color: var(--primary-text); }          /* light theme */
  ```
  `--primary #f52929` stays exactly as-is for **non-text** uses: focus rings (3.68:1 passes the 3:1 focus
  requirement), progress fills, chart accents, active-tab underlines, brand marks. Nothing about the brand
  changes; only the two places where the red carries *text meaning*.
  Raise `--border` to `#c9c2ae` (light, 2.1:1 → still decorative) and add a dedicated
  `--border-strong` at 3:1 for input outlines.
- **Expected improvement:** 100% AA text compliance on interactive elements. Buttons remain visually
  identical to the eye — `#d41f1f` vs `#f52929` is a 6% luminance shift.

---

### C-3 · Admin and CX navigation is not addressable

**Problem.** [AdminShell.jsx:17](src/components/admin/AdminShell.jsx#L17) holds the active admin section in
`useState`, and [AdminPanel.jsx:75-99](src/components/admin/AdminPanel.jsx#L75-L99) declares 13 sections
(Overview, Users, Tickets, Progress, Activity, Calendar, Announcements, Courses, Resources, Batches, Zoho,
MBW Tasks, Storage). The URL stays `/admin` for all thirteen.
[CXDashboards.jsx:60](src/pages/cx/CXDashboards.jsx#L60) does the same for its three tabs.

Consequences, all reproducible:
- Browser **Back** exits the admin panel entirely instead of returning to the previous section.
- No section can be bookmarked, linked in Slack, or sent to a colleague ("go to Zoho CRM → Batch sync").
- **Page refresh silently resets to Overview**, losing an admin's place mid-task.
- Deep-linking from a notification into a specific admin section is impossible.

- **Severity:** 🔴 Critical
- **User impact:** Admins and CX staff are the highest-frequency users. Every accidental back-swipe on
  mobile destroys their context. Nielsen H3 (User control and freedom) and H7 (Flexibility) both violated.
- **Business impact:** Support/ops handoffs cost minutes per incident because state cannot be shared by link.
- **Root cause:** The admin panel predates the router adoption and was never migrated; `App.jsx` mounts
  `/admin` as a single leaf route with no children.
- **Fix:** Convert to nested routes — `/admin/:section` with `<Outlet />`, mirroring the `/cx` pattern
  already used correctly in [App.jsx:83-99](src/App.jsx#L83-L99). Same for CX dashboard tabs
  (`/cx/dashboards/:view`). This is a ~2-day change and removes ~40 lines of state plumbing.
- **Expected improvement:** Task-resumption after refresh 0% → 100%. Admin support handoff time down
  materially. Enables notification deep-links, which unlocks C-8's fix.

---

### C-4 · Unbounded Firestore reads — cost and latency scale linearly with the database

**Problem.** [userService.js:324-333](src/services/userService.js#L324-L333):

```js
export async function getAllActivities(limitCount = 100) {
  const snap = await getDocs(collection(db, ACTIVITIES));  // ← entire collection
  const items = snap.docs.map(...);
  items.sort(...);
  return items.slice(0, limitCount);                        // ← trimmed client-side
}
```

The `limitCount` parameter is a lie: the read is unbounded and the trim happens after every document has
been billed, transferred, deserialised, and sorted in the browser.
[userService.js:244-253](src/services/userService.js#L244-L253) `getAllUsers()` has the same shape with no
limit at all. Across `src/services/*.js` there are **36 `getDocs()` calls and 4 `limit()` calls.**

- **Severity:** 🔴 Critical
- **User impact:** Admin panel load time grows linearly and unboundedly. At 50k activity documents this is a
  multi-megabyte transfer and a multi-second main-thread sort on every admin page open.
- **Business impact:** Firestore bills per document read. 50k activities × ~20 admin loads/day ≈ **1M reads/day
  from one screen** — roughly $18/day, ~$550/month, for data that is thrown away. This is a live,
  compounding cost bug, not a hypothetical.
- **Root cause:** Client-side sorting was chosen to avoid creating composite indexes.
- **Fix:** `query(collection(db, ACTIVITIES), orderBy('createdAt', 'desc'), limit(limitCount))` and add the
  index to [firestore.indexes.json](firestore.indexes.json). For `getAllUsers`, paginate with
  `startAfter` cursors. Audit all 36 `getDocs()` sites.
- **Expected improvement:** Admin load reads: O(collection) → O(100). Cost reduction >99% on this path.
  Admin TTI improves by seconds at real data volumes.

---

### C-5 · Admin user list renders every user with no pagination or virtualisation

**Problem.** [AdminPanel.jsx:1010-1072](src/components/admin/AdminPanel.jsx#L1010-L1072) maps `filteredUsers`
directly to `<li>` elements. Each row mounts a `RoleSelect`, a conditional program `<select>`, and up to two
buttons. There is no pagination component anywhere in the codebase (`grep -rln "pagination"` → 0 results
outside a CSS comment).

The Zoho batch sync exists specifically to import learners at scale. At 5,000 learners this renders ~20,000
interactive DOM nodes in one synchronous commit.

- **Severity:** 🔴 Critical (at production data volume)
- **User impact:** Multi-second freeze, then a janky, unscrollable list. Search filters client-side over the
  full array on every keystroke.
- **Business impact:** The admin panel becomes unusable at exactly the moment the business succeeds at scaling
  enrolment.
- **Root cause:** Built and tested against a handful of seed users.
- **Fix:** Server-side pagination (25/page) driven by the same cursor work as C-4, plus a debounced
  server-side search. If the list must stay long, virtualise with `@tanstack/react-virtual`.
- **Expected improvement:** Constant-time render regardless of learner count.

---

### C-6 · The video watch-gate does not work, but the UI insists it does

**Problem.** [WatchGatedVideo.jsx](src/components/mbw/WatchGatedVideo.jsx) presents a completion gate:
*"Watch the full video to unlock submission."* Three defects:

1. **YouTube videos have no progress tracking at all.** The embed sets `enablejsapi=1`
   ([line 23](src/components/mbw/WatchGatedVideo.jsx#L23)) but no YouTube IFrame Player API listener is ever
   attached. `watchPercent` stays 0 forever. The only way forward is the honour-system button
   *"I finished watching"* ([line 201-211](src/components/mbw/WatchGatedVideo.jsx#L201-L211)) — yet the copy
   above it still claims progress gates the submission.
2. **Partial progress is never persisted.** [useTaskEngine.js:179-181](src/hooks/useTaskEngine.js#L179-L181)
   holds `watchProgress` in local React state; only `markWatchComplete` writes to Firestore. A learner who
   watches 85% of a 40-minute video and loses connection returns to **0%**.
3. **Videos autoplay muted.** [line 62-66](src/components/mbw/WatchGatedVideo.jsx#L62-L66) sets
   `autoPlay muted` on the native and HLS players. Playback is already user-initiated by the poster click,
   so `muted` serves no browser-policy purpose — it just means the learner presses play, sees motion, hears
   silence, and concludes the video is broken.

- **Severity:** 🔴 Critical
- **User impact:** Defect 2 is the worst: it silently destroys work on the exact connection profile the
  audience has. Defect 3 generates support tickets that look like "video has no sound".
- **Business impact:** Completion data derived from this gate is not trustworthy, so CX intervention
  targeting is built on bad signal.
- **Root cause:** Gate designed for self-hosted video; YouTube support added later without the API bridge.
- **Fix:**
  1. Load the YouTube IFrame API and poll `getCurrentTime()/getDuration()` every 5 s. If that is out of
     scope, **change the copy** to match reality — an honest "Mark as watched when you're done" is better
     than a false claim.
  2. Persist `watchProgress` to Firestore on a 15-second throttle and on `visibilitychange`/`pagehide`.
     Restore on mount so learners resume where they stopped.
  3. Remove `muted`; keep `playsInline`.
  4. Throttle `onTimeUpdate` (currently fires ~4×/s and calls `setState` each time) to 1 Hz.
- **Expected improvement:** Video-related support tickets down sharply; completion telemetry becomes usable;
  drop-off on long videos falls because progress survives connection loss.

---

### C-7 · Five modals trap no focus; one destructive action uses `window.confirm`

**Problem.** Only [ConfirmDialog.jsx](src/components/ConfirmDialog.jsx) and
[NotificationBell.jsx](src/components/NotificationBell.jsx) use the (well-written)
[useFocusTrap](src/hooks/useFocusTrap.js) hook. The rest do not:

| Component | `role="dialog"` | `aria-modal` | Focus trap | Scroll lock |
|---|:---:|:---:|:---:|:---:|
| `ConfirmDialog` | ✅ | ✅ | ✅ | ✅ |
| `NotificationBell` | ✅ | ✅ | ✅ | — |
| [`UserProgressModal`](src/components/admin/UserProgressModal.jsx#L91) | ✅ | ✅ | ❌ | ✅ |
| [`ParticipantListModal`](src/components/cx/ParticipantListModal.jsx#L12) | ❌ | ❌ | ❌ | ❌ |
| [`SessionReminderModal`](src/pages/cx/CXHome.jsx#L59) | ❌ | ❌ | ❌ | ❌ |
| [Admin sidebar drawer](src/components/admin/AdminShell.jsx#L31) | ❌ | ❌ | ❌ | ❌ |

The two unmarked modals are plain `<div onClick={onClose}>` backdrops — invisible to assistive tech, which
announces the page behind them as still active.

Separately, **destructive operations bypass the design system's own confirm dialog**:
[BatchMembersPanel.jsx:199](src/components/cx/BatchMembersPanel.jsx#L199) deletes an entire batch behind a
raw `window.confirm`, and [ZohoIntegration.jsx:262,299](src/components/admin/ZohoIntegration.jsx#L262)
gates CRM sync operations the same way. Native dialogs are unstyled, unbrandable, and on iOS Safari can be
suppressed entirely by the "prevent additional dialogs" checkbox — meaning **a destructive action can
proceed with no confirmation at all**.

- **Severity:** 🔴 Critical
- **User impact:** Keyboard and screen-reader users can tab out of a modal into the page behind it, then
  activate controls they cannot see. Batch deletion is irreversible.
- **Root cause:** `useFocusTrap` and `ConfirmDialog` were built after these components and never backfilled.
- **Fix:** Wrap all five in the existing `useFocusTrap`; add `role="dialog" aria-modal="true"
  aria-labelledby`; lock body scroll. Replace both `window.confirm` sites with `useConfirm()` — the pattern
  is already used correctly in 14 other places.
- **Expected improvement:** WCAG 2.1.2 (No Keyboard Trap) and 4.1.2 (Name, Role, Value) compliance;
  irreversible actions consistently protected.

---

### C-8 · Data-load failures are silent — permanent skeletons and blank states

**Problem.** [Home.jsx:84-88](src/pages/student/Home.jsx#L84-L88):

```js
} catch (e) {
  console.error(e);          // ← the user is told nothing
} finally {
  if (!cancelled) setLoading(false);
}
```

The page then renders "0 programs, 0 events, 0 pending" — **indistinguishable from a genuinely empty
account**. A learner whose network hiccuped is shown a confident, wrong dashboard with no retry.

[CourseDetail.jsx:298-314](src/pages/student/CourseDetail.jsx#L298-L314) is worse: `if (!course)` renders a
skeleton, and the fetch has **no `.catch()` at all**. A failed fetch or a bad `courseId` leaves a
**permanently animating skeleton** with no error, no retry, no back navigation beyond the browser button.

This directly violates the project's own rule in `CLAUDE.md`: *"every async view has skeleton/loading, empty,
and error states — never a frozen blank."*

- **Severity:** 🔴 Critical
- **User impact:** Nielsen H1 (Visibility of system status) and H9 (Help users recognise and recover from
  errors) both fail. A paying learner concludes their enrolment was lost.
- **Business impact:** Generates the highest-anxiety class of support ticket ("my course disappeared").
- **Root cause:** Error handling was added per-component; `Home` and `CourseDetail` predate the pattern.
  Note that [MBWPage.jsx:254-266](src/pages/student/MBWPage.jsx#L254-L266) and
  [CXHome.jsx:269-273](src/pages/cx/CXHome.jsx#L269-L273) **do** get this right — the pattern exists, it
  just was not applied everywhere.
- **Fix:** Add an `error` state to both pages, render `.alert-error` with a Retry button, and give
  `CourseDetail` a distinct "Course not found" state. Reuse the `MBWPage` sync-warning pattern verbatim.
- **Expected improvement:** Recoverable failures become recoverable. Eliminates a whole ticket category.

---

### C-9 · Effectively no automated test coverage

**Problem.** `e2e/` contains exactly one file: `mobile-smoke.spec.js`, 34 lines. There is no unit test
runner in [package.json](package.json), no CI configuration, and no component tests. The project's own
[HANDOFF.md](HANDOFF.md) lists *"No tests / no CI — flagged as #1 risk in QA_TEST_PLAN.md"* as open item #4.

- **Severity:** 🔴 Critical
- **Business impact:** Every one of the ~30 fixes in this document is a regression risk with no safety net.
  Shipping this to production means every deploy is a manual-QA event.
- **Fix (minimum viable, ~1 week):**
  1. Vitest + React Testing Library on the pure logic that already exists and is well-factored:
     `utils/programAccess`, `utils/mbwProgramUtils`, `utils/cxMetrics`, `utils/submissionReview`,
     `utils/cxDrilldown`. These are the highest-value, lowest-effort tests in the codebase.
  2. Playwright journeys: login → home → open program → open lesson → submit; CX login → review queue →
     approve; admin login → users → change role.
  3. `axe-core` in the Playwright run, failing the build on new violations.
  4. GitHub Actions running `npm run build` + both suites on PR.
- **Expected improvement:** Turns a manual-QA release process into an automated one.

---

### C-10 · Developer debug content and third-party PII shipped in production UI

**Problem.** [AdminPanel.jsx](src/components/admin/AdminPanel.jsx) renders, to any admin:

- A real personal email address as instructional copy — *"Have the user (e.g. **jaytiwari092@gmail.com**)
  sign in once"* ([line 689-690](src/components/admin/AdminPanel.jsx#L689-L690)).
- The same person's handle as a search placeholder: *"Search by name, email, or role (e.g. **jaytiwari**)"*
  ([lines 1000, 1090](src/components/admin/AdminPanel.jsx#L1000)).
- Hard-coded Firebase console deep links exposing the project ID:
  `console.firebase.google.com/project/**lmsironlady**/firestore/rules`
  ([lines 634, 672](src/components/admin/AdminPanel.jsx#L634)).
- Multi-paragraph instructions on publishing Firestore security rules, addressed to a developer, shown to
  business admins who have no Firebase access and cannot act on them.

Additionally, [index.html:12](index.html#L12) still ships **`<link rel="icon" href="/vite.svg" />`** — the
default Vite logo is the production favicon, while `public/iron-lady-logo.png` sits untracked in the repo.

- **Severity:** 🔴 Critical (trust/privacy) · 🟠 High (favicon)
- **User impact:** A named individual's personal email is displayed as sample data to every administrator.
- **Business impact:** For an organisation whose product is women's professional leadership, shipping a
  learner's personal email as filler copy is a direct brand and trust liability. The Vite favicon signals
  "unfinished" in every browser tab and bookmark.
- **Fix:** Replace all sample identities with `learner@example.com`. Move Firestore-rules guidance behind a
  superadmin-only diagnostics panel or the console. Ship the real favicon plus `apple-touch-icon`,
  `theme-color`, `<meta name="description">`, and Open Graph tags — none currently exist.

---

## 3. High-priority improvements

### H-1 · Typography has no scale: 509 declarations, 54 distinct values

`grep -c "font-size:" index.css` → **509**. Distinct values → **54**. `:root` defines
`--space-*`, `--radius-*`, and `--z-*` tokens but **no type tokens at all**.

Values in use below 1rem include `0.95, 0.92, 0.9, 0.88, 0.875, 0.86, 0.85, 0.82, 0.8125, 0.8, 0.78, 0.75,
0.72, 0.7, 0.6875, 0.68, 0.65, 0.62, 0.6, 0.58`. The smallest —
[`.event-calendar__chip` at 0.58rem](src/index.css#L3659) — is **9.3px**. Bottom-nav labels
([line 799](src/index.css#L799)) are 0.62rem = **9.9px**, on the primary mobile navigation.

`CLAUDE.md` mandates *"body text ≥16px on mobile."* Roughly 400 of the 509 declarations are below 16px.

- **Severity:** 🟠 High · **Impact:** Users over 40 — a large share of a leadership-program cohort —
  cannot comfortably read navigation labels. Visual hierarchy reads as noise because 0.8 vs 0.82 vs 0.85
  is a difference nobody can perceive but every maintainer must decide about.
- **Fix:** Define a 7-step scale and migrate. Ban raw `font-size` in review.
  ```css
  --text-xs:  0.75rem;  /* 12px — badges, table meta. Floor. */
  --text-sm:  0.875rem; /* 14px — secondary, captions */
  --text-base:1rem;     /* 16px — body. Default. */
  --text-lg:  1.125rem; /* 18px */
  --text-xl:  1.375rem; /* 22px */
  --text-2xl: 1.75rem;  /* 28px */
  --text-3xl: 2.25rem;  /* 36px */
  ```
  Raise the bottom-nav label to `--text-xs` (12px) and the calendar chip to `--text-xs`.
- **Expected improvement:** 54 decisions → 7. Legibility floor rises from 9.3px to 12px.

### H-2 · Fifteen ad-hoc breakpoints against a documented three

`index.css` uses `max-width` at **280, 320, 420, 480, 520, 560, 640, 720, 767, 768, 900, 960, 1023, 1180,
1240px** — while [index.css:38](src/index.css#L38) documents *"Reference breakpoints: 640 / 768 / 1024."*

The `767px` / `768px` pair is an active bug class: a rule at `max-width: 768px` and one at
`min-width: 768px` both apply at exactly 768px, and a `max-width: 767px` rule creates an
inconsistent boundary one pixel away. Layout at 768px is undefined behaviour depending on cascade order.

- **Severity:** 🟠 High · **Fix:** Collapse to `--bp-sm: 640px`, `--bp-md: 768px`, `--bp-lg: 1024px`
  (plus one optional `1240px` max-content width). Standardise on mobile-first `min-width` queries so
  boundaries never overlap.

### H-3 · 81% of spacing bypasses the spacing tokens

`var(--space-*)` appears **168** times. Raw-rem `padding`/`margin`/`gap` appears **699** times. The 8px
rhythm documented in `MASTER.md` is therefore not enforced anywhere — values like `0.65rem`, `0.55rem`,
`0.45rem`, `0.35rem`, `0.2rem` sit alongside it.

- **Severity:** 🟠 High · **Impact:** Vertical rhythm drifts between sections; two cards built by two
  different edits never align. This is the root cause of the "feels slightly off" quality that separates
  this from Linear/Stripe.
- **Fix:** Add `--space-2xs: 2px` and `--space-3xs`… no — instead add the two missing intermediate steps
  (`--space-xs2: 6px`, `--space-md2: 12px`) so the token set can actually express the real designs, then
  codemod the 699 raw values to the nearest token. Add a stylelint rule rejecting raw spacing.

### H-4 · Touch targets below the project's own 44px rule

[`.btn-sm`](src/index.css#L568-L574) is `min-height: 2.25rem` = **36px**, `font-size: 0.82rem` = **13.1px**.
It is the button used for nearly every CX and admin action: *Review*, *Remind*, *Edit*, *Delete*, *Open*,
*Refresh*. `MASTER.md` states *"Min height 44px on mobile primary CTAs"*; `CLAUDE.md` states
*"≥44×44px targets on nav and primary actions."*

The project's own [HANDOFF.md](HANDOFF.md) already tracks this: *"`.cx-count-btn` ~24px … modal close
buttons ~24px."*

- **Severity:** 🟠 High · **Principle:** Fitts's Law — acquisition time rises sharply below ~44px on touch;
  WCAG 2.5.8 sets 24px as the AA floor, and the 24px buttons noted in HANDOFF are **below even that**.
- **Fix:** `.btn-sm { min-height: 44px; font-size: var(--text-sm); padding-inline: 0.85rem }` on
  `(pointer: coarse)`; keep 36px on fine pointers. Fix the 24px icon buttons unconditionally.

### H-5 · Two design tokens are used but never defined

`--warning` is referenced **9 times** and defined **zero times**. Worse, it ships with **two different
fallback colours**: `#d97706` at [lines 7604-7636](src/index.css#L7604) and `#e8a020` at
[lines 8973-9339](src/index.css#L8973). "Warning" is therefore two different oranges in different parts of
the app, and neither adapts to light/dark.

`--foreground` is referenced **twice** ([9338, 9352](src/index.css#L9338)) with **no fallback**, so
`color: var(--foreground)` is invalid CSS and the declaration is dropped — the hover state on
`.mbw-section-card__pay-lock` changes its background but not its text colour.

- **Severity:** 🟠 High · **Fix:** Define `--warning` in both `:root`/`[data-theme='dark']` and
  `[data-theme='light']` blocks alongside `--danger`/`--success`. Replace `--foreground` with `--text`.
  These are shadcn/Tailwind token names that leaked in from a different design system.

### H-6 · Four components explicitly delete their focus ring

A correct global rule exists at [index.css:14248-14255](src/index.css#L14248-L14255):
```css
button:focus-visible, a:focus-visible, … { outline: 2px solid var(--primary); outline-offset: 2px; }
```
Four rules then override it with `outline: none` **inside a `:focus-visible` selector** — which is
unambiguously a WCAG 2.4.7 (Focus Visible) failure, not a styling choice:

- [`.streak-heatmap-card__share`](src/index.css#L5867)
- [`.mbw-section-card__pay-lock`](src/index.css#L9339)
- [`.cx-taskwise-name--btn`](src/index.css#L13333)
- [`.course-contact__msg`](src/index.css#L15119)

- **Severity:** 🟠 High · **Fix:** Delete `outline: none` from all four; the colour/background hover
  treatment they apply is a fine *addition* to the ring, not a replacement.
- **Related:** The global rule covers `button` and `a` but not `input`, `select`, `textarea`.
  `.field` inputs get a branded `box-shadow` ring ([line 2372](src/index.css#L2372)); `.admin-form` inputs
  ([line 1933](src/index.css#L1933)) get only the UA default. Not a failure, but visibly inconsistent —
  extend the branded ring to all form controls.

### H-7 · Emoji and bare text arrows used as UI icons

`CLAUDE.md`: *"Icons: lucide-react only — never emojis as UI icons."*

- [PortalGate.jsx:44,52](src/pages/portal/PortalGate.jsx#L44) uses **⚙️** and **🎓** as the icons for the
  two primary role-entry buttons — the very first screen an admin sees after login. Emoji render
  differently on every OS and are read aloud verbatim by screen readers ("gear emoji").
- Bare `←` / `→` characters are used as **icon-button labels with no accessible name** in
  [EventCalendar.jsx:222,229](src/components/admin/EventCalendar.jsx#L222),
  [LearnerCalendar.jsx:160,167](src/components/LearnerCalendar.jsx#L160), and six pagination buttons in
  [ZohoIntegration.jsx](src/components/admin/ZohoIntegration.jsx#L1145). A screen reader announces
  "left arrow, button" with no indication of what it navigates.

- **Severity:** 🟠 High · **Fix:** `<Settings />` / `<GraduationCap />` for PortalGate;
  `<ChevronLeft />` / `<ChevronRight />` with `aria-label="Previous month"` for the calendars. The
  ZohoIntegration pagination buttons already have text labels ("← Previous") so those only need the arrow
  swapped for an icon.

### H-8 · No search, no pagination, no breadcrumbs for learners

- **Search:** exists in exactly three places, all admin-side (admin user list ×2, Zoho). A learner in the
  **100 Board Members** program — which has 100+ tasks — has **no way to search** lessons, resources,
  recordings, or the calendar. The only navigation is scroll-and-expand.
- **Pagination:** zero implementations. Every list renders in full.
- **Breadcrumbs:** zero. `grep -rn "breadcrumb"` returns one CSS comment. In a
  Program → Section → Lesson → Submission hierarchy four levels deep, the only orientation cue is a single
  `← Courses` link.

- **Severity:** 🟠 High · **Principle:** Nielsen H6 (Recognition over recall) and H7 (Flexibility and
  efficiency). Hick's Law: an unsorted, unsearchable 100-item list makes selection time grow logarithmically
  with no shortcut.
- **Fix:** ⌘K-style command palette scoped to lessons + resources + recordings (the data is already loaded
  client-side in `taskStates`, so this is a UI-only change with no backend work). Breadcrumb component in
  `src/components/ui/`. Pagination on all admin/CX tables.
- **Expected improvement:** Time-to-lesson for a returning learner in a 100-task program: ~8 interactions
  → 2.

### H-9 · Placeholder-as-label forms

[Support.jsx:189-220](src/pages/student/Support.jsx#L189-L220) — the primary support-request form — uses
bare `<select>`, `<input placeholder="Subject">`, `<textarea placeholder="Describe your issue…">` with only
`aria-label`. No visible `<label>`.

This is a WCAG 3.3.2 (Labels or Instructions) failure and a classic usability defect: the label vanishes the
moment the user types, so anyone interrupted mid-form must clear the field to remember what it wanted.
[Profile.jsx:80-96](src/pages/student/Profile.jsx#L80-L96) does this **correctly** with the `.field`
pattern — so the product contains two contradictory form conventions, and the learner-facing support form
uses the worse one *and* the admin stylesheet (`admin-form`).

- **Severity:** 🟠 High · **Fix:** Migrate Support and all `admin-form` instances to the `.field` pattern.
  Three form systems (`.field`, `.admin-form`, bare) should become one.

### H-10 · `title` attribute is the only tooltip mechanism (105 uses)

Native `title` tooltips: never appear on touch devices, are not reachable by keyboard in most browsers,
cannot be styled, and appear after an uncontrollable ~1s delay. The admin sidebar depends on it for every
nav item's description ([AdminShell.jsx:62](src/components/admin/AdminShell.jsx#L62) `title={t.desc}`), as
does the CX program selector.

- **Severity:** 🟠 High for mobile and keyboard users (the descriptions are simply unavailable).
- **Fix:** A small `<Tooltip>` primitive in `src/components/ui/` using `aria-describedby`, triggered on
  hover **and** focus. For the sidebar specifically, render `t.desc` as visible secondary text — it is
  useful enough to not hide.

### H-11 · No offline awareness despite a mobile-first audience and local-fallback storage

`navigator.onLine` and `window.addEventListener('online'|'offline')` appear **nowhere**. Yet the codebase
contains `mbwLocalStore`, `bm100LocalStore`, and `submissionBlobStore` — a deliberate local-fallback layer
for exactly this scenario.

[MBWPage.jsx:254-266](src/pages/student/MBWPage.jsx#L254-L266) surfaces the *result*
("Some work is saved on this device only") which is genuinely good — but only *after* a failure, and only on
that one page. The learner is never told they are offline while it is happening.

- **Severity:** 🟠 High · **Impact:** A learner on the Mumbai metro fills in a strategy template, taps
  Submit, and gets an error with no explanation of why or whether their work survived.
- **Fix:** A global offline banner in `StudentLayout`, a queued-submission indicator, and automatic retry on
  reconnect. The storage layer to support this already exists — this is presentation only.

### H-12 · Guest mode is a dead end

[AuthPage.jsx:229-240](src/pages/auth/AuthPage.jsx#L229-L240) offers *"Continue as guest."* Every subsequent
surface is a lock screen: `GuestLockedPanel` on Course Detail, MBW, 100BM, Support, and Profile;
`GuestHomePreview` on Home. The only forward path is a `mailto:admin@iamironlady.com` link
([AuthPage.jsx:250](src/pages/auth/AuthPage.jsx#L250)).

- **Severity:** 🟠 High (conversion) · **Business impact:** The one funnel entry point for an unconvinced
  prospect terminates in an email client. There is no pricing page, no programme detail, no callback
  request, no self-serve enrolment — the entire acquisition path routes through a human.
- **Fix:** Either give guest mode real value (one genuinely unlocked sample lesson, real programme
  curricula, outcomes) with an in-app "Request access" form that writes a Zoho lead — or remove it.
  A preview that previews nothing is worse than no preview.

---

## 4. Medium-priority (🟡 UX enhancements)

| # | Issue | Evidence | Fix |
|---|---|---|---|
| M-1 | **No captions or transcripts on any video.** WCAG 1.2.2 is **Level A** — the lowest bar — and this is a *learning* product. | [`WatchGatedVideo.jsx`](src/components/mbw/WatchGatedVideo.jsx) — no `<track>` element anywhere | Add `<track kind="captions">`; require VTT on upload |
| M-2 | **Unthrottled 4 Hz state updates during video playback.** `onTimeUpdate` → `setWatchProgressForTask` → re-render on every tick | [useTaskEngine.js:179](src/hooks/useTaskEngine.js#L179) | Throttle to 1 Hz |
| M-3 | **Dark mode is hardcoded as the default**; `prefers-color-scheme` is never consulted | [index.html:5-11](index.html#L5-L11) | Default to system preference, persist explicit choice |
| M-4 | **Four redundant paths to the same workspace switch** — header link, PortalGate, Profile → Workspaces, admin sidebar | `StudentLayout`, `PortalGate`, `Profile`, `AdminShell` | Keep header + PortalGate; remove the Profile section |
| M-5 | **`CourseDetail.jsx` has corrupted formatting** — every line double-spaced across 636 lines, plus dead code: `resumeHref` is a three-branch ternary where two branches return the same value ([L264-272](src/pages/student/CourseDetail.jsx#L264-L272)) | [CourseDetail.jsx](src/pages/student/CourseDetail.jsx) | Reformat; add Prettier + a CI format check |
| M-6 | **`chart.js` and `react-chartjs-2` are dependencies but imported nowhere.** Recharts is the actual library | [package.json](package.json) vs `grep -rl "chart.js" src` → 0 | Remove both from `package.json` |
| M-7 | **Support tickets refetch on every auth token refresh** — `useEffect(..., [user])` depends on the Firebase user object identity, which is replaced hourly | [Support.jsx:53-55](src/pages/student/Support.jsx#L53-L55) | Depend on `user?.uid` |
| M-8 | **Ticket list has no status filter, no sort, no unread indicator.** A learner with 15 tickets scans linearly | [Support.jsx:238-256](src/pages/student/Support.jsx#L238) | Add status filter chips + unread dot |
| M-9 | **One `translateY` hover transform survives** despite `MASTER.md`'s explicit "no translateY" rule | [index.css:5629](src/index.css#L5629) | Use `scale` + `opacity` only |
| M-10 | **Google Fonts is a render-blocking third-party request** on every page load | [index.html:16-18](index.html#L16-L18) | Self-host WOFF2 with `preload`; saves ~200–400 ms on 3G and removes a CDN dependency |
| M-11 | **Not installable.** No manifest, no service worker, despite bottom-nav mobile-app IA and safe-area handling | no `manifest.json` in `public/` | Add manifest + icons; PWA install is the cheapest retention win available here |
| M-12 | **Zero learner-facing profile settings beyond display name** — no password change, no notification preferences, no avatar | [Profile.jsx](src/pages/student/Profile.jsx) | Add password change (Firebase `updatePassword`) and notification toggles |

---

## 5. Feature gaps (🟢 nice-to-have, but two are strategic)

Verified by exhaustive grep across `src/`:

| Feature | Status | Assessment |
|---|---|---|
| **Certificates** | ❌ 0 implementations (only an unrelated form-template string) | **Strategic gap.** MBW and 100BM are paid leadership programmes. Completion produces *nothing shareable*. A LinkedIn-shareable certificate is the single highest-ROI addition here — it is both the completion incentive and the organic acquisition channel, for a population that lives on LinkedIn. |
| **Discussion / comments** | ❌ 0 implementations | **Strategic gap.** These are *cohort-based* programmes with batches, moderators, and shared sessions. The peer network is a large part of what is being sold, and the LMS provides no surface for it. Learners will migrate to WhatsApp, and engagement data goes dark. |
| **Quizzes / assessments** | ❌ 0 implementations | Submissions and templates cover assignments; no knowledge checks |
| **Bookmarks / saved items** | ❌ 0 implementations | Cheap to add; high value at 100+ tasks |
| **Learner-facing payments** | ❌ Read-only from Zoho, admin-side only | Locked programmes dead-end at "Contact Iron Lady" — see H-12 |
| **Downloads** | ✅ Implemented | `TaskTemplateDownloads` works well |
| **Attendance** | ✅ Implemented | `attendanceService` + CX aggregation is solid |
| **Notifications** | ✅ Implemented | `NotificationBell` is one of the best components in the codebase — focus trap, `role="dialog"`, real empty state |

---

## 6. A/B analysis of the major surfaces

### A/B-1 · Login (`/auth/login`)

**Version A (current).** Single card. Email + password + "Forgot password?" + Sign in, then a divider, then
"Continue as guest", then a guest disclaimer, then "Need help? Contact Iron Lady support". No brand
proposition, no indication of what the product is. Ships 680 kB gz before the form is usable (C-1).

**Version B (proposed).**

```
┌────────────────────────────────────────────────────────────────┐
│  ┌───────────────────────┐   ┌──────────────────────────────┐  │
│  │  [Iron Lady mark]     │   │  Welcome back                │  │
│  │                       │   │                              │  │
│  │  "Master of Business  │   │  Email                       │  │
│  │   Warfare, 100 Board  │   │  ┌────────────────────────┐  │  │
│  │   Members, LEP"       │   │  │ you@example.com        │  │  │
│  │                       │   │  └────────────────────────┘  │  │
│  │  ✓ 3 programmes       │   │  Password                    │  │
│  │  ✓ Live cohorts       │   │  ┌────────────────────┬───┐  │  │
│  │  ✓ Your batch, your   │   │  │ ••••••••           │👁 │  │  │
│  │    moderator          │   │  └────────────────────┴───┘  │  │
│  │                       │   │            Forgot password?  │  │
│  │  (hidden < 768px)     │   │  ┌────────────────────────┐  │  │
│  │                       │   │  │      Sign in           │  │  │
│  │                       │   │  └────────────────────────┘  │  │
│  │                       │   │  New here? Explore programmes│  │
│  └───────────────────────┘   └──────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

| Why B wins | Principle |
|---|---|
| Split panel establishes what the product *is* before asking for credentials | Nielsen H1 — visibility of system status |
| Route-split bundle: ~110 kB gz instead of 680 kB → TTI 14 s → 3.5 s | Doherty threshold |
| `#d41f1f` CTA passes AA at 5.06:1 instead of failing at 4.01:1 | WCAG 1.4.3 |
| "Explore programmes" replaces a dead-end guest mode with a real path | Conversion |
| Left panel hidden below 768px — mobile keeps today's single-column form | Mobile-first |

**Measure:** login-screen bounce rate, time-to-first-successful-auth, guest→enquiry conversion.
**Predicted:** bounce −35–45% (dominated by the load-time fix alone).

---

### A/B-2 · Learner Home (`/app/home`)

**Version A.** [Home.jsx](src/pages/student/Home.jsx) renders, top to bottom: banner carousel → hero →
4 quick stats → continue card + schedule → programmes grid → announcements → last activity → pending
assignments → streak analytics. **Nine sections.** The primary action ("continue where I left off") is in
section 4, below the fold on every phone. Load failure renders a confident zeroed dashboard (C-8).

The quick-stat tiles are labelled `Open`, `Pending`, `Upcoming`, `Recent` with hints `of 3`, `assignments`,
`events`, `actions` ([Home.jsx:147-172](src/pages/student/Home.jsx#L147-L172)) — the labels alone are
ambiguous, and none of the four is clickable, so they inform without affording.

**Version B.**

```
┌──────────────────────────────────────────────────┐
│ Good morning, Priya                              │
│                                                  │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │ ← single, unmissable
│ ┃ CONTINUE  ·  MBW · Pre-Preparation           ┃  │   primary action,
│ ┃ Lesson 4 — The 27 Principles                 ┃  │   above the fold
│ ┃ ▓▓▓▓▓▓▓▓▓░░░░░░░░  9 of 21 milestones        ┃  │
│ ┃                          [ Resume lesson → ] ┃  │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│                                                  │
│ ┌──────────┬──────────┬──────────┐               │ ← 3 tiles, each a link
│ │ 2        │ Tue 3pm  │ 12 days  │               │
│ │ tasks due│ Live call│ streak   │               │
│ │        → │        → │        → │               │
│ └──────────┴──────────┴──────────┘               │
│                                                  │
│ Your programmes                    [see all →]   │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐     │
│ │ MBW  43%   │ │ 100BM 🔒   │ │ LEP  ✓     │     │
│ └────────────┘ └────────────┘ └────────────┘     │
│                                                  │
│ ▸ Announcements (2)                              │ ← collapsed by default
│ ▸ Recent activity                                │
└──────────────────────────────────────────────────┘
```

| Why B wins | Principle |
|---|---|
| 9 competing sections → 1 primary + 3 supporting. The next action is unambiguous. | Hick's Law; Nielsen H8 (aesthetic and minimalist design) |
| Every stat tile becomes a link to the queue that clears it — informing *and* affording | Fitts's Law; the pattern is already proven in [`CxKpiStrip`](src/components/cx/CxKpiStrip.jsx) |
| Continue card above the fold on a 360×640 viewport | Reduces scroll-to-action from ~2 screens to 0 |
| Secondary sections progressively disclosed | Gestalt — proximity and common region |
| Error + retry state replaces the silent zeroed dashboard | Nielsen H9 |

**Measure:** scroll depth to first action, clicks-to-lesson, day-2 return rate.
**Predicted:** clicks-to-resume 3–4 → 1; session-start latency down ~40%.

**Note:** `CxKpiStrip` already implements the correct interactive/read-only KPI distinction, with a good
explanatory comment. Version B is largely "apply the CX team's own solved pattern to the learner home."

---

### A/B-3 · Admin panel (`/admin`)

**Version A.** 13 flat tabs in a `useState`-driven sidebar. No URL. Refresh loses your place. Back exits the
panel. Full-collection Firestore reads on mount. Unpaginated user list. Firebase-console instructions
addressed to a developer.

**Version B.**

```
/admin/users?page=2&role=moderator&q=priya

┌───────────────┬────────────────────────────────────────────┐
│ WORKSPACE     │  Users                        [+ Invite]   │
│  Overview     │  ┌──────────────────────────────────────┐  │
│               │  │ 🔍 Search…    Role ▾   Batch ▾  ⟳    │  │
│ PEOPLE        │  └──────────────────────────────────────┘  │
│  Users     ●  │  ┌──────────────────────────────────────┐  │
│  Batches      │  │ Name        Email      Role     ⋯    │  │
│  Progress     │  ├──────────────────────────────────────┤  │
│               │  │ Priya S.    p@…       Learner   ⋯    │  │
│ CONTENT       │  │ Anita R.    a@…       CX        ⋯    │  │
│  Courses      │  └──────────────────────────────────────┘  │
│  Resources    │        ‹ 1  2  3 … 47 ›   25 of 1,164     │
│  Announceme…  │                                            │
│               │                                            │
│ OPERATIONS    │                                            │
│  Tickets   ③  │                                            │
│  Calendar     │                                            │
│  Activity     │                                            │
│               │                                            │
│ SYSTEM        │                                            │
│  Zoho CRM     │                                            │
│  Storage      │                                            │
└───────────────┴────────────────────────────────────────────┘
```

| Why B wins | Principle |
|---|---|
| `/admin/users?page=2&role=moderator` — bookmarkable, shareable, survives refresh, Back works | Nielsen H3 (user control and freedom) |
| 13 flat items → 5 labelled groups of 2–3 | Miller's law; Gestalt — common region |
| Pagination + server-side query: O(25) reads instead of O(collection) | Fixes C-4 and C-5 together |
| Row actions collapse into a `⋯` menu instead of 4 inline buttons | Reduces per-row scan cost; fixes horizontal overflow on tablet |
| Badge counts on Tickets surface work without navigation | Nielsen H1 |
| Firebase-rules guidance moves behind a superadmin diagnostics view | Right audience for the message |

**Measure:** admin task completion time, refresh-induced context loss (currently 100%), Firestore
reads/session.
**Predicted:** admin task time −30–40%; Firestore reads −99% on this path.

---

### A/B-4 · Lesson / video (`/app/mbw?lesson=…`)

**Version A.** Video with a stated watch-gate that does not function for YouTube, autoplays muted, loses
partial progress on reload, has no captions, and no persistent lesson navigation (the curriculum lives in a
drawer behind a button).

**Version B.**

```
┌──────────────────────────┬───────────────────────┐
│ MBW › Pre-Prep › Lesson 4│  CURRICULUM           │ ← breadcrumb (H-8)
│                          │  ▾ Pre-Preparation    │
│  ┌────────────────────┐  │    ✓ 1 Orientation    │
│  │                    │  │    ✓ 2 Mindset        │
│  │   ▶  [video]       │  │    ✓ 3 Positioning    │
│  │                    │  │    ● 4 27 Principles  │ ← persistent, not
│  │  ──────●─────  CC  │  │      5 Warfare Map 🔒 │   hidden in a drawer
│  └────────────────────┘  │  ▸ Quarter 1          │
│  ▓▓▓▓▓▓▓░░░  68% watched │  ▸ Quarter 2          │
│  ↻ Resumes where you     │                       │
│    left off              │                       │
│                          │                       │
│  Your submission         │                       │
│  ┌────────────────────┐  │                       │
│  │ …                  │  │                       │
│  └────────────────────┘  │                       │
│  [ ‹ Previous ] [ Submit & continue › ]          │
└──────────────────────────┴───────────────────────┘
```

| Why B wins | Principle |
|---|---|
| Progress persists and visibly resumes — the fix that matters most on unreliable mobile data | Nielsen H1; C-6 |
| Captions button present → WCAG 1.2.2 **Level A** compliance for a learning product | WCAG A |
| Curriculum persistent on ≥1024px (drawer retained on mobile) — position in a 100-task programme is always visible | Nielsen H6; Gestalt continuity |
| Breadcrumb gives 4-level orientation currently absent everywhere | Nielsen H6 |
| Unmuted playback after user-initiated start | Removes a whole support-ticket class |

**Measure:** lesson completion rate, video drop-off curve, "no sound" support tickets.
**Predicted:** completion +15–25%, driven mostly by progress persistence.

---

### A/B-5 · CX review queue (`/cx/home`, `/cx/reviews`)

**Version A.** Genuinely good. [CXHome.jsx](src/pages/cx/CXHome.jsx) has proper loading, empty, and error
states; `EmptyState` with real copy; sensible prioritisation (resubmits first, then oldest);
`CxKpiStrip` correctly distinguishes actionable from read-only tiles. Limitations: the attention list is
hard-capped at 8 items ([line 178](src/pages/cx/CXHome.jsx#L178)) with no "see all N", no bulk actions, and
no filtering. The project's own HANDOFF notes **47 submissions sitting unreviewed** — so the cap hides 39
of them.

**Version B.** Keep the design; add throughput.

| Change | Why |
|---|---|
| Replace the silent 8-item cap with "Showing 8 of 47 · View all" | Silent truncation reads as "you're nearly done" when 39 items are hidden |
| Checkbox multi-select + bulk Remind / bulk Approve | 47 items × 3 clicks = 141 interactions today |
| Filter chips: batch, task, age | The data is already in memory; UI-only change |
| Keyboard: `j`/`k` to move, `Enter` to open, `a` to approve | Power-user throughput — the CX team is the highest-frequency user cohort |
| Age indicator turns amber >3 days, red >7 | Surfaces SLA breach before escalation |

**Measure:** submissions reviewed per CX-hour, median review latency, backlog size.
**Predicted:** review throughput +2–3× on bulk-eligible items.

---

## 7. Persona walkthroughs

**First-time visitor.** Lands on `/auth/login`. Waits ~14 s on 3G (C-1). Sees a form with no explanation of
what Iron Lady LMS is. Taps "Continue as guest" → every screen is locked → only exit is `mailto:` (H-12).
**Verdict: fails.** This persona cannot self-serve at all.

**New participant (just paid, first login).** Enters the password from their welcome email. If it does not
match Zoho, they get a genuinely excellent, specific error message
([AuthContext.jsx:172-194](src/context/AuthContext.jsx#L172-L194)) — one of the best pieces of error copy in
the product. On success, lands on a 9-section Home where the actual next action is section 4 (A/B-2). No
onboarding tour, no "here's how your programme works." **Verdict: passes with friction.**

**Returning learner (mobile, commuting).** Opens the app, waits for the full bundle again on a cold cache.
Resumes a lesson, watches 85% of a 40-minute video, enters a tunnel — progress resets to 0 (C-6). Fills a
template, taps Submit, gets an error with no offline explanation (H-11). **Verdict: fails.** This is the
core loop and it is the most broken path in the product.

**Active learner (100 Board Members, 100+ tasks).** Cannot search for a lesson (H-8). Cannot bookmark.
Cannot see where they are beyond one `← Courses` link — no breadcrumb. Navigates by scrolling and expanding
accordion sections. **Verdict: degrades badly with programme size.**

**Trainer / moderator.** Lands in the CX workspace — the strongest area. Sees the attention queue, opens a
review, leaves feedback. Blocked by: 8-item cap hiding 39 of 47 items, no bulk actions, no filters (A/B-5).
**Verdict: passes, but throughput-limited.**

**CX team member.** Same as above, plus: cannot link a colleague to a specific dashboard tab (C-3), and
`ParticipantListModal` traps no focus (C-7). **Verdict: passes with friction.**

**Admin.** Cannot bookmark any of 13 sections. Refresh loses their place. User list may freeze at scale
(C-5). Shown Firebase console instructions they cannot act on, alongside a learner's personal email as
sample copy (C-10). Batch deletion sits behind a raw `window.confirm` (C-7). **Verdict: fails at
production scale.**

**Non-technical user.** Encounters "Firestore rules", "permission-denied", "canUseApp", "oobCode" in
admin-facing errors. Learner-facing copy is much better. **Verdict: passes on the learner side.**

**Mobile-only user.** Real mobile care exists — `env(safe-area-inset-*)`, `100dvh`, a bottom nav, a
`(hover: none) and (pointer: coarse)` block. Then: 9.9px nav labels (H-1), 36px `.btn-sm` and 24px icon
buttons (H-4), 15 conflicting breakpoints with an undefined 768px boundary (H-2), no PWA install (M-11),
and the full 2.6 MB bundle on every cold load. **Verdict: fails.**

**Accessibility-focused user.** Global `:focus-visible` ring exists and `useFocusTrap` is well-built — real
foundations. Then: the primary CTA fails AA everywhere (C-2), five modals leak focus (C-7), four components
delete their own focus ring (H-6), the support form has no visible labels (H-9), emoji and bare arrows serve
as icons and button names (H-7), and no video has captions (M-1, WCAG Level A). **Verdict: fails.**

---

## 8. Prioritised roadmap

### 🔴 Critical — block launch (est. 3–4 weeks, 1–2 engineers)

| # | Item | Est. | Unblocks |
|---|---|---|---|
| C-1 | Route-level code splitting + lazy admin tabs + CSS split | 3 d | Every mobile user |
| C-2 | Accessible primary/link colours; `--border` contrast; keep `#f52929` for non-text | 2 d | WCAG AA on all CTAs |
| C-4 | `limit()` + `orderBy` on all 36 `getDocs()` sites; Firestore indexes | 3 d | Cost + admin latency |
| C-5 | Server-side pagination on admin user/activity lists | 2 d | Scale |
| C-6 | Persist watch progress; unmute; throttle; honest gate copy | 2 d | Core learner loop |
| C-8 | Error + retry states on Home and CourseDetail | 1 d | Trust |
| C-7 | Focus-trap 5 modals; replace 3 `window.confirm` sites | 2 d | Keyboard/SR users |
| C-10 | Strip debug copy + third-party PII; ship real favicon and meta | 0.5 d | Brand/privacy |
| C-3 | Route-driven admin + CX dashboard navigation | 3 d | Admin/CX daily use |
| C-9 | Vitest on `utils/*`, Playwright journeys, axe-core, CI | 5 d | Every fix above |

### 🟠 High — first post-launch sprint (est. 2–3 weeks)

H-1 type scale · H-2 breakpoint consolidation · H-3 spacing-token codemod · H-4 touch targets ·
H-5 define `--warning`, remove `--foreground` · H-6 restore 4 focus rings · H-7 lucide icons for emoji and
arrows · H-8 command-palette search + breadcrumbs + pagination · H-9 unify on the `.field` form pattern ·
H-10 real tooltip primitive · H-11 offline banner + retry queue · H-12 make guest mode convert

### 🟡 Medium — quarter 2 (est. 2 weeks)

M-1 captions · M-2 throttle · M-3 respect `prefers-color-scheme` · M-4 dedupe workspace entry points ·
M-5 reformat `CourseDetail` + Prettier in CI · M-6 drop unused chart libs · M-7 `[user?.uid]` dep ·
M-8 ticket filters · M-9 remove the last `translateY` · M-10 self-host fonts · M-11 PWA manifest ·
M-12 password change + notification preferences

### 🟢 Strategic — next horizon

1. **Certificates.** Highest ROI in this list. Completion incentive *and* organic LinkedIn acquisition for
   an audience that lives there. ~1 week for generation + share.
2. **Cohort discussion.** These are batch-based programmes with moderators; the peer network is part of the
   product and currently has no home in it. Learners are already on WhatsApp — that engagement is invisible
   to you.
3. Self-serve enrolment (closes H-12 properly) · quizzes · bookmarks · learner-facing payment status.

---

## 9. What is already good — do not regress it

Worth stating plainly, because a document this long can read as uniformly negative:

- **[`CxKpiStrip`](src/components/cx/CxKpiStrip.jsx)** — the interactive/read-only distinction, with a
  comment explaining *why*. This is the standard the rest of the product should meet.
- **[`useFocusTrap`](src/hooks/useFocusTrap.js)** — correct implementation including focus restoration.
  The problem is adoption, not quality.
- **[`NotificationBell`](src/components/NotificationBell.jsx)** — focus trap, `role="dialog"`, real empty
  state, branded bottom sheet on mobile.
- **Chart colour ramps** ([index.css:82-98](src/index.css#L82-L98)) — single-hue, monotone-lightness,
  OKLCH-generated, validated, with a "do not hand-edit" note. Better than most production dashboards.
  (One caveat: the light ramp's lightest step measures 2.26:1 against white, below the 3:1 non-text
  minimum — tighten that end.)
- **First-login error copy** ([AuthContext.jsx:172-194](src/context/AuthContext.jsx#L172-L194)) — specific,
  actionable, distinguishes four distinct failure causes. Genuinely excellent.
- **Honesty about data** — `GuestHomePreview` refuses to show fake numbers; MBW surfaces
  "saved on this device only." The `CLAUDE.md` honesty rule is being followed where it counts.
- **Error boundaries** — `LayoutErrorBoundary` and `WidgetErrorBoundary` with `resetKey` are properly
  layered; a widget failure does not take down the page.
- **Mobile intent** — `env(safe-area-inset-*)`, `100dvh`, `(hover: none) and (pointer: coarse)`, and 10
  `prefers-reduced-motion` blocks. The instincts are right; the execution needs consolidation.

---

*Every finding above cites a file and line. Reproduce the quantitative claims with:*
```bash
npm run build                                          # C-1 bundle sizes
grep -rn "React.lazy\|Suspense" src | wc -l            # → 0
grep -c "font-size:" src/index.css                     # → 509
grep -oE "font-size: *[^;]+" src/index.css | sort -u | wc -l   # → 54
grep -oE "(max|min)-width: *[0-9]+px" src/index.css | sort -u  # → 15 max-widths
grep -c "var(--space" src/index.css                    # → 168
grep -cE "(padding|margin|gap): *[0-9.]+rem" src/index.css     # → 699
grep -rn "getDocs(" src/services/*.js | wc -l          # → 36
grep -rn "limit(" src/services/*.js | wc -l            # → 4
```
