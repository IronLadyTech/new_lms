# DESIGN_ANALYSIS — Behance "LMS for IT school" (Peafowl IT school)

> **Source:** https://www.behance.net/gallery/185262661/LMS-for-IT-school
> **Designer:** Lena Kondratieva, 2023 · Figma
> **Method:** All 27 project modules downloaded and inspected visually (not OCR/summary).
> **License:** "No use is allowed without explicit permission from owner" — **inspiration only**, do not copy assets.
> **Supersedes:** `BEHANCE_LMS_REFERENCE.md`, which contained errors (see §0).

---

## 0. Corrections to the previous reference doc

| Previous doc said | Actually |
|---|---|
| Font = "Lexend Deca" | **Space Grotesk** (headings/accents) + **Lexend Deca** (body) |
| Product unnamed | Brand is **"Peafowl IT school"** |
| "Dashboard preview — calendar/timeline grid (Feb/Mar/Apr)" | No such screen. That was the *design-process timeline* graphic, not a product screen |
| Course catalog = "Buy now / Learn more" only | Two card variants: **full** (Try 6 lessons for free / Buy the whole course) and **compact** (Learn more / Buy now) |
| Lesson "inferred from case study" | Lesson, Homework, Webinar pages all exist as full hi-fi screens |
| Not mentioned | Next payment, Spent time chart, My rating, My achievements, Wallet, Chat, Notification settings, Dark mode toggle |

---

## 1. Global shell (present on every screen)

**Canvas:** 1440 × 1024. Two stretch 12-column grids — one for the fixed sidebar, one for content.
Sidebar **247px** · content **1129px** · gutters **24px** · outer margins **40px**.

### 1.1 Sidebar (fixed, full height)
Deep forest green surface. Top → bottom:
1. **Hamburger** collapse toggle (rounded square, lighter green)
2. **Logo** — peacock mark + "Peafowl / IT school"
3. **Primary nav:** `Dashboard` · `My courses` (chevron) · `Webinars` · `Calendar` · `Messages` (red/orange badge `3`) · `All courses` (chevron)
4. Spacer
5. **Secondary nav (bottom):** `Info` · `Support`

**Nav item states** (from the UI kit): default (white text) → hover (slightly lighter) → **active = solid orange pill**, white text, which *overhangs the sidebar's right edge* on the Dashboard screen. Variants exist with chevron and with badge.

### 1.2 Top header (white bar)
Left → right: **Search** input (magnifier, rounded) · **Date pill** `13 January, Fri` (calendar icon, green outline) · **"Non-stop studying" ring** showing `57/90` (streak metric) · **Notification bell** with orange dot · **`Hi, Sebastian!`** + avatar + chevron.

### 1.3 Page background
Off-white / very light warm grey, with soft peach + mint decorative blobs and small orange/green "sparkle" shapes bleeding in from the edges.

---

## 2. COURSE PAGE — full anatomy (priority)

Route: `My courses → Course`. Screenshot label: **"Course page"**.

```
┌───────────┬──────────────────────────────────────────────────────────────┐
│  SIDEBAR  │  Search   [13 January, Fri]   57/90 ring   🔔  Hi, Sebastian!│
│           ├──────────────────────────────────────────────────────────────┤
│ Dashboard │  ‹ back to "My courses"                                      │
│▸My courses│                                    ┌─────────────────────────┐│
│ Webinars  │  UX/UI. INTERFACE DESIGN AND       │ Curator: Christine  💬  ││
│ Calendar  │  DEVELOPMENT                       │ Tech.angel: Henry   💬  ││
│ Messages 3│  Students online: ◍◍◍◍ +14         └─────────────────────────┘│
│ All courses│                                                              │
│           │  ┌────────────────────────────┐   ┌──────────────────────┐   │
│           │  │ Module 1. Design basics  ⌃ │   │ ✦ Webinars  View all›│   │
│           │  │                 [Continue] │   │ Upcoming:            │   │
│           │  │ description…      ◔ 87 %   │   │ «Checkout forms»     │   │
│           │  │ ─────────────────────────  │   │ 15 February  19:00   │   │
│           │  │ Theme 1 Figma essentials   │   │ (In 11 days)[Schedule]│  │
│           │  │              100%  ✓       │   │ Recordings:          │   │
│           │  │ …Theme 7 UI design 100% ✓  │   │ «UX writing» [Watch] │   │
│           │  │ ▶ 8 Clickable prototyping  │   └──────────────────────┘   │
│           │  │              0%    ○       │   ┌──────────────────────┐   │
│           │  └────────────────────────────┘   │ ✦ My rating       ⓘ  │   │
│           │  ┌────────────────────────────┐   │ 🏆 Theoretical tasks │   │
│           │  │ Module 2. UX design—       │   │ 70,99/80    ◕ 99%    │   │
│           │  │  research              ⌄   │   │ Practical tasks      │   │
│           │  │                    [Start] │   │ 70,88/80    ◕ 97%    │   │
│           │  │ description…      (🔒)     │   │ Best than 92 % of…   │   │
│           │  └────────────────────────────┘   │           View more ›│   │
│           │  … Modules 3–6 (locked)           └──────────────────────┘   │
│           │                                   ┌──────────────────────┐   │
│           │                                   │ ✦ My achievements    │   │
│           │                                   │  ✿ Looking good!     │   │
│           │                                   │  ⬢ Great speed       │   │
│           │                                   │           View all › │   │
└───────────┴──────────────────────────────────────────────────────────────┘
```

