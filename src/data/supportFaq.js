/*
 * Help topics.
 *
 * Every answer describes what this LMS actually does — the sign-in screen's own
 * reset link, the two reasons a phase is locked, where the join link appears.
 * Nothing here is a plausible-sounding support article: a wrong answer in a help
 * centre is worse than no answer, because the learner acts on it and then raises
 * the ticket anyway, having lost the time.
 *
 * Contact details come from COMPANY_CONTEXT.md, which records a live browse of
 * iamironlady.com. They are not invented and must not be edited to guesses.
 */

export const FAQ_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'account', label: 'Account' },
  { id: 'programmes', label: 'Programmes' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'technical', label: 'Technical' },
];

/**
 * `ticketCategory` is what the ticket form is set to when someone reads an
 * answer and still needs help — the handoff carries the subject with it.
 */
export const FAQ = [
  {
    id: 'reset-password',
    category: 'account',
    icon: 'key',
    tone: 'gold',
    q: 'How do I reset my password?',
    ticketCategory: 'login',
    intro: 'There are two ways, depending on whether you can still sign in.',
    steps: [
      'Locked out: on the sign-in screen, tap "Forgot password?" and enter the email you enrolled with. A reset link is sent to that address.',
      'Signed in: open your profile from the avatar in the top-right corner, choose the Password tab, and enter your current password followed by the new one.',
      'A new password must be at least 8 characters.',
    ],
    note: 'If the reset email does not arrive, check your spam folder before raising a ticket — it is the most common cause.',
  },
  {
    id: 'change-details',
    category: 'account',
    icon: 'user',
    tone: 'blue',
    q: 'How do I change my name or mobile number?',
    ticketCategory: 'other',
    intro: 'Both live in your profile, not in Settings.',
    steps: [
      'Click your avatar in the top-right corner.',
      'Edit your display name or mobile number under "Your details".',
      'Press Save changes.',
    ],
    note: 'Your email address is your sign-in and cannot be changed here. Email admin@iamironlady.com to have it changed.',
  },
  {
    id: 'phase-locked',
    category: 'programmes',
    icon: 'lock',
    tone: 'rose',
    q: 'Why is a phase locked?',
    ticketCategory: 'course',
    intro: 'Two different things can lock a phase, and the message on it tells you which.',
    steps: [
      'Progression: the phase before it is not finished yet. Complete every task in that phase and the next one opens on its own.',
      'Payment: the phase is part of the full programme and you have paid the registration amount so far. Completing payment opens it.',
      'A phase can be waiting on both. The lock message names what is outstanding.',
    ],
    note: 'Paying does not skip the order of phases — payment decides what you are eligible for, finishing a phase decides when you reach it.',
  },
  {
    id: 'paid-still-locked',
    category: 'programmes',
    icon: 'card',
    tone: 'green',
    q: 'I have paid, but content is still locked',
    ticketCategory: 'payment',
    intro: 'Your payment status reaches the LMS from the Iron Lady CRM rather than being set here.',
    steps: [
      'Sign out and sign back in — your access is refreshed when you sign in.',
      'If it is still locked, raise a ticket below with the date you paid and the amount.',
    ],
    note: 'Include the payment reference if you have one. It is the fastest way for the team to match the payment to your account.',
  },
  {
    id: 'next-task',
    category: 'programmes',
    icon: 'play',
    tone: 'blue',
    q: 'Where do I pick up where I left off?',
    ticketCategory: 'course',
    intro: 'Two places, both of them one click from anywhere.',
    steps: [
      'Dashboard: the "Continue learning" card opens the exact task you stopped at.',
      'Track Progress: each programme shows the module you are on, with the next task and a Resume button.',
    ],
  },
  {
    id: 'live-sessions',
    category: 'sessions',
    icon: 'calendar',
    tone: 'gold',
    q: 'Where do I find my live sessions?',
    ticketCategory: 'course',
    intro: 'Everything scheduled for you is on the Schedule page.',
    steps: [
      'Open Schedule from the sidebar to see the month, with your sessions listed beside it.',
      'The join link appears on a session once it has been added. Until then the button reads "No link yet".',
      '"Add to calendar" puts the session in your own calendar with the joining link in the invite.',
    ],
    note: 'Session times are shown in your device timezone, named at the top of the page.',
  },
  {
    id: 'reminders',
    category: 'sessions',
    icon: 'bell',
    tone: 'rose',
    q: 'How do I turn reminders on or off?',
    ticketCategory: 'other',
    intro: 'Reminders come from two separate places.',
    steps: [
      'In-app: Settings → Notifications. These are stored in this browser only, so they do not follow you to another device.',
      'WhatsApp: open your profile from the avatar and switch "Session reminders on WhatsApp" on or off. This needs your mobile number saved.',
    ],
  },
  {
    id: 'video',
    category: 'technical',
    icon: 'video',
    tone: 'blue',
    q: 'A video will not play',
    ticketCategory: 'course',
    intro: 'Worth trying in this order — the first two fix most cases.',
    steps: [
      'Refresh the page. A video that was interrupted mid-load will not recover on its own.',
      'Try a different browser or device, to tell a network problem from a browser one.',
      'If it still fails, raise a ticket naming the programme, the task and what you see.',
    ],
    note: 'Course videos are hosted for Iron Lady learners and are not downloadable.',
  },
  {
    id: 'data',
    category: 'account',
    icon: 'shield',
    tone: 'green',
    q: 'Who can see my submissions?',
    ticketCategory: 'other',
    intro: 'Your work is visible to you and to the Iron Lady team reviewing it.',
    steps: [
      'Submissions are reviewed by the CX team before a task counts as complete.',
      'Other learners cannot see your submissions.',
    ],
    note: 'For anything else about your data, email admin@iamironlady.com.',
  },
];

/** Only channels Iron Lady actually publishes. */
export const CONTACT_CHANNELS = [
  {
    id: 'email',
    icon: 'mail',
    label: 'Email the team',
    value: 'admin@iamironlady.com',
    href: 'mailto:admin@iamironlady.com',
  },
  {
    id: 'phone',
    icon: 'phone',
    label: 'Call',
    value: '+91 63608 23123',
    href: 'tel:+916360823123',
  },
  {
    id: 'site',
    icon: 'globe',
    label: 'iamironlady.com',
    value: 'Programme details and enquiries',
    href: 'https://iamironlady.com',
    external: true,
  },
  {
    id: 'linkedin',
    icon: 'linkedin',
    label: 'LinkedIn',
    value: 'Iron Lady',
    href: 'https://www.linkedin.com/company/iron-lady-1/',
    external: true,
  },
  {
    id: 'instagram',
    icon: 'instagram',
    label: 'Instagram',
    value: '@iamironladyil',
    href: 'https://www.instagram.com/iamironladyil/',
    external: true,
  },
  {
    id: 'youtube',
    icon: 'youtube',
    label: 'YouTube',
    value: '@iamironlady',
    href: 'https://www.youtube.com/@iamironlady',
    external: true,
  },
];

/** Matches a query against the question, its intro and its steps. */
export function searchFaq(list, query) {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((f) =>
    [f.q, f.intro, f.note, ...(f.steps || [])].filter(Boolean).join(' ').toLowerCase().includes(q)
  );
}
