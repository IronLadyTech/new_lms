# Iron Lady LMS — QA Test Plan & Gap Analysis

> **Role:** Senior QA / Test Architect
> **Scope:** End-to-end functional, lock/unlock, resilience (high-traffic/low-server), edge cases.
> **Stack:** React 19 + Vite + Firebase (Firestore, Storage, FCM). No automated tests currently exist.

---

## 0. The biggest gap first: there is NO automated test infrastructure

`package.json` has only `dev` / `build` / `preview`. No test runner, no unit tests, no E2E, no CI gate. Every release is manually verified. **This is the #1 risk.**

**Recommended tooling (add before scaling):**
| Layer | Tool | Covers |
|---|---|---|
| Unit / logic | **Vitest** + React Testing Library | `useTaskEngine`, `cxMetrics`, `accessTiers`, `streakAnalyticsService`, `batchScope`, date utils |
| Integration | **Firebase Emulator Suite** | Firestore rules, auth, storage — test lock/access rules without touching prod |
| E2E | **Playwright** | Full user journeys per role (below) |
| Rules | `@firebase/rules-unit-testing` | Every `allow` in `firestore.rules` |
| Visual/a11y | Playwright + axe-core | Contrast, focus, dark mode, 375px |

Pure functions (`accessTiers.js`, `cxMetrics.js`, `mbwProgramUtils.js`, `useTaskEngine.computeTaskStates`) are **high-value, low-effort** first targets — they encode the lock logic.

---

## 1. Test environment & roles

Seed these accounts (Firebase emulator or a staging project — never prod):

| Role | `role` | `paymentStatus` | `batchId` | Purpose |
|---|---|---|---|---|
| Guest | — (session flag) | — | — | Preview-only |
| Learner (unpaid) | student | `unpaid` | none | No access |
| Learner (register) | student | `register` | Batch A (member) | Partial access |
| Learner (paid) | student | `paid` | Batch A (member) | Full access |
| Learner (paid, no batch) | student | `paid` | none | Batch-visibility edge |
| Learner (blocked) | student + `blocked:true` | paid | — | Block screen |
| Moderator (CX) | moderator | — | assigned to Batch A | CX app |
| Admin | admin | — | — | Admin panel + events |
| Super Admin | superadmin | — | — | Everything + deletion |

---

## 2. LOCK / UNLOCK SCENARIOS (explicit request) — full matrix

The app has **seven distinct lock mechanisms**. Each must be tested independently and in combination.

### 2.1 Lock type reference

| # | Lock | Trigger | Where enforced | Unlock condition |
|---|---|---|---|---|
| L1 | **Guest lock** | `isGuest` session | UI (`GuestLockedPanel`, page gates) | Sign in |
| L2 | **Blocked user** | `profile.blocked === true` | `StudentLayout` (`accessBlocked`) + rules | Admin unblocks |
| L3 | **Access-tier / payment lock** | `paymentStatus` unpaid/register | `accessTiers.js`, section gating | Zoho → `paid` |
| L4 | **Registration-payment section lock** | later sections while `register` tier | `isRegistrationPaymentLocked` | Full payment |
| L5 | **Sequential task lock** | previous task not complete | `useTaskEngine.computeTaskStates` | Complete previous task |
| L6 | **Date lock** | `task.unlockDate` in future | `isDateUnlocked` | Date passes (local midnight) |
| L7 | **Watch-gate** | `requiresWatch` + <90% watched | `WatchGatedVideo` / `canSubmit` | Watch ≥90% |
| L8 | **Resource lock** | `resource.locked === true` | Course/Progress resource list | Admin unlocks |
| L9 | **Batch-member read lock** | learner not in `memberIds` | Firestore `isGroupMember` | CX adds to batch members |

