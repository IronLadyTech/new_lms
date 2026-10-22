/**
 * Mock payload for design reference / offline demos.
 * Live `/app/home-next` loads real data via `buildStitchHomeDashboard`
 * (`src/services/stitchHomeDashboardService.js`).
 */

export const STITCH_HOME_MOCK = {
  learner: {
    id: 'mock-learner-1',
    displayName: 'Alex Antony',
    firstName: 'Alex',
    roleLabel: 'Game Design Enthusiast, Learner',
    initial: 'A',
  },

  nav: {
    primary: [
      { id: 'dashboard', label: 'Dashboard', icon: 'layout-grid' },
      { id: 'browse', label: 'Browse Courses', icon: 'book-open' },
      { id: 'my-courses', label: 'My Courses', icon: 'folder' },
      { id: 'schedule', label: 'Schedule', icon: 'calendar' },
      { id: 'progress', label: 'Track Progress', icon: 'chart-column' },
    ],
    footer: [
      { id: 'settings', label: 'Settings', icon: 'settings' },
      { id: 'support', label: 'Help & Support', icon: 'headset' },
      { id: 'logout', label: 'Log Out', icon: 'log-out', danger: true },
    ],
    activeId: 'dashboard',
  },

  continueLearning: {
    eyebrow: 'Continue learning',
    title: 'Master of Business Warfare',
    nextLabel: 'Next: Section 4 · Negotiating from strength',
    progressPct: 63,
    progressLabel: '33 of 52 milestones',
    ctaLabel: 'Open MBW tasks',
    href: '/app/mbw',
  },

  statistics: [
    {
      id: 'in-progress',
      value: 2,
      unit: 'programmes',
      label: 'In progress',
      icon: 'pie-chart',
      tone: 'blue',
    },
    {
      id: 'completed',
      value: 1,
      unit: 'programme',
      label: 'Completed',
      icon: 'circle-check',
      tone: 'green',
    },
    {
      id: 'week',
      value: 6,
      unit: 'hrs',
      label: 'Avg. learning time',
      icon: 'stopwatch',
      tone: 'rose',
    },
    {
      id: 'certs',
      value: 1,
      unit: '',
      label: 'Certificates earned',
      icon: 'award-ribbon',
      tone: 'amber',
    },
  ],

  achievements: {
    badges: [
      { id: 'first', title: 'First submission', tone: 'gold', icon: 'trophy' },
      { id: 'streak', title: 'Week streak', tone: 'red', icon: 'flame' },
      { id: 'complete', title: 'Programme complete', tone: 'charcoal', icon: 'medal' },
      { id: 'locked', title: 'Locked', tone: 'muted', icon: 'lock' },
    ],
    leaderboard: {
      rank: '4th',
      name: 'Alex Antony',
      meta: 'Leadership Essentials · 12 of 12',
    },
  },

  hoursSpent: {
    totalLabel: '4.5 hrs',
    trendLabel: '20% up',
    trendDirection: 'up',
    periodLabel: 'This week',
    bars: [62, 28, 45, 70, 100, 84, 16],
    dayLabels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  },

  progressTracks: [
    { id: 'lep', title: 'Leadership Essentials', label: '12 of 12', filled: 6, total: 6 },
    { id: 'bm100', title: '100 Board Members', label: '7 of 24', filled: 2, total: 6 },
  ],

  announcements: [
    {
      id: 'a1',
      title: 'March cohort timings have moved',
      subtitle: 'Sessions now start 30 minutes later. · 2 days ago',
    },
    { id: 'a2', title: 'Office hours this Friday', subtitle: 'Optional Q&A · 4 days ago' },
    { id: 'a3', title: 'New reading list posted', subtitle: 'Module 3 prep · 1 week ago' },
  ],

  paymentBanner: {
    show: true,
    title: '100 Board Members is registered, not unlocked',
    subtitle: 'Complete payment to open the programme.',
    ctaLabel: 'Complete payment',
  },

  calendar: {
    year: 2022,
    month: 5, // June (0-indexed)
    monthLabel: 'June',
    /** day → program dots: 'mbw' | 'lep' | 'bm100' */
    dotsByDay: {
      1: ['mbw', 'lep', 'bm100'],
      4: ['mbw'],
      5: ['lep', 'bm100'],
      6: ['mbw', 'lep', 'bm100'],
      7: ['mbw', 'lep'],
      8: ['lep', 'mbw'],
      9: ['bm100'],
      11: ['mbw', 'lep', 'bm100'],
      12: ['mbw', 'lep', 'bm100'],
      13: ['mbw'],
      14: ['lep', 'bm100'],
      15: ['mbw', 'lep'],
      18: ['bm100'],
      19: ['mbw', 'lep', 'bm100'],
      20: ['lep'],
      21: ['mbw', 'bm100'],
      22: ['mbw', 'lep'],
      25: ['lep', 'bm100'],
      26: ['lep', 'mbw'],
      27: ['mbw', 'lep', 'bm100'],
      28: ['mbw', 'lep', 'bm100'],
      29: ['mbw', 'bm100'],
    },
  },

  events: [
    { id: 'e1', title: 'Grade 7 Tea Party', dateLabel: '8th July, 2022', program: 'mbw' },
    { id: 'e2', title: 'Geography Test - Europe as a continent', dateLabel: '8th July, 2022', program: 'lep' },
    { id: 'e3', title: 'PTA Meeting', dateLabel: '9th July, 2022', program: 'bm100' },
  ],

  activity: [
    {
      id: 'act1',
      kind: 'done',
      actor: 'You',
      verb: 'completed',
      target: 'Reading the room',
      when: 'Yesterday · 19:40',
    },
    {
      id: 'act2',
      kind: 'submit',
      actor: 'You',
      verb: 'submitted',
      target: 'Assignment 3',
      when: '3 days ago · 22:05',
    },
    {
      id: 'act3',
      kind: 'live',
      actor: 'You',
      verb: 'joined',
      target: 'Board readiness — live session',
      when: 'Last week · 11:00',
    },
  ],

  programmes: [
    {
      id: 'lep',
      title: 'Leadership Essentials',
      image: '/programs/lep.png',
      meta: [
        { icon: 'clock', label: '4 weeks' },
        { icon: 'layers', label: '2 live days + weekly sessions' },
      ],
      ctaLabel: 'Review',
      locked: false,
      href: '/app/lep',
    },
    {
      id: 'bm100',
      title: '100 Board Members',
      image: '/programs/100bm.png',
      meta: [
        { icon: 'clock', label: '6 months' },
        { icon: 'layers', label: 'Online cohort' },
      ],
      ctaLabel: 'Open tasks',
      locked: false,
      href: '/app/100bm',
    },
    {
      id: 'mbw',
      title: 'Master of Business Warfare',
      image: '/programs/mbw.png',
      meta: [
        { icon: 'clock', label: '1 year' },
        { icon: 'layers', label: 'Quarterly weekends + online' },
      ],
      ctaLabel: 'Enroll',
      locked: true,
      href: '/app/mbw',
    },
  ],

  practiceStreak: {
    current: 1,
    longest: 12,
    totalCorrect: 28,
    years: [2026, 2025, 2024],
    activeYear: 2024,
    todayStatus: 'No practice yet today',
    helpHref: '#',
  },
};

/** Async-shaped loader so a future API swap is a one-line change. */
export async function fetchStitchHomeDashboard() {
  return STITCH_HOME_MOCK;
}
