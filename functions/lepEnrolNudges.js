/**
 * Enrol nudges: a push for part-paid (registered) learners before orientation.
 * Two only, at lunch (1:00 PM IST, the plan's slot for short tasks): 5 and 2 days before.
 * No amounts in the text. Learners who have paid never get these.
 */
const NUDGES = [
  {
    code: 'ENROL-5D',
    daysBefore: 5,
    title: 'Orientation is 5 days away',
    body: '{{name}}, complete your enrolment so your full journey stays open.',
  },
  {
    code: 'ENROL-2D',
    daysBefore: 2,
    title: 'Orientation is in 2 days',
    body: '{{name}}, finish your enrolment today and walk in with everything open.',
  },
];

const NUDGE_HOUR_IST = '13:00';

function orientationDay(batch) {
  const s0 = (batch?.sessions || []).find((s) => s?.code === 'S0' && !s.cancelled);
  const day = String(s0?.date || batch?.orientationDate || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : '';
}

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Nudges of this batch due in (windowStartMs, windowEndMs]. */
function enrolNudgeFires(batch, windowStartMs, windowEndMs) {
  const orientation = orientationDay(batch);
  if (!orientation) return [];
  const out = [];
  for (const n of NUDGES) {
    const day = addDays(orientation, -n.daysBefore);
    const fireAtMs = Date.parse(`${day}T${NUDGE_HOUR_IST}:00+05:30`);
    if (fireAtMs > windowStartMs && fireAtMs <= windowEndMs) {
      out.push({
        event: { code: n.code, title: n.title, body: n.body, priority: 'mandatory', channels: { push: true } },
        day,
        fireAtMs,
        dedupeKey: `${batch.id}|${n.code}|${day}`,
      });
    }
  }
  return out;
}

/** Only a learner still part-paid for LEP. */
function wantsEnrolNudge(data) {
  return data?.programAccess?.lep?.paymentStatus === 'register';
}

module.exports = { enrolNudgeFires, wantsEnrolNudge, orientationDay, NUDGES };
