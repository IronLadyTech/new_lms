# Iron Lady LMS — Re-audit (verification pass)

**Date:** 2026-08-11 · **Baseline:** `UX_AUDIT_2026-08.md` (2026-08-07)
**Method:** Re-ran every original verification command, rebuilt production, recomputed WCAG contrast from
current token values, executed the test suite, and reviewed the newly-added code for fresh defects.
**Excluded by request (strategic/product):** certificates, cohort discussion, quizzes, bookmarks,
learner payments.

---

## 0. Verdict

**The critical blockers are cleared. This is now launchable** — pending four items below, one of which is a
metric-correctness bug that would mislead the CX team from day one.

Of 34 in-scope findings: **27 fully fixed · 5 partial · 2 not fixed.** Twelve new items surfaced, all
introduced by the fix work itself. None is launch-blocking except **N-2**.

| Score | Before | After |
|---|:---:|:---:|
| Performance | 3/10 | **7/10** |
| Accessibility | 4/10 | **8/10** |
| Design system | 5/10 | **8.5/10** |
| Information architecture | 5/10 | **7.5/10** |
| Functionality | 5/10 | 6/10 *(unchanged — gaps are the excluded strategic items)* |
| **Overall** | **5.4/10** | **7.4/10** |

The design-system work is the standout. Spacing token adoption went from 19% to 91% and the type scale from
54 uncontrolled values to 7 tokens — that is the kind of change teams usually promise and never land.

---

## 1. Critical items — all verified fixed

### ✅ C-1 · Code splitting — fixed, with caveats