### 2.2 Lock/unlock test cases

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| LK-01 | Guest sees preview, not data | Start guest → Home | Banner + program **preview cards** + "Sign in to enroll"; no dashboard/streak; other pages show `GuestLockedPanel` |
| LK-02 | Guest cannot open a course | Guest → `/app/course/x` | Locked panel, no data fetched |
| LK-03 | Blocked user | Set `blocked:true` → login | `BlockedPanel` full screen; polls every 30s; unblock → auto-recovers |
| LK-04 | Unpaid learner | `paymentStatus:unpaid` | `hasAnyProgramAccess=false` → no program content; correct label "Awaiting registration payment" |
| LK-05 | Register-tier partial | `register` | Intro + initial tasks open; later sections show **registration payment lock** with tooltip |
| LK-06 | Paid full | `paid` | All sections unlockable; no payment lock |
| LK-07 | Sequential lock | Fresh paid learner | Task 1 = UNLOCKED, tasks 2..n = LOCKED with padlock + disabled "Start" |
| LK-08 | Sequential unlock | Complete task 1 | Task 2 flips to UNLOCKED; "Continue" targets it |
| LK-09 | Optional task skip | Task marked `optional` incomplete | Next task still unlocks (optional doesn't block) |
| LK-10 | Date lock | Task `unlockDate` = tomorrow | LOCKED even if previous complete; unlocks at local midnight |
| LK-11 | Watch-gate closed | `requiresWatch` task, watch 50% | Submission form disabled + "watch 90%" hint |
| LK-12 | Watch-gate open | Watch ≥90% | Form enables; `canSubmit=true` |
| LK-13 | Watch-only task | `WATCH_ONLY` | Reaching 90% marks COMPLETED (no form) |
| LK-14 | Resource lock | `resource.locked` | Shows "Locked" label, no Open link; unlocked ones open |
| LK-15 | Locked task deep-link | Navigate `?lesson=` to a LOCKED task | Shows locked alert + "Go to previous task" |
| LK-16 | Recording visibility | Learner NOT in `memberIds` | Recordings section hidden (read denied) — **known constraint**, verify graceful (no error) |
| LK-17 | Recording visible | Learner in `memberIds` | Recordings list shows with Watch links |
| LK-18 | Combined | Register-tier + sequential | Payment lock wins on later sections; sequential within accessible ones |

**Regression risk:** L5/L6/L7 all live in `computeTaskStates` — one change can break sequencing. Unit-test this function with a fixture of tasks × submission states.

---

## 3. END-TO-END TEST CASES by area

### 3.1 Authentication & routing
| ID | Case | Expected |
|---|---|---|
| AU-01 | Login (email/pw) | Redirect by role: student→`/app/home`, moderator→`/cx/home`, admin→`/portal` |
| AU-02 | Signup | Account created without protected fields (`paymentStatus`, `accessTier`, `provisionedFromZoho`) |
| AU-03 | Google sign-in | Owner email auto-elevated to superadmin |
| AU-04 | Guest start | Session flag set; guest UI everywhere |
| AU-05 | Logout | Confirm dialog (Profile) → session cleared → `/auth/login` |
| AU-06 | Deep link when logged out | Redirect to login, then back |
| AU-07 | Role escalation attempt | Student editing own `role`/`paymentStatus` → **rejected by rules** |
| AU-08 | Password reset (AuthActionPage) | Valid/expired/invalid token handled |

### 3.2 Student — Home / Course / Lesson / Homework
| ID | Case | Expected |
|---|---|---|
| ST-01 | Home dashboard loads | Skeleton → hero, real stats, continue card, schedule |
| ST-02 | MBW progress on cards | Continue card + MBW course card show **real** `X of Y milestones` (not fake 100%) |
| ST-03 | Stat hint | Programs stat shows `of {total}` (not the old no-op) |
| ST-04 | Course detail (MBW) | Hero + contact block (if moderator) + How-it-works + module accordion + progress panel + upcoming + recordings + resources |
| ST-05 | Module accordion | Ring shows real %; 100% shows `100%` green; locked = disabled Start (no ring) |
| ST-06 | Lesson breadcrumb | `MBW / Module / Lesson`, links back |
| ST-07 | Submission types (×8) | text, link, editable-template (ERRC), file upload, video record/upload, recurring post, checklist, watch-only — each saves + reflects status |
| ST-08 | Review-required task | → UNDER_REVIEW; CX approves → COMPLETED; next unlocks |
| ST-09 | Checklist partial | Not all ticked → stays UNLOCKED (not complete) |
| ST-10 | Recurring post weekly | Meets `postsPerWeek` → COMPLETED for the week |
| ST-11 | Offline/slow submit | Save writes local first, syncs later; no data loss |

### 3.3 Student — Progress / Profile / Calendar / Support
| ID | Case | Expected |
|---|---|---|
| SP-01 | Progress | Skeleton; MBW rings; per-program bars (real "resources unlocked" for non-MBW); Lucide icons; activity log |
| SP-02 | Profile save success | Green success alert; profile refreshes |
| SP-03 | Profile save failure | **Red** error alert (regression: was green) |
| SP-04 | Sign-out confirm | Dialog appears; cancel keeps session |
| SP-05 | Calendar load error | `EmptyState` with **Retry** (not silent blank) |
| SP-06 | Support create ticket | Success notice via status (not string-match); ticket appears |
| SP-07 | Support reply/edit/delete | Delete confirm; resolved tickets read-only |
| SP-08 | Support mobile | List/thread stack ≤768px |

### 3.4 CX (moderator) app
| ID | Case | Expected |
|---|---|---|
| CX-01 | CX Home | Hero, stat pills, batches, task-wise toggle, pending reviews |
| CX-02 | Task-wise view | "By task" default; gold bars; done/pending counts open participant modal |
| CX-03 | Session reminder | Sends to batch; shows sent/skipped counts |
| CX-04 | Task reminder | Per-learner push; "Sent"/"No token"/"Failed" states |
| CX-05 | Batches create | New batch created with program badge |
| CX-06 | Batch Analysis | Stats, attendance, per-module bars, learner table, members panel, **recordings panel** |
| CX-07 | Dashboards charts | Donut (`% done` centre) + batch bars render **immediately, no blink**; plain labels |
| CX-08 | Charts with 0 data | Clear empty message, not blank frame |
| CX-09 | Task-by-task names clickable | Click name → "who hasn't completed" list |
| CX-10 | Batch filter | Filtering recomputes counts + charts |
| CX-11 | Review a submission | `/cx/review/:userId/:taskId` opens; approve/reject writes status |

### 3.5 Session recordings — end-to-end (new feature)
| ID | Case | Expected |
|---|---|---|
| RC-01 | CX add recording | Batch page → title + URL → Add → appears in list |
| RC-02 | URL normalize | `youtu.be/x` (no scheme) → `https://` prepended |
| RC-03 | CX remove | Confirm dialog → removed |
| RC-04 | Learner (member) sees it | Course page "Session recordings" → Watch opens link |
| RC-05 | Learner (non-member) | Section hidden, **no console error / crash** |
| RC-06 | Invalid URL | Rejected or normalized; never breaks page |
| RC-07 | Many recordings | Sorted newest-first; layout holds |

### 3.6 Admin / Super Admin
| ID | Case | Expected |
|---|---|---|
| AD-01 | Create/edit event with link | Event + `linkUrl` saved; learner sees on Calendar/Upcoming |
| AD-02 | Upload event image | Storage upload succeeds; fallback if fails |
| AD-03 | Announcements | Targeted announcements show for right users |
| AD-04 | Tickets manager | Assign/resolve flows |
| AD-05 | User admin | Block/unblock, role change (within allowed set) |
| AD-06 | Super admin delete user | Only superadmin; cascade/orphan handling verified |
| AD-07 | Zoho sync | Payment status maps to access tier correctly; no revert bug |

### 3.7 Streak / analytics
| ID | Case | Expected |
|---|---|---|
| AN-01 | Header streak ring | Shows current streak, fills toward personal best; guest hidden |
| AN-02 | Streak timezone | Uses Asia/Kolkata consistently; day boundary correct |
| AN-03 | Live vs fallback | Firestore listener works; on rules failure → polling fallback + warning |

---

## 4. HIGH-TRAFFIC / LOW-SERVER — alternatives & resilience

Firestore is serverless (auto-scales), so "server down" is rare — but **read/write cost and unbounded queries** are the real risks at scale, plus client performance.

### 4.1 Problems found (scale risks)
| Area | Issue | Impact at scale |
|---|---|---|
| CX metrics | Loads **all** submissions + all students, computes completion **client-side** every render | 1000+ learners × 30 tasks = huge reads + slow UI |
| `getUserActivities(uid, 500)` | Fetches up to 500 docs | Cost + latency per Home/Progress load |
| `getEvents()` / `getCourses()` | Fetch **entire** collections, no pagination | Grows unbounded |
| Header streak | `useStreakAnalytics` runs on **every** student page (global listener) | Many concurrent onSnapshot listeners = cost |
| Bundle size | main `1.5MB`, firebase `520KB` (no code-split) | Slow first load on poor networks |
| Real-time listeners | `subscribeSubmissionEvents` per user | Fan-out cost with high concurrency |

### 4.2 Alternatives / mitigations (recommended)
| Strategy | What to do |
|---|---|
| **Denormalized aggregates** | Store per-batch/per-task completion **counts** on the batch/task doc (updated on submit via Cloud Function). CX dashboards read a few aggregate docs instead of all submissions. **Biggest win.** |
| **Query limits + pagination** | `limit()` + cursor on activities, events, submissions. Never fetch whole collections. |
| **Composite indexes** | Add indexes for CX queries (by program/phase/status) to avoid slow scans. |
| **Offline persistence** | `enableIndexedDbPersistence()` — app keeps working on flaky/low connectivity (extends the existing local-first task engine to all reads). |
| **Firestore bundles / CDN cache** | Serve static-ish data (courses, tasks) as cached bundles via Firebase Hosting CDN. |
| **Code splitting** | Route-level `React.lazy` + `manualChunks` (build already warns >500KB). Split admin/CX/recharts out of the student bundle. |
| **Debounce/throttle** | Search, resize, scroll handlers. |
| **App Check + rate limiting** | Prevent abuse/DoS on writes (reminders, submissions). |
| **Reminders via queue** | Batch push notifications through a Cloud Task/queue, not synchronous loops, to avoid timeouts on large batches. |
| **Graceful degradation (already partly done)** | 4s timeout race + local fallback in `useTaskEngine` — extend this pattern (timeout + skeleton + retry) to CX + events. |
| **Media off-app** | Recordings/videos on YouTube/Drive (already done) — never serve large media from Firebase Storage. |
| **Monitoring** | Firebase Performance + Crashlytics + billing alerts on read spikes. |

### 4.3 "Low server / degraded" behaviours to TEST
| ID | Case | Expected |
|---|---|---|
| PF-01 | Slow Firestore (throttle 3G) | Skeletons show; task engine shows local data within timeout; no infinite spinner |
| PF-02 | Firestore read denied (rules/quota) | Graceful warning + fallback (task engine already does this); no white screen |
| PF-03 | Offline mid-session | Reads from cache; writes queue; reconnect syncs |
| PF-04 | Reminder to 500-learner batch | Completes or reports partial; no hang/timeout crash |
| PF-05 | 1000 learners on CX dashboard | Loads within budget (proves need for aggregates) |
| PF-06 | Concurrent submits | No lost writes; last-write-wins understood |

---

## 5. Cross-cutting checks

| ID | Case | Expected |
|---|---|---|
| CC-01 | Responsive 375px | No horizontal scroll; nav not covering content; charts reflow |
| CC-02 | Dark + light | Contrast ≥4.5:1 both; charts readable (grey "Not started" fixed) |
| CC-03 | Keyboard nav | All interactives reachable; focus-visible rings; skip link |
| CC-04 | Screen reader | `aria-label` on icon buttons; `role="alert"` errors; chart data has text alt |
| CC-05 | Reduced motion | Animations disabled; no essential info in motion |
| CC-06 | Timezone consistency | Streak (Asia/Kolkata) vs event dates (local) vs `toISOString` (UTC) — verify no off-by-one at day boundaries |
| CC-07 | Error boundary | A thrown render error shows a fallback, not a white screen (**gap: no error boundary exists**) |
| CC-08 | XSS / input | Titles, URLs, ticket text sanitized; `target="_blank"` has `rel="noreferrer"` (verified) |

---

## 6. Functional gaps found (fix + test)

| # | Gap | Severity |
|---|---|---|
| G1 | **No automated tests / CI** | Critical |
| G2 | **No React error boundary** — one bad render = white screen | High |
| G3 | CX completion computed from all submissions client-side (no aggregates) | High (scale) |
| G4 | Recordings visible only to `memberIds` learners (batchId-only learners can't) | Medium |
| G5 | Unbounded collection reads (events, courses, activities) | Medium (scale) |
| G6 | Admin charts still use `ResponsiveContainer` (same blank/blink bug fixed in CX) | Medium |
| G7 | Timezone mix (Kolkata / local / UTC) across streak, events, filters | Medium |
| G8 | Events writable only by admin — CX can't self-serve session events (by design, confirm intended) | Low |
| G9 | Guest data strictly static — no live previews (acceptable) | Low |
| G10 | No rate limiting on reminders/submissions (abuse/timeout risk) | Medium |

---

## 7. Suggested execution order

1. **Add Vitest** → unit-test `computeTaskStates`, `accessTiers`, `cxMetrics` (locks + tiers). Fast, catches the highest-risk logic.
2. **Firebase emulator + rules tests** → prove L2/L3/L9 and role escalation (AU-07) can't be bypassed.
3. **Playwright smoke** → AU-01..05, ST-01..08, CX-01..07, RC-01..05 per role.
4. **Load/degraded** → PF-01..06 (throttled + offline).
5. **Fix G2 (error boundary) and G6 (admin charts)** — quick, high value.
6. **Plan G3 aggregates** before onboarding large cohorts.

---

*Living document. Pair each test ID with an automated test as coverage is built.*
