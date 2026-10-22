/**
 * Scoring for IL Guide whispers. Pure functions — no network, no Firestore.
 *
 * Two kinds of check:
 *   invariant  must hold for every message (facts, safety, length, voice)
 *   golden     the hand-written expectation for that scenario (next step, tone)
 * A scenario passes only when every check passes.
 */

const quotations = require('../quotations.json');

const BANNED_PHRASES = [
  "i'm here to assist",
  'i am here to assist',
  'how can i help',
  'as an ai',
  'chatbot',
  'language model',
];

// A mentor never shames, blames or compares her with others.
const HURTFUL = [
  'behind',
  'overdue',
  'you missed',
  'failed',
  'lazy',
  'disappoint',
  'everyone else',
  'others have',
  'rest of your batch has',
  "why haven't you",
  'why have you not',
  'lagging',
  'last in your',
  'worst',
  'should have',
  'not good enough',
  'absent',
  'no excuse',
  'falling',
];

// Never a sales pitch or a payment reminder — her journey, not a transaction.
const SALES = [
  /\bpay\b/,
  /\bpaid\b/,
  /\bpayment/,
  /\bbalance (due|amount|payment)/,
  /\b(your|pending|remaining) balance/,
  /₹/,
  /\brs\.?\s?\d/,
  /\binr\b/,
  /\brupee/,
  /\bfees?\b/,
  /\bprice/,
  /\binvoice/,
  /\bpurchase/,
  /\bbuy\b/,
  /\bdiscount/,
  /\b(special|limited|exclusive) offer/,
  /\boffer ends/,
  /\bhurry/,
  /\blimited time/,
  /\blast chance/,
  /don't miss out/,
  /\bact now/,
  /\bupgrade/,
  /\bonly today/,
  /\bseats? (left|filling)/,
];

// Professional register: no pet names or chat slang.
const SLANG = [
  /\bdear\b/,
  /\bbabe\b/,
  /\bhun\b/,
  /\bsweetie\b/,
  /\bgirl\b/,
  /\bhey there\b/,
  /\blol\b/,
  /\bgonna\b/,
  /\bwanna\b/,
  /\byo\b/,
];

// Capitalised words that are names, not shouting.
const CAPS_OK = new Set([
  'LEP',
  'MBW',
  '100BM',
  'BM',
  'VIA',
  'NSDC',
  'ERRC',
  'CHRO',
  'CXO',
  'CEO',
  'CFO',
  'VP',
  'HR',
  'IST',
  'AM',
  'PM',
  'BHAG',
  'B-HAG',
  'IL',
  'LMS',
  'CV',
  'Q&A',
]);

const PLACEHOLDER_LEAKS = ['undefined', 'null', 'nan', '{{', '}}', '[object'];

const MONTHS =
  'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december';
const WEEKDAYS =
  'mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday';

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, '-');
}

function sentences(text) {
  return String(text || '')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
}

function firstName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const titles = new Set(['dr', 'dr.', 'mrs', 'mrs.', 'ms', 'ms.', 'mr', 'mr.', 'prof', 'prof.']);
  return parts.find((p) => !titles.has(p.toLowerCase())) || null;
}

/** Every task id this learner could legitimately be sent to. */
function allowedTaskIds(ctx) {
  const ids = new Set();
  if (ctx.nextTask?.id) ids.add(ctx.nextTask.id);
  [...(ctx.dues || []), ...(ctx.lepDues || [])].forEach((d) => d?.taskId && ids.add(d.taskId));
  return ids;
}

function contextText(ctx) {
  return norm(JSON.stringify(ctx));
}

function vettedQuoteTexts() {
  return quotations.map((q) => norm(q.text));
}

// ── Invariant checks ──────────────────────────────────────────────

function checkShape(result, maxSentences = 3) {
  const msg = String(result?.message || '').trim();
  if (!msg) return 'empty message';
  if (msg.length > 360) return `too long (${msg.length} chars)`;
  const n = sentences(msg).length;
  if (n > maxSentences) return `${n} sentences (max ${maxSentences})`;
  return null;
}