### 2.1 Header zone
- **Back button:** `‹ back to "My courses"` — chevron + quoted destination.
- **H1:** `UX/UI. INTERFACE DESIGN AND DEVELOPMENT` — **all-caps**, Space Grotesk, heavy, near-black.
- **`Students online:`** label + overlapping circular avatars (white ring separators) + `+14` counter chip in orange outline.
- **Right-aligned people block:**
  `Curator:  Christine McCarthy  💬`
  `Tech.angel:  Henry Anderson  💬`
  Avatar + role label (grey) + name (bold) + message icon button. "Tech.angel" is the support/TA role.

### 2.2 Module accordion card — the centrepiece
White card, ~8–12px radius, 1px hairline border, generous internal padding.

**Row 1 (header):**
- `Module 1.` in regular grey + `Design basics` in bold black (two type weights on one line — this is the key trick).
- **Chevron** (⌃/⌄) sits *immediately after the title*, not at the far right.
- **Far right: CTA button**, and **below it a progress ring**.

**Four states (all documented in the UI kit):**

| State | Chevron | Button | Ring | Theme rows |
|---|---|---|---|---|
| **Active, collapsed** | ⌄ | `Continue` (filled dark green) | Orange ring, `87 %` centred | hidden |
| **Active, expanded** | ⌃ | `Continue` | Orange ring `87 %` | shown, real % + ✓ |
| **Locked, collapsed** | ⌄ | `Start` (disabled grey) | Grey circle with **padlock** | hidden |
| **Locked, expanded** | ⌃ | `Start` (disabled) | Grey padlock | shown but **greyed, all 0%, empty ○** |

**Row 2:** description paragraph, grey, 3–4 lines, ~65ch measure.

**Row 3+ (expanded): theme rows**, separated by hairlines:
```
Theme 1    Figma essentials                          100%   ✓(orange)
Theme 2    Basic UI elements                         100%   ✓
Theme 3    Components, autolayout, and variants.
           One of the most important tools           100%   ✓
Theme 7    UI design                                 100%   ✓
▶  8       Clickable prototyping                       0%   ○(empty)
```
- Left column `Theme N` in grey; title in dark.
- Right: **percent** then **status circle** — filled orange check when 100%, empty ring when 0%.
- The **current/next theme** loses the "Theme" word and gains a **▶ video icon** + bare number — a subtle "you are here" affordance.

**Modules observed (real labels):**
1. Design basics · 2. UX design — research · 3. UI design — mobile app design. Creating an app for both Android & IOS systems · 4. Web interfaces · 5. Portfolio cases on Behance · 6. Employment

### 2.3 Right sidebar — three stacked widget cards
Each has a **`✦` orange four-point star bullet** before its title and a `View all ›` / `View more ›` text-button top-right.

**A. Webinars**
- `Upcoming:` → `«Checkout forms»` · `15 February  19:00`
- Chip `In 11 days` (orange outline pill) + `Schedule` button (green outline)
- `Recordings:` → `«UX writing»` · `Took place: 01/02/23  19:00-21:00` + `Watch` button
- Note the **«guillemets»** used for all event/lesson titles.

**B. My rating** — sub-label `on this course for the whole time`, ⓘ info icon.
- `🏆 Theoretical tasks` → `Points 70,99 / 80` + **green** ring `99%`
- `Practical tasks` → `Points 70,88 / 80` + **purple** ring `97%`
- Social-proof line: `Best than 92 % of students on this course for the whole time` (the `92 %` in orange)
- `View more ›`
- **Insight:** ring colour encodes *metric type* (orange = module progress, green = theory, purple = practice), not status.

