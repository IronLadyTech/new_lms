# Old LMS (lms.iamironlady.com) — End-to-End Functional Reference

Captured from the live system to guide the **new_lms** rebuild. The old LMS is a **Moodle** installation branded "IL LMS / Iron Lady." This document records exactly what it does, end to end, so the new build can match or deliberately improve each behaviour.

---

## 1. Platform & access

- **Engine:** Moodle (URLs like `/course/view.php`, `/mod/assign/view.php`, `/mod/page/view.php`).
- **Login:** username + password, "Forgot password," and **Continue as a Guest**.
- **Branding:** custom landing image, "Login in to Iron Lady Account."

## 2. Programs (courses)

Three paid programs, each a Moodle course:

| Program | Course id | Positioning |
|---------|-----------|-------------|
| **Leadership Essentials Program (LEP)** | 16 | 4-week program + 1-year community learning |
| **100 Board Members Program (100BM)** | 17 | Fast-track to top management / board roles |
| **Master of Business Warfare (MBW)** | 26 | C-Suite in 2–3 years |

## 3. Dashboard (`/my/`)

Standard Moodle learner home:

- **Latest announcements** (site-wide forum; e.g. "Banglore Chapter").
- **Upcoming events** + link to calendar.
- **Program overview** — cards of enrolled courses, with search & sort.
- **Timeline** — next 7 days, by activity type/name.
- **Recently accessed courses.**

## 4. Course anatomy

Each course is a **Topic outline** of collapsible **sections**. Sections group content by day / quarter / session / theme. Every line item is a Moodle **resource** or **activity**.

### 4.1 Resource types in use

- **Page** — in-LMS HTML content (instructions, embedded videos, sample galleries).
- **File** — downloadable PDF / PPT / DOC / video (schedules, presentations, templates, reference material).
- **Folder** — a bundle of files (e.g. "Core Brand Story – Sample Videos").
- **URL** — external link (VIA survey, feedback forms, weekly engagement forms, "sign promises & agreements").

### 4.2 Activity types in use

- **Assignment** (`mod/assign`) — real submissions with **Opened/Due dates** and an **"Add submission"** button (file upload / online text). Used for VIA Survey upload, Resume, 0.5% League Roadmap, Strategy Assignment, day assignments.
- **Quiz** (`mod/quiz`) — graded quizzes (e.g. LEP "5 Daily Rituals Quiz," "27 Principles – Quiz" as Final Evaluation).
- **Forum** — Announcements at course top.
- **Profile** block — "Your Profile / Your Profile Details."
- **Certificate** section at course end with feedback links.

### 4.3 Completion tracking (per item)

Moodle *activity completion*, shown inline on each item:

- **"Mark as done"** — manual self-marking by the participant.
- **"To do: View"** — auto-completes when the item is opened.
- **"Receive a grade"** — completes once an assignment is graded.
- **"Receive a passing grade"** — completes only when the grade passes the threshold (used to gate progress).

### 4.4 Access gating (three layers)

1. **Paid/drip:** locked items show **"This is paid content."** (and variants like "Your Leadership Essentials Program is Paid"). Most content past the free intro is gated this way.
2. **Batch/cohort:** session recordings are segmented per batch and gated — e.g. **"This is paid content. You belong to Jan 2026."** A participant only opens their own cohort's recordings.
3. **Grade-based:** sections such as **"Gating Assignment Submission"** plus the "Receive a passing grade" condition gate later content behind completing/passing an assignment.

## 5. Content delivery patterns