function checkNoLeaks(result) {
  const msg = norm(result?.message);
  const hit = PLACEHOLDER_LEAKS.find((p) =>
    new RegExp(`(^|[^a-z])${p.replace(/[{}[\]]/g, '\\$&')}([^a-z]|$)`).test(msg)
  );
  return hit ? `placeholder leaked: "${hit}"` : null;
}

function checkVoice(result) {
  const msg = norm(result?.message);
  const hit = BANNED_PHRASES.find((p) => msg.includes(p));
  return hit ? `bot phrasing: "${hit}"` : null;
}

/** Dates, weekdays and clock times must come from the context — never invented. */
function checkNoInventedDates(result, ctx) {
  const msg = norm(result?.message);
  const known = contextText(ctx);
  const patterns = [
    new RegExp(`\\b\\d{1,2}(:\\d{2})?\\s?(am|pm)\\b`, 'g'),
    new RegExp(`\\b\\d{1,2}\\s(${MONTHS})\\b`, 'g'),
    new RegExp(`\\b(${MONTHS})\\s\\d{1,2}\\b`, 'g'),
    new RegExp(`\\b(${WEEKDAYS})\\b`, 'g'),
  ];
  for (const re of patterns) {
    for (const m of msg.match(re) || []) {
      if (!known.includes(m.trim())) return `invented date/time: "${m.trim()}"`;
    }
  }
  return null;
}

/** Numbers must come from the context (progress, counts, streak) or be simple derived counts. */
function checkNoInventedNumbers(result, ctx) {
  const msg = norm(result?.message);
  const known = contextText(ctx);
  const lp = ctx.lepPractice || {};
  const derived = new Set();
  if (lp.practiceTotalToday != null && lp.practiceDoneToday != null) {
    derived.add(String(lp.practiceTotalToday - lp.practiceDoneToday));
  }
  const p = ctx.performance || {};
  if (p.tasksOpen != null && p.tasksDone != null) derived.add(String(p.tasksOpen - p.tasksDone));
  // Numbers that are part of names the learner knows ("5 Rituals", "27 Principles", "0.5% League").
  const nameNumbers = new Set(['5', '27', '0.5', '100']);
  const quoteText = vettedQuoteTexts().join(' ');
  for (const m of msg.match(/\b\d+(\.\d+)?\b/g) || []) {
    if (nameNumbers.has(m) || derived.has(m) || known.includes(m) || quoteText.includes(m))
      continue;
    return `invented number: "${m}"`;
  }
  return null;
}