**C. My achievements** — gamification badges as coloured geometric medallions:
- Purple flower `Looking good!` / `Welcome`
- Green hexagon rocket `Great speed` / `Powerful start`
- `View all ›`

---

## 3. LESSON PAGE

- **Breadcrumbs:** `My courses / UX/UI. Interface design / Module 1. Design basics / Theme 8. Clickable prototyping` (last crumb greyed = current)
- **H1:** course title (all-caps), repeated from course page
- **16:9 media area** — branded poster (Peafowl mark + "Production") with decorative bursts
- **Tab bar:** `Overview` · `Notes (0)` · `Materials & Links` · `Homework` · `Learning tools` — active tab has a boxed/underlined treatment, and **Notes carries a count**
- **Overview tab:**
  - `✦ About this course` — paragraph
  - `✦ Some numbers` — two-column spec list with 12px icons:
    `Skill level: Beginners` · `Students: 5734` · `Rating: 4,8 from 5` · `Lessons: 236` · `Hours: 62` · `Language: English` · `Subtitles: English, Ukrainian, Spanish`
- **Right rail — lesson list panel** (dismissible, has `✕`):
  - Header `8. Clickable Prototyping`
  - `▶ Lesson 1. Starting point & preview mode` (**active = orange text**)
  - `▶ Lesson 2. Screen connections` … `Lesson 5. Outro`
  - Footer: `← Previous theme` / `Next theme →` (**disabled state greyed** when unavailable)
- **Below the rail — promo card** with a *dashed ticket border* and a repeating `special offer  %  special offer` ribbon; contains a compact course card (`Basics of Material Design`, `114 lessons (39 h.) | 6 modules`, `Learn more`).

---

## 4. HOMEWORK PAGE

Same shell; `Homework` tab active.

- **Title row:** `✦ E-commerce website clickable filter` + status chip `Not submitted` (orange outline pill)
- **Meta row:**
  - `Q-ty of resubmission: 3`
  - `Hardness:` + a **3-segment difficulty meter** (orange pills)
  - `Submit by: 23/06/23 23:59 (in 5 days)` — date in **red**, relative time in grey
- **Brief:** paragraph + `Important:` bullet list of requirements
- **Submission card — `Add completed homework`:**
  - Textarea prefilled with a Figma URL
  - Helper text `Add Figma link, comment etc.` + character counter `0/150`
  - **Dropzone:** file icon, `Drop files here or click Upload` (Upload is a blue link)
  - **`File requirements:`** `Format: PNG` · `Max. file size: max. 5 MB`
  - Actions: `Cancel` (outline) + `Submit` (filled green)

---

## 5. WEBINAR PAGE

- `‹ back to "All Webinars"`
- **H1:** `WEBINAR "WORK WITH DEVELOPERS"`
- Subtitle: `Within the course "UX/UI. Interface design and development"`
- `Students online:` avatars + `+14`
- 16:9 video (live/recorded)
- Tabs: `Overview` · `Notes (0)` · `Materials & Links` (no Homework here)
- `✦ About this webinar` · `✦ Lector(s)` (avatar stack + names) · `✦ Took place: 01/02/23 19:00-21:00`
- **Right rail = live Chat panel** (dismissible `✕`): scrollable rows of avatar + bold name + timestamp + message.

---

## 6. DASHBOARD

`H1: DASHBOARD`. Widget grid, each widget titled with the `✦` star bullet.

| Widget | Contents |
|---|---|
| **Ongoing courses** (`View all ›`) | 2 mini course cards side by side |
| **Next payment** | chip `In 16 days`; `29 January │ 37 £`; note *"In order to have acces to your account please pay your monthly fee"*; `Proceed to payment ›` |
| **Upcoming webinars** (`View all ›`) | `«Checkout forms»` `15 February 19:00`, avatar stack + lector names, chip `In 2 days, 5 hours`; second row `«Work with developers»`, chip `In 11 days` |
| **Spent time** (`View all statistics ›`) | Line chart, legend `Last week` (toggle switch) / `This week`; range tabs `All time` \| **`Week`** \| `1 Month`; x-axis Mon–Sun with **current day (Fri) highlighted orange** |
| **You may also like** (`View all courses ›`) | Horizontal carousel of compact course cards + `‹ ›` arrows and dot indicators |

**Ongoing-course mini card:** rounded icon tile (dark green, e.g. `Ae`) · title · `Module «User Experience Research (UX research)»` · **orange progress bar** · `You've learned 4 modules from 14` · `Continue to study` (full-width filled green).

---

## 7. ACCOUNT SETTINGS

