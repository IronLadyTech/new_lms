/**
 * The words of each LEP session reminder, per session. Title = the plain fact (what and when);
 * body = one line on what this session means for her. Written for women with 15+ years of
 * experience: peer to peer, no hype, no emojis, no exclamation marks (LEP Messages v6 rules).
 *
 * No Zoom link in the text: Android does not make links inside a notification tappable.
 * Tapping the notification opens her sessions, where the Join button is.
 *
 * {{name}} is her first name; when it is unknown, the "{{name}}, " opening is dropped.
 * {{time}} is the session's start time in IST, e.g. "9:00 AM".
 * Sessions not listed here fall back to the CMS rule's own text.
 */
const COPY = {
  S0: {
    '24h': ['Orientation is tomorrow at {{time}}', '{{name}}, block this hour for yourself. Your LEP journey starts here.'],
    '1h': ['Orientation starts in 1 hour', 'Wrap up work early. This hour is just for you.'],
    '15m': ['Orientation starts in 15 minutes', 'The leader you are becoming starts tonight. Join a few minutes early.'],
    live: ['Orientation is live', 'Your batch is gathering now. Tap to join.'],
  },
  S1: {
    '24h': ['Day 1 is tomorrow at {{time}}', '{{name}}, keep the day clear. The woman you are becoming starts here.'],
    '1h': ['Day 1 starts in 1 hour', 'Find a quiet room and keep your notebook close.'],
    '15m': ['Day 1 starts in 15 minutes', 'Bring the leader you want to be. She is closer than you think.'],
    live: ['Day 1 is live', 'Your transformation starts now. Tap to join your batch.'],
  },
  S2: {
    '24h': ['Day 2 is tomorrow at {{time}}', 'Tomorrow your big goal gets a plan. Keep your CoDeSeF sheet close.'],
    '1h': ['Day 2 starts in 1 hour', '{{name}}, yesterday you named the goal. Today you plan the climb.'],
    '15m': ['Day 2 starts in 15 minutes', 'What would you chase if you knew you could not fail? Bring that.'],
    live: ['Day 2 is live', 'Strategy day has begun. Tap to join.'],
  },
  S3: {
    '24h': ['Review session tomorrow at {{time}}', 'Bring what you have, not what is perfect. We will sharpen it together.'],
    '1h': ['Review session in 1 hour', 'Open your Day 1 and Day 2 work. Ten minutes is enough.'],
    '15m': ['Review session in 15 minutes', 'Note one place you want clarity. That is where you will grow.'],
    live: ['Your review session is live', 'Tap to join. Your Day 1 and Day 2 work is about to get sharper.'],
  },
  S4: {
    '24h': ['Brand session tomorrow at {{time}}', 'Notice what people come to you for. That is your brand.'],
    '1h': ['Brand session in 1 hour', 'Pick 3 words you want colleagues to say about you.'],
    '15m': ['Brand session in 15 minutes', '{{name}}, today you decide how the room remembers you.'],
    live: ['Brand session is live', 'Tap to join and start shaping how you are seen.'],
  },
  S5: {
    '24h': ['Shameless Pitch tomorrow at {{time}}', '90 seconds to ask for what you deserve. Write yours tonight.'],
    '1h': ['Shameless Pitch in 1 hour', '{{name}}, say it once to the mirror. You have earned the right to ask.'],
    '15m': ['Shameless Pitch in 15 minutes', 'Breathe. Brave beats perfect tonight.'],
    live: ['Shameless Pitch is live', 'Tap to join. Your ask deserves the room.'],
  },
  S6: {
    '24h': ['Progress check tomorrow at {{time}}', 'Think of one win since Day 1. Give yourself credit for it.'],
    '1h': ['Progress check in 1 hour', 'Bring one win and one place you are stuck. Both matter.'],
    '15m': ['Progress check in 15 minutes', '{{name}}, you have come further than you think.'],
    live: ['Progress check is live', 'Tap to join and see how far you have come.'],
  },
  S7: {
    '24h': ['Leadership Habits tomorrow at {{time}}', 'Which habit got you here? Which one takes you further?'],
    '1h': ['Leadership Habits in 1 hour', 'Bring the one habit your career owes the most to.'],
    '15m': ['Leadership Habits in 15 minutes', 'Small daily habits build big careers. Join a few minutes early.'],
    live: ['Leadership Habits is live', 'Tap to join.'],
  },
  S8: {
    '24h': ['Certification tomorrow at {{time}}', '{{name}}, four weeks of work. Tomorrow it gets its name.'],
    '1h': ['Certification in 1 hour', 'Remember who walked in on Day 1. Look at her now.'],
    '15m': ['Certification in 15 minutes', 'The room is waiting to celebrate you.'],
    live: ['Your certification is live', 'Tap to join. This one is yours.'],
  },
  FT: {
    '15m': ['Fast Track in 15 minutes', 'Optional. Missed something or want to go deeper? Join if you can.'],
    live: ['Fast Track is live', 'Optional. Drop in for as long as you can. Tap to join.'],
  },
  PTW: {
    '15m': ['Prepare to Win in 15 minutes', 'Optional, and worth it: an hour to set up your week.'],
    live: ['Prepare to Win is live', 'Optional. Tap to join and plan a winning week.'],
  },
};

/** Which reminder an event is: '24h' | '1h' | '15m' | 'live' | null. */
function slotOf(eventCode) {
  const c = String(eventCode || '');
  if (c === 'R-24h') return '24h';
  if (c === 'R-1h') return '1h';
  if (c === 'R-15m' || c.startsWith('OPT-R-15m')) return '15m';
  if (c === 'R-LIVE' || c.startsWith('OPT-R-LIVE')) return 'live';
  return null;
}

/** PTW2, PTW3, PTW4 share the Prepare to Win words. */
function copyKey(sessionCode) {
  const s = String(sessionCode || '');
  return s.startsWith('PTW') ? 'PTW' : s;
}

function render(text, vars) {
  const name = String(vars?.name || '').trim();
  let s = String(text);
  if (!name || name.toLowerCase() === 'there') {
    s = s.replace(/\{\{name\}\},\s*(\w)/, (_, c) => c.toUpperCase()).replace(/\{\{name\}\}/g, '');
  } else {
    s = s.replace(/\{\{name\}\}/g, name);
  }
  const time = String(vars?.time || '')
    .replace(/\s+/g, ' ')
    .replace(/\b(am|pm)\b/i, (m) => m.toUpperCase())
    .trim();
  return s.replace(/\{\{time\}\}/g, time).replace(/\s{2,}/g, ' ').trim();
}

/** { title, body } for this reminder and session, or null to use the CMS rule's text. */
function sessionCopy(eventCode, sessionCode, vars = {}) {
  const slot = slotOf(eventCode);
  const lines = slot && COPY[copyKey(sessionCode)]?.[slot];
  if (!lines) return null;
  const [title, body] = lines;
  if (slot === '24h' && !String(vars.time || '').trim()) return null; // no time: CMS text instead
  return { title: render(title, vars), body: render(body, vars) };
}

module.exports = { sessionCopy, COPY, slotOf };