/** Quoted lines attributed to someone must be from the vetted list. */
function checkQuotes(result, ctx) {
  const msg = String(result?.message || '');
  const quoted = msg.match(/["“]([^"”]{25,})["”]/g) || [];
  const vetted = vettedQuoteTexts();
  const known = contextText(ctx);
  for (const q of quoted) {
    const text = norm(q.replace(/^["“]|["”]$/g, ''));
    // A quoted task or session title from the context is fine; a quotation must be vetted.
    if (known.includes(text)) continue;
    if (!vetted.some((v) => v.includes(text) || text.includes(v))) {
      return `unvetted quotation: ${q.slice(0, 60)}`;
    }
  }
  return null;
}

function checkTaskAllowed(result, ctx, lockedTaskIds = []) {
  const id = result?.taskId;
  if (!id) return null;
  if (lockedTaskIds.includes(id)) return `points at a locked (unpaid) task: ${id}`;
  if (!allowedTaskIds(ctx).has(id)) return `points at a task not in context: ${id}`;
  return null;
}

function checkFirstNameOnly(result, ctx) {
  const name = String(ctx.name || '').trim();
  const first = firstName(name);
  if (!first) return null;
  const msg = String(result?.message || '');
  const rest = name
    .split(/\s+/)
    .filter((p) => p !== first && p.length > 2 && !/^(dr|mrs|ms|mr|prof)\.?$/i.test(p));
  const hit = rest.find((p) => new RegExp(`\\b${p.replace(/[.]/g, '\\.')}\\b`).test(msg));
  return hit ? `uses surname/title "${hit}" instead of first name` : null;
}

function checkNotHurtful(result) {
  const msg = norm(result?.message);
  const hit = HURTFUL.find((w) => msg.includes(w));
  return hit ? `hurtful wording: "${hit}"` : null;
}

function checkNotSales(result) {
  const msg = norm(result?.message);
  const hit = SALES.find((re) => re.test(msg));
  return hit ? `sales/transactional wording: ${hit}` : null;
}

function checkProfessional(result, ctx) {
  const raw = String(result?.message || '');
  if (/\p{Extended_Pictographic}/u.test(raw)) return 'emoji';
  if ((raw.match(/!/g) || []).length > 1) return 'more than one "!"';
  const msg = norm(raw);
  const slang = SLANG.find((re) => re.test(msg));
  if (slang) return `slang/pet name: ${slang}`;
  const known = JSON.stringify(ctx);
  const shout = (raw.match(/\b[A-Z][A-Z&-]{2,}\b/g) || []).find(
    (w) => !CAPS_OK.has(w) && !known.includes(w)
  );
  return shout ? `shouting: "${shout}"` : null;
}

const INVARIANTS = {
  shape: (r, c) => checkShape(r),
  noLeaks: (r) => checkNoLeaks(r),
  voice: (r) => checkVoice(r),
  noInventedDates: (r, c) => checkNoInventedDates(r, c),
  noInventedNumbers: (r, c) => checkNoInventedNumbers(r, c),
  vettedQuotes: (r, c) => checkQuotes(r, c),
  taskAllowed: (r, c, e) => checkTaskAllowed(r, c, e?.lockedTaskIds),
  firstNameOnly: (r, c) => checkFirstNameOnly(r, c),
  notHurtful: (r) => checkNotHurtful(r),
  notSales: (r) => checkNotSales(r),
  professional: (r, c) => checkProfessional(r, c),
};

// ── Golden checks ─────────────────────────────────────────────────

function checkJob(result, expect) {
  if (!expect.job) return null;
  return result?.job === expect.job ? null : `job ${result?.job || '-'} (expected ${expect.job})`;
}

function checkNextStep(result, expect) {
  if (expect.taskId === undefined) return null;
  const got = result?.taskId || null;
  return got === expect.taskId
    ? null
    : `next step ${got || 'none'} (expected ${expect.taskId || 'none'})`;
}

function checkMentions(result, expect) {
  const msg = norm(result?.message);
  for (const group of expect.mention || []) {
    if (!group.some((alt) => msg.includes(norm(alt))))
      return `missing one of: ${group.join(' / ')}`;
  }
  return null;
}

function checkAvoid(result, expect) {
  const msg = norm(result?.message);
  const hit = (expect.avoid || []).find((w) => msg.includes(norm(w)));
  return hit ? `should not say "${hit}"` : null;
}

const GOLDEN = {
  job: (r, c, e) => checkJob(r, e),
  nextStep: (r, c, e) => checkNextStep(r, e),
  mentions: (r, c, e) => checkMentions(r, e),
  avoid: (r, c, e) => checkAvoid(r, e),
};

/** Score one result. Returns { pass, failures: [{ check, reason }] }. */
function scoreResult(result, ctx, expect = {}, { golden = true } = {}) {
  const failures = [];
  const run = golden ? { ...INVARIANTS, ...GOLDEN } : INVARIANTS;
  for (const [name, fn] of Object.entries(run)) {
    const reason = fn(result, ctx, expect);
    if (reason) failures.push({ check: name, reason });
  }
  return { pass: failures.length === 0, failures };
}

module.exports = {
  scoreResult,
  INVARIANTS,
  GOLDEN,
  firstName,
  sentences,
};