**Sub-navigation** (left column of the content area, orange icon+text when active):
`Personal data` · `Settings` · `Wallet` · `Language` · `Favorite` · `My certificates` · `Statistic`

The **profile dropdown** (from the header avatar) is a dark-green panel repeating these items + `Log out`, with a badge `5` on `Favorite`.

**Personal data:** `Your name (will be shown in your profile)` (first/last) · `Your name (for your certificate)` · `Date of birth` · `City` (search) · `Gender` (select) · `Contacts` (E-mail with edit pencil, `Phone number` with country-flag prefix) · `About you` textarea `0/150`. **Every field has a `Hide in a profile` checkbox.** Avatar with `Edit picture`, `Max.size: 5 MB`, `File type: JPG`. Actions `Cancel` / `Confirm changes`.

**Settings:**
- `Security settings` — current/new password with eye-toggles + rule text
- `Notification settings` — toggle rows grouped under `Messages and comments` (New message, Answer on your comment, Answer on your review, Your review has been rated) and `Homework` (Your homework has been checked, Homework due soon)
- `Suspend all notification for:` select `24 hours`
- `Color theme settings` — segmented `☀ Light mode` / `🌙 Dark mode` + `Auto dark mode from 22:00 to 07:00` + toggle
- `Delete account` — red text + red trash icon, isolated at the bottom

**Wallet:** `Purchases history` table (`Date | Transaction | Sum`, credits green `+ 80 £`, debits `- 1200 £`) + `View all ›`; `Payment method` with `Show my saved payment methods on the checkout step`; saved cards as **radio rows** (Mastercard/Visa + masked digits); `Or pay with:` PayPal + Apple Pay; `Add a new card` form.

---

## 8. UI KIT

### 8.1 Colour (sampled visually — approximate)
| Group | Swatches | Role |
|---|---|---|
| **Primary** | burnt `#B23A0B`, mid `#D9480F`, **main orange `#EE5A0E`**, peach `#FBD5C5` | active states, accents, progress, CTAs-secondary |
| **Secondary** | **deep green `#0C4F3E`**, teal `#17886B`, mint `#B9E5DA` | sidebar, primary buttons, headings |
| **Achromatic** | greys → black → white | text, borders, disabled |
| **Additional** | teal, lavender `#C9B6E4`, red, dark purple | tags, achievement badges, rating rings |

**Semantic use:** dark green = structure + primary CTA. Orange = *attention/active/progress*. Pastels = categorisation only.

### 8.2 Typography
- **Space Grotesk** — headings & accents. *"The retro poster-like font family fits the best for the needed atmosphere."*
- **Lexend Deca** — body. *"Nice round easy to read sans-serif."*
- H1s are **uppercase**.

### 8.3 Components (named as in the kit)
| Name | Detail |
|---|---|
| `Buttons_big` / `Buttons_small` | filled green · outline green · disabled grey (each ×2 rows = default/hover) |
| `Text_btn` | `View all ›` with and without chevron |
| `Calendar_btn` | `📅 13 January, Fri` |
| `Back to_btn` | `‹ back to` |
| `Filter unit` | `Sort by ⌄` select |
| `Chips` | `In 11 days` — orange outline **and** filled peach |
| `Teg_Chips` | `elementary` (peach) · `advanced` (mint) · `instrumental` (lavender) |
| `Indecator` [sic] | progress bar, orange fill on grey track |
| `Breadcrumb item` / `Breadcrumbs` | `My courses / UX/UI. Interface design / Design basics` |
| `Sidepan_btn_right` / `_left` | `Next theme →` / `← Previous theme` + disabled variants |
| Icons | **MDI**, 24px and 12px sets |
| Toggles / hearts / checkboxes / radios / expand / trash / badges | full state pairs |
| Pagination | `‹ › « »` + numbered |
| Inputs | password + eye toggle, helper text, search |
| Payment rows | Visa / Mastercard radio cards |
| `Elements` | `Curator: {name} 💬` / `Tech.angel: {name} 💬` |
| Module accordion | 4 states (see §2.2) |
| Course card | **full** and **compact** variants |
| Sidebar nav item | default / hover / active-orange / +chevron / +badge |

### 8.4 Course card anatomy
**Full variant:**
```
┌──────────┬──────────────────────────────────┐
│          │ Working with After Effects.   ♥  │
│    Ae    │ Basic course                     │
│ (dark    │ [elementary] [instrumental]      │
│  green)  │ You will learn to do create      │
│          │ animation with this great tool.  │
│          │ For whom is this course fit?…    │
├──────────┴──────────────────────────────────┤
│ 15 lessons (40 h.)  │  5 practical modules  │
├─────────────────────┬───────────────────────┤
│ Try 6 lessons free  │  Buy the whole course │
│      (outline)      │       (filled)        │
└─────────────────────┴───────────────────────┘
```
**Compact variant:** same head, `120 lessons (40 h.) | 5 practical modules`, actions `Learn more` (outline) + `Buy now` (filled). Heart = favourite (outline → filled red).