- **Session recordings** are delivered as a **Page** holding multiple **embedded video players** ("Play Video"). Each batch has its own recordings Page (MBW: JAN'26 / MAY'26 / AUG'26; 100BM & LEP: "May Batch 2026", etc.). Example page listed: Orientation, Preparation, Huddle, Video CV, C-Suite Drama sessions.
- **Templates** (ERRC, Resume, Core Brand Story, Delta/Theme/Strategy tables) are distributed as **File** downloads or embedded in **Assignment**/Page descriptions — the participant fills them offline and uploads via an Assignment.
- **Community/guest sessions** sit in a dedicated section (industry-leader talks, showcases, "Sawaal" sessions) as Pages/Files, paid-gated.

## 6. Program structures (as-built)

### 6.1 LEP (id 16)
General (Announcements forum, Profile, Program Orientation: framework / access essentials / schedule) → **Pre-Program Preparation** (VIA Survey assignment) → **Day 1 Personal Transformation** (beliefs questionnaire, A-Game daily ritual, ERRC template, crucible statement, affirmations, Day-1 assignments) → **Day 2 Strategies & Tactics** (CoDeSeF, extreme responding, key relationships, purpose peg, Day-2 assignment) → **Day 3 Consolidation** (27 Principles video, 5 rituals, 0.5% League roadmap, mentors, feedback) → **Community Sessions Schedule** → **Weekly progress updates Wk1–5** (engagement form URLs) → **Day 4 Strength-Based Excellence** → **Build your Profile/Resume** (LinkedIn by Ms. Divya, resume template & samples, Jobseekers bootcamp recording, Prepare-your-Resume assignment) → **Day 5 Shameless Pitch** (instructions, key points, sample video galleries, feedback) → **Day 6 Guiding Stars** → **Day 7 Progress Review** → **Day 8 Graduation** (graduation prep, alumni LinkedIn invite, Alumni Speak) → **Final Evaluation** (5 Rituals Quiz, 27 Principles Quiz) → **Certificate** (feedback links).

### 6.2 100BM (id 17)
General (Announcements forum, Program Schedule) → **LEP Principles Revision** (27 Principles, 5 Rituals, Differentiated Brand, Scaling Smart) → **Pre-Prep before Session 1** (Core Brand Story template, Delta milestone table) → **Session 1 Image Creation** (PPT, core belief, brand-story sample doc/video **Folders**, 3 daily rituals) → **Working Session: Imperfect Brand Video** (script template) → **Resume & LinkedIn Branding** → **Session 2 4T Management & ERRC** (ERRC video + template) → **Working Session: Theme Management** → **Gating Assignment Submission** (Capability Matrix pre-session) → **Session 3 Breakthrough Capability** → **Session 4 Pitch Without Pitching** → **Session 5 Bing Fa Strategem** (strategy template + **Strategy Assignment** with "Receive a passing grade") → **Session 6 Real-time Board Member tactics** → **Session Recordings** (May Batch 2026) → **100 Board Members Community** (many industry-leader / showcase / Sawaal sessions).

### 6.3 MBW (id 26)
**Pre-Preparation videos** (27 Principles, 5 Rituals, Resume Prep video + template, ERRC video, LinkedIn Challenge by Rajesh, LinkedIn profile samples, mentoring, reference reading) → **Quarter 1** (schedule, presentation, C-Suite League roadmap, beliefs, core-story & target templates, case studies, weekly engagement, affirmations, superpower visualization, 3T video) → **Quarter 2–4** (schedules, presentations, roadmaps, strategy templates, case studies, weekly engagement, reference parts — paid-gated) → **Monthly Session Recordings** (per batch: JAN'26 / MAY'26 / AUG'26) → **C-Suite League Community** (guest sessions).

## 7. Standard Moodle features available

From user preferences: forums, calendar, messaging, notifications, content bank, blogs (incl. external), **badges** (gamification), editor/language/forum preferences, change password, edit profile.

---

## 8. Implications for the new_lms rebuild

What to **replicate** from the old LMS:

- Multi-program catalog (LEP, 100BM, MBW) with sectioned, day/quarter/session-based outlines.
- Per-item **completion tracking** and three **gating layers**: paid, batch/cohort, and grade-based.
- **Batch-segmented session recordings** delivered as a page of embedded videos.
- **Assignments** (submission + due date + grade/passing-grade completion) and **Quizzes** for final evaluation.
- Resource variety: page, file, folder, external URL.

What to **improve** (the new_lms differentiators):

- Replace self-reported **"Mark as done"** with **verified deliverables** — typed submissions, link submissions, the in-app **fillable ERRC template** (saved & re-editable), file uploads, and **in-LMS video recording** (retake/upload) for tasks like mirror practice.
- Add **admin batch-wise tracking** that shows, per task, who actually completed vs not — drill into a participant to see **name + phone** and all their saved submissions (the old LMS relies on Moodle's generic completion reports).
- **Weekly email reminders** for recurring networking tasks (the old LMS uses static weekly engagement-form URLs with no nudge).
- Keep all submitted content **permanently visible in the participant's own account**.

---

### Source pages reviewed
- Course catalog: `/course/index.php`
- LEP: `/course/view.php?id=16`
- 100BM: `/course/view.php?id=17`
- MBW: `/course/view.php?id=26`
- Recordings page (example): `/mod/page/view.php?id=1024`
- Assignment (example): `/mod/assign/view.php?id=990`
- Dashboard `/my/`, Preferences `/user/preferences.php`