`React.lazy` now wraps all 20 route components; `<Suspense>` is correctly hoisted in
[App.jsx:58](src/App.jsx#L58) with a `DashboardSkeleton` fallback. The build emits ~40 route chunks.

**Measured `/auth/login` first load:**

| | Before | After |
|---|---:|---:|
| App JS | 513.12 kB gz | 83.81 kB gz |
| react-vendor | 17.87 | 17.87 |
| firebase-vendor | 125.26 | 125.36 |
| AuthPage chunk | — | 1.68 |
| CSS | 39.33 | 42.59 |
| **Total** | **695 kB gz** | **271 kB gz** |

**61% reduction.** Real and significant — but short of the ~110 kB gz I projected, because two things
still load on every route:

- `firebase-vendor` at **125 kB gz** is now 46% of first load. `AuthContext` statically imports
  `firebase/config`, so Firestore and Storage ship to the login page even though login only needs Auth.
  Splitting `firebase/auth` from `firebase/firestore`+`storage` in `manualChunks` would cut ~60 kB gz.
- The shared `index` chunk is **290 kB raw / 83.81 kB gz**. Worth one look at what landed there.
- CSS grew 236 → 276 kB (still one file, loaded in full at login).

Not a blocker. Flagging so the remaining 60% isn't assumed to be irreducible.

### ✅ C-2 · Contrast — fixed exactly as recommended

`--primary-cta-bg: var(--il-red-hover)` and `--primary-text: var(--il-red-deep)` added; `--border-strong`
introduced and adopted by both `.field` and `.admin-form` inputs. Brand red untouched for non-text use.

| Pair | Before | After | Needs |
|---|---:|---:|---|
| `.btn-primary` label | 4.01 ❌ | **5.23** ✅ | 4.5 |
| Link on `#ffffff` | 4.01 ❌ | **5.88** ✅ | 4.5 |
| Link on `--bg` cream | 3.68 ❌ | **5.40** ✅ | 4.5 |
| Input border (light) | 1.56 ❌ | **3.09** ✅ | 3.0 |
| Input border (dark) | 1.42 ❌ | **3.08** ✅ | 3.0 |
| Focus ring (both themes) | — | 3.68 / 4.70 ✅ | 3.0 |

One gap remains — see **N-3**.

### ✅ C-3 · Admin/CX navigation is addressable

[AdminShell.jsx:21-26](src/components/admin/AdminShell.jsx#L21) and
[CXDashboards.jsx:56-64](src/pages/cx/CXDashboards.jsx#L56) now derive tab state from `useSearchParams`.
Query params rather than nested routes, but functionally equivalent: bookmarkable, shareable, survives
refresh, Back works.

### ✅ C-4 · Firestore queries bounded

`getAllUsers` and `getAllActivities` now use `query(…, orderBy('createdAt','desc'), limit(n))`.
`limit(` count: 4 → **6**. Both `orderBy` clauses are single-field (auto-indexed), so the
`catch → unbounded read` fallback should never fire in practice. The `activities` composite index was added
to [firestore.indexes.json](firestore.indexes.json). See **N-4** for the silent 500-user cap.

### ✅ C-5 · Pagination — fixed

`USER_PAGE_SIZE = 25` with a "Showing 1–25 of N" control. Client-side over the fetched set, which is
bounded by C-4's `limit(500)`. Solves the DOM-explosion problem.

### ✅ C-6 · Video watch-gate — fully fixed, better than recommended

All four sub-defects resolved:
- **Persistence:** [useTaskEngine.js:111-161](src/hooks/useTaskEngine.js#L111) — 15 s debounced flush,
  **plus** `visibilitychange`, `pagehide`, and unmount flush. More thorough than I suggested.
- **`muted` removed** from both players.
- **Throttled** to 1 Hz in `emitProgress` ([WatchGatedVideo.jsx:148-157](src/components/mbw/WatchGatedVideo.jsx#L148)).
- **Honest copy** for YouTube: *"YouTube cannot track watch time automatically. When you have finished
  watching, tap 'I finished watching'."* Correct call.
- **Captions** (M-1) shipped: `<track kind="captions" default>` with `crossOrigin` handling.

### ✅ C-7 · Modal accessibility

`useFocusTrap` adopted in all 7 dialog surfaces including `AdminShell`'s drawer and the new
`LessonSearchDialog`. **`window.confirm` / `window.alert`: 0 remaining.**

### ✅ C-8 · Error states

`Home` has `loadError` + `EmptyState` + working `retryLoad`. `CourseDetail` distinguishes *not found* from
*load failed*, both with retry.

### ✅ C-9 · Tests and CI

4 unit suites, **17 tests, all passing** (1.22 s). `e2e/a11y-smoke.spec.js` runs `@axe-core/playwright`
against login and signup, failing on serious/critical violations. `.github/workflows/ci.yml` runs
unit + build + Playwright on push and PR.

### ⚠️ C-10 · Debug content — mostly fixed

Third-party PII (`jaytiwari092@gmail.com`, `e.g. jaytiwari`) **removed**. `index.html` now ships a real
favicon, `apple-touch-icon`, `theme-color`, description, manifest, and honest title.
**Still present:** hard-coded Firebase console URLs exposing project ID `lmsironlady` at
[AdminPanel.jsx:651](src/components/admin/AdminPanel.jsx#L651) and
[689](src/components/admin/AdminPanel.jsx#L689) — see **N-8**.

---

## 2. High-priority items

| # | Status | Evidence |
|---|:---:|---|
| H-1 Typography | ✅ **Fixed** | 7 `--text-*` tokens defined. Distinct values 54 → 20, of which 13 are legitimate one-off `clamp()` display headings. **496 of 524** declarations tokenised. **Zero** sub-0.7rem raw values remain (was 22 sites, smallest 9.3px). |
| H-2 Breakpoints | ✅ **Fixed** | 15 `max-width` values → **7 total** (`639/767/1023` max, `640/768/1024/1240` min). The 767/768 overlap bug is gone; boundaries no longer collide. |
| H-3 Spacing | ✅ **Fixed** | `var(--space*)` 168 → **949**. Raw-rem spacing 699 → **90**. Token adoption 19% → **91%**. |
| H-4 Touch targets | ✅ **Fixed** | `@media (hover:none) and (pointer:coarse)` blocks raise `.btn-sm`, `.icon-btn`, all modal close buttons, `.bottom-nav__item`, and row targets to 44px, while keeping 36px on fine pointers. |
| H-5 Undefined tokens | ✅ **Fixed** | `--warning` now defined per-theme (`#e8a020` dark / `#d97706` light). `--foreground` removed entirely (0 uses). |
| H-6 Deleted focus rings | ✅ **Fixed** | Zero `:focus-visible { outline: none }` remain. The 2 surviving `outline:none` are legitimate — `.field input:focus` substitutes a `box-shadow` ring, and `.progress-section__anchor` is a zero-height scroll anchor. |
| H-7 Emoji / arrow icons | ✅ **Fixed** | `PortalGate` uses `<Settings>` / `<GraduationCap>`. Calendar arrow buttons converted. Remaining `←`/`→` are decorative characters *inside* labelled text ("← Courses") or `aria-hidden` — not unnamed icon buttons. |
| H-8 Search / breadcrumbs / pagination | ✅ **Fixed** | New `Breadcrumbs.jsx` (correct `<nav aria-label>` + `<ol>` + `aria-current="page"`), `LessonSearchDialog.jsx` with ⌘K, admin pagination. See **N-5** for search ARIA. |
| H-9 Placeholder-as-label | ✅ **Fixed** | Real `<label htmlFor>` throughout Support, create + edit + reply forms. |
| H-10 Tooltips | ⚠️ **Partial** | `Tooltip.jsx` built correctly (hover **and** focus, `aria-describedby`) — but adopted in only 4 chart files. **109 `title=` attributes remain**, including the admin sidebar's nav descriptions, which stay invisible on touch. |
| H-11 Offline | ⚠️ **Partial** | `useOnlineStatus` + `OfflineBanner` are correct, but mounted **only in `StudentLayout`**. CX and admin users get no offline signal. |
| H-12 Guest conversion | ❌ **Not fixed** | See **N-6** — the new form still terminates in `mailto:`. |

---

## 3. Medium items

✅ **Fixed:** M-1 captions · M-2 throttle (1 Hz) · M-3 `prefers-color-scheme` now respected in the
inline theme script · M-4 workspace entry points deduplicated · M-5 `CourseDetail` reformatted (636 → 556
lines) · M-6 `chart.js` + `react-chartjs-2` removed from dependencies · M-7 `[user?.uid]` dependency ·
M-8 ticket status filters + unread indicator · M-10 fonts self-hosted via `@fontsource` (54 `@font-face`
rules bundled; **no third-party font request remains**) · M-12 password change via `updatePassword`.

⚠️ **M-11 PWA — shipped but non-functional.** See **N-1**.
⚠️ **M-5** — reformatted, but no Prettier config exists to prevent recurrence (**N-12**).

---

## 4. New findings

### 🟠 N-1 · The PWA manifest icon is a JPEG named `.png` — install will likely be blocked

`public/iron-lady-logo.png` is **not a PNG**. Its file signature is `FF D8 FF E0 … JFIF` — it is a
**1024×1024 JPEG**.

[manifest.webmanifest](public/manifest.webmanifest) declares that one file twice:
```json
{ "src": "/iron-lady-logo.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
{ "src": "/iron-lady-logo.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
```
Three problems: the declared `type` is wrong; the declared `sizes` (192, 512) match neither each other nor
the actual 1024×1024 (only valid for SVG); and JPEG has no alpha channel, so `purpose: "maskable"` cannot
render correctly. Chrome validates manifest icons before offering install — this configuration commonly
fails the installability check, meaning **M-11 delivered a manifest but not an installable app.**

There is also no caching service worker — `firebase-messaging-sw.js` handles push only, so the app has no
offline shell to pair with `OfflineBanner`.

- **Severity:** 🟠 High (silently negates the M-11 fix)
- **Fix:** Export real PNGs at 192×192 and 512×512 (plus a separate maskable with safe-zone padding),
  reference them individually. Verify in DevTools → Application → Manifest. Add a caching SW if offline
  reading is intended.

### 🟠 N-2 · The CX "Needs attention" metric is capped at 8 — it under-reports the backlog

[CXHome.jsx:199](src/pages/cx/CXHome.jsx#L199) applies `.slice(0, 8)` **inside** the `attentionItems` memo.
That truncated array then drives:

- the KPI tile value — [line 246](src/pages/cx/CXHome.jsx#L246) `value: attentionItems.length`
- the panel count badge — [line 305](src/pages/cx/CXHome.jsx#L305)

Your own `HANDOFF.md` records **47 submissions sitting unreviewed**. A CX member opening this dashboard sees
a headline metric reading **"Needs attention: 8"** and a list of 8, with nothing indicating the other 39
exist. The dashboard under-reports its primary operational metric by ~5×.

This is not a truncation nit — it is a **metric-correctness bug**. Capacity planning, SLA tracking, and the
decision to escalate all read off a number that is structurally incapable of exceeding 8.

- **Severity:** 🟠 High — the only remaining item I would hold a launch for
- **Fix:** Compute the full list, drive KPI and badge from `full.length`, render `full.slice(0, 8)`, and add
  *"Showing 8 of 47 · View all"* linking to `/cx/reviews`. One-line change to the memo, three-line change
  to the render.

### 🟡 N-3 · `--primary-text` is not theme-scoped — breadcrumb links fail AA in dark mode

`--primary-text: var(--il-red-deep)` (`#c8102e`) is declared once in the brand `:root` block
([index.css:14](src/index.css#L14)), **outside** both theme blocks, so it is the same value in light and
dark.

The global `a` rule handles this correctly — `[data-theme='dark'] a { color: var(--primary-on-dark) }`
([line 216](src/index.css#L216)) gives 7.71:1. But **four other consumers have no dark override**:

| Consumer | Dark-mode contrast | Needs |
|---|---:|---|
| `.breadcrumbs__link` ([15628](src/index.css#L15628)) | **2.97:1** ❌ | 4.5 (text) |
| `.guest-lock__email-inline` ([15896](src/index.css#L15896)) | **2.97:1** ❌ | 4.5 (text) |
| `.cx-taskwise-name--btn:hover` ([13414](src/index.css#L13414)) | 2.97:1 ❌ | 4.5 |
| `.guest-preview__outcomes li svg` ([15844](src/index.css#L15844)) | 2.97:1 | 3.0 (icon) |

Dark is the default theme for anyone whose OS preference isn't light, and breadcrumbs are a **new**
component from the H-8 fix — so this is a freshly-introduced AA failure on a brand-new surface.

- **Severity:** 🟡 Medium
- **Fix (one line):** move `--primary-text` into the theme blocks — `#c8102e` under `[data-theme='light']`,
  `var(--primary-on-dark)` (`#ff8a8a`, 7.71:1) under the dark block. All four consumers correct themselves.

### 🟡 N-4 · The 500-user cap is invisible

`getAllUsers(limitCount = 500)` silently returns the 500 most recent users. The pagination footer reports
*"Showing 1–25 of N"* where N is the **fetched** count, never the true total. At 800 learners, an admin sees
"of 500", searches only within those 500, and has no way to know 300 exist.

- **Severity:** 🟡 Medium (becomes High once Zoho sync passes 500 learners)
- **Fix:** Return a `hasMore` flag and show *"Showing 25 of 500+ — refine your search"*, or move search
  server-side with cursor pagination.

### 🟡 N-5 · `LessonSearchDialog` has half-implemented listbox ARIA

[LessonSearchDialog.jsx:80-99](src/components/ui/LessonSearchDialog.jsx#L80):

```jsx
<ul role="listbox">
  <li>                                    {/* ← breaks listbox→option parentage */}
    <button role="option">               {/* ← no aria-selected; overrides button role */}
```

`role="listbox"` requires `option` children to be direct descendants (or `<li role="presentation">`), every
`option` needs `aria-selected`, and a search-filtered listbox should be wired as a `combobox` with
`aria-controls` + `aria-activedescendant`. As written, a screen reader announces a listbox whose options
have no selection state — **more confusing than no ARIA at all**.

Also: no ↑/↓ arrow navigation (users must Tab through up to 25 results — unexpected for a ⌘K palette), and
results are silently capped at 15 (empty query) / 25 (filtered) with no count. In a 100-task programme an
empty search shows 15 of 100 with no indication.

- **Severity:** 🟡 Medium
- **Fix (simplest correct option):** delete `role="listbox"` and `role="option"` entirely. A `<ul>` of
  `<button>`s is semantically honest and fully keyboard-accessible. Then add ↑/↓/Enter handling and a
  *"15 of 100 lessons"* count. Full combobox pattern only if you want type-ahead announcement.

### 🟡 N-6 · Guest "Request access" still dead-ends in `mailto:` — and can fail silently

[GuestRequestAccess.jsx:34-39](src/components/guest/GuestRequestAccess.jsx#L34):

```js
window.location.href = mailto;
setSent(true);
```

The form collects name, email, programme interest, and a message — then discards all of it into a `mailto:`
draft and unconditionally shows a success state.

Two problems, and the first is worse than the original plain link:
1. **On a device with no mail client configured** (common on Android where Gmail is unlinked, and in most
   desktop browsers), `window.location.href = 'mailto:…'` does nothing at all. The user sees
   *"Your email app should open…"* while nothing opened. `setSent(true)` fires regardless of outcome.
2. **No lead is captured.** Unless the user finds the draft and presses send, the business receives nothing.
   A form that looks like a submission but performs none is a worse conversion surface than an honest link.

- **Severity:** 🟡 Medium (🟠 High as a business-conversion issue)
- **Fix:** Write the request to Firestore (a `leads` collection, or reuse `ticketService`) so it is captured
  server-side, *then* optionally offer the mailto as a secondary action. Keep the existing form UI — only
  the submit handler changes.

### 🟢 N-7 · `OfflineBanner` mounted only in `StudentLayout`

CX staff reviewing submissions and admins editing records get no offline warning. Add to `CXLayout` and
`AdminShell` — one import each.

### 🟢 N-8 · Firebase console URLs with project ID still shown to admins

Two surviving links to `console.firebase.google.com/project/lmsironlady/firestore/rules`, plus
rules-publishing instructions addressed to a developer, rendered to business admins who have no Firebase
access. Move behind a superadmin diagnostics view.

### 🟢 N-9 · `hls.js` still statically imported

`WatchGatedVideo` imports `Hls` at module scope, so it lands in a **575 kB raw / 176 kB gz** shared lesson
chunk (misleadingly named `useLessonSearchShortcut-*.js`). Every learner opening any lesson downloads the
full HLS streaming stack — including the majority whose videos are YouTube embeds.

Fix: `const Hls = (await import('hls.js')).default` inside the `isHls(videoUrl)` branch. Saves ~176 kB gz
for most lesson views.

### 🟢 N-10 · `Tooltip` lacks Escape-to-dismiss

WCAG 1.4.13 (Content on Hover or Focus) requires dismissal without moving pointer or focus. Add an
`Escape` keydown handler. Combine with the H-10 adoption work.

### 🟢 N-11 · Font build hygiene

`dist/` ships **54 woff2 files, 1.1 MB**, of which 30 are Cyrillic/Greek/Vietnamese subsets. `unicode-range`
means browsers never *download* those for English content, so **user-facing impact is nil** — this is build
and deploy weight only. One genuine trim: `main.jsx` imports `@fontsource/fira-sans/300.css`, but
`font-weight: 300` appears **zero times** in the stylesheet. Drop that import; consider the `latin-*`
subset entrypoints.

### 🟢 N-12 · No Prettier config

`CourseDetail.jsx` was reformatted by hand (M-5) but nothing prevents recurrence. Add `.prettierrc` and a
`format:check` step to the CI job that already exists.

---

## 5. What to do before launch

**Hold for:**
1. **N-2** — CX attention metric cap. ~10 lines. This is the one that misleads a human operator daily.

**Same-day, low risk:**
2. **N-3** — move `--primary-text` into the theme blocks (1 line, fixes 4 surfaces).
3. **N-1** — export real 192/512 PNG icons (no code change).
4. **N-6** — persist guest requests to Firestore before the mailto (handler-only change).

**First post-launch sprint:** N-4 · N-5 · N-7 · N-9 (easy 176 kB gz win) · N-8 · H-10 adoption ·
H-11 coverage · firebase-vendor split · CSS splitting.

---

## 6. Assessment

This was a genuinely strong remediation pass. Twenty-seven findings closed with verified evidence, several
implemented more thoroughly than recommended — the watch-progress persistence added `visibilitychange`,
`pagehide`, **and** unmount flushing where I suggested only the first two, and the touch-target work
correctly scoped to `pointer: coarse` rather than blanket-inflating desktop controls.

The pattern in the remaining twelve items is consistent and worth naming: **the mechanism was built
correctly, then under-adopted or under-verified.** `Tooltip` is right but used in 4 of 109 places.
`OfflineBanner` is right but mounted in 1 of 3 layouts. The manifest is right but points at a mislabelled
file. `--primary-text` is right but declared one block too high. `LessonSearchDialog` is right except its
ARIA is half-applied.

None of these would have survived a checklist that asked *"did I apply this everywhere it belongs, and did
I open the result and confirm it?"* The CI pipeline you just added is the right place to enforce that —
extend the axe smoke test past login/signup to the authenticated learner, CX, and admin shells, and most of
this class of defect stops reaching review.

*Verification commands:*
```bash
npm run build && npm test                                          # 17/17 pass
grep -c 'font-size:' src/index.css                                 # 524 (496 tokenised)
grep -oE 'font-size: *[^;]+' src/index.css | sort -u | wc -l       # 20 (13 are clamp)
grep -c 'var(--space' src/index.css                                # 949  (was 168)
grep -cE '(padding|margin|gap): *[0-9.]+rem' src/index.css         # 90   (was 699)
grep -rn 'window.confirm\|window.alert' src --include=*.jsx        # 0
grep -rn 'React.lazy\|lazy(\|Suspense' src | wc -l                 # 25
node -e "const b=require('fs').readFileSync('public/iron-lady-logo.png');console.log(b.slice(0,4))"
#   -> <Buffer ff d8 ff e0>  = JPEG, not PNG   (N-1)
```