---

## 9. Information architecture (from the case study)

> *"Since the structure of the LMS is different from a regular website, there is no homepage. All pages of the top level are hierarchy-equal. From any page one can get to any other one. The conditional start of the entry is a dashboard."*

```
Sign In ─┬─ Sign Up
         ├─ Dashboard ── Tech support
         ├─ Calendar ─── Messages
         ├─ My courses ─ Notifications ─ Course ─ Module ─ Lesson
         │                                                └ Homework
         ├─ Webinars ─── Help ────────── Webinar
         ├─ All courses ─ Settings ─ Security / Language / Certificates / Favorite→Course / Statistics / Log out
         └─ Finance
```

---

## 10. UX principles worth stealing (not the pixels)

1. **Two type weights on one line** — `Module 1.` (grey regular) + `Design basics` (black bold). Cheap, high-clarity hierarchy.
2. **Progress is always answerable at a glance** — ring on every module, bar on every ongoing course, `%` on every theme row.
3. **Lock is a *state*, not an absence** — locked modules still render fully (title, description, expandable rows) but greyed with a padlock. Nothing is hidden; the path ahead is visible. This is what makes the course feel like a journey.
4. **Colour encodes meaning, never decoration** — orange = attention/progress; green = structure/confirm; ring colour distinguishes *metric type*.
5. **"You are here" markers** — the current theme swaps its label for a ▶ icon; the current weekday is orange on the chart; the active lesson is orange in the rail.
6. **Named humans, always reachable** — `Curator` and `Tech.angel` with one-tap message, on every course/lesson screen.
7. **Relative time beside absolute time** — `15 February 19:00` + `In 11 days`. Never one without the other.
8. **Counts on tabs** — `Notes (0)` tells you before you click.
9. **Requirements stated before the input** — `File requirements: Format PNG, max 5 MB` sits *next to* the dropzone, not in an error after failure.
10. **Gamification is quiet** — achievements and rating live in the sidebar, never blocking the learning column.

---

## 11. What the reference does NOT show (do not invent)

- **No mobile / tablet screens.** The entire case study is desktop 1440×1024. Any responsive behaviour is ours to design.
- **No empty states, loading/skeleton states, or error states.**
- **No dark mode screens** (a Light/Dark toggle exists in Settings, but no dark screens were designed).
- No accessibility annotations, focus states, or contrast documentation.

---

## 12. Mapping to Iron Lady LMS

Structure and interaction patterns transfer. **Brand does not.**

| Behance | Iron Lady equivalent |
|---|---|
| Forest green sidebar | Charcoal/deep surface; **red `#F52929`** as the accent |
| Orange active/progress | **Iron Lady red** (`--primary`) for active, **gold `#F5B301`** for progress/achievement |
| Space Grotesk + Lexend Deca | **Gemunu Libre + Fira Sans** |
| Module 1 → Themes | MBW **Section → Task/Lesson** (`mbwProgramStructure`) |
| Ring `87 %` per module | `computeSectionProgress` → we already have this data |
| Locked module + padlock | We already have `badge-locked` / `MBWProgramLessonRow` states |
| Curator / Tech.angel | **CX moderator** (we have `cx` role + `ParticipantListModal`) |
| Homework page | `TaskContent` + submission components (already 8 types) |
| `Try 6 lessons free / Buy` | Not applicable — no e-commerce in our LMS |
| Next payment / Wallet | Not applicable — payment is external (Razorpay/Zoho) |
| Webinars + Chat | Events/`LearnerCalendar`; no live chat exists |
| `Non-stop studying 57/90` | Our **streak analytics** (`useStreakAnalytics`) — currently buried at page bottom |

**Highest-value transfers, ranked:**
1. **Course page module accordion** with per-module ring + locked-state padlock + expandable theme rows *(we have all the data; our `MBWProgramJourney` is close but lacks the ring + CTA per section)*
2. **Streak ring in the header** — we compute it, we just don't surface it
3. **Curator/CX contact block** on course + lesson
4. **Tab bar on the lesson page** (Overview / Materials / Homework)
5. **Relative + absolute time** on every event
6. **Homework requirements shown beside the dropzone**

---

*Analysed July 2026 from the live gallery. Colours are visual approximations. Do not reuse Behance assets.*
