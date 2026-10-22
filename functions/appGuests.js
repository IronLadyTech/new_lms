/**
 * App guests — everyone who signs in with a number that has no program seat.
 *
 *   Lead status "MC Enrolled" / "MC Completed"  → guest + Masterclass recordings
 *   any other status, or no status              → guest
 *   number not in Zoho at all                   → guest + a new Zoho Lead (name, mobile)
 *
 * Every guest has a record in app_guests/{10-digit phone} that the CMS lists for CX:
 * first and last visit, visits, challenge progress, lead status, and whether CX
 * should check the number (e.g. Zoho says LEP Enrolled but no seat came through).
 * Nothing here creates an account or signs anyone in.
 */
const { FieldValue } = require('firebase-admin/firestore');

const COLLECTION = 'app_guests';

/** Exactly these Lead statuses unlock the Masterclass recordings. */
const MC_RECORDING_STATUSES = new Set(['mc enrolled', 'mc completed']);

/** A program status on the Lead without a seat in IL_Users means the seat did not sync. */
const PROGRAM_STATUS = /^(lep|100 bm|mbw)\b.*\b(enrolled|started|completed)$/i;

function phoneKey(phone) {
  return String(phone || '')
    .replace(/\D/g, '')
    .slice(-10);
}

function normStatus(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * What kind of guest this number is, from every Lead on it.
 * @param leads [{ id, status, email, name }]
 */
function classifyGuest(leads = []) {
  const statuses = leads.map((l) => normStatus(l.status)).filter(Boolean);
  const mc = leads.find((l) => MC_RECORDING_STATUSES.has(normStatus(l.status)));
  const program = leads.find((l) => PROGRAM_STATUS.test(normStatus(l.status)));
  const emails = new Set(
    leads
      .map((l) =>
        String(l.email || '')
          .trim()
          .toLowerCase()
      )
      .filter(Boolean)
  );

  let needsCx = null;
  if (program)
    needsCx = `Zoho says “${program.status}” but no program seat came through — check IL_Users.`;
  else if (emails.size > 1)
    needsCx = `${emails.size} different people share this number in Zoho — check which one is her.`;

  const primary = mc || program || leads[0] || null;
  return {
    tier: mc ? 'mc' : 'explore',
    leadStatus: primary?.status || '',
    zohoLeadId: primary?.id || null,
    leadCount: leads.length,
    inZoho: leads.length > 0,
    needsCx,
    statuses,
  };
}

/** Called from resolvePhoneAccess for every guest sign-in. */
async function recordGuestVisit(db, phone, info = {}) {
  const key = phoneKey(phone);
  if (key.length !== 10) return;
  const ref = db.collection(COLLECTION).doc(key);
  const snap = await ref.get();
  const now = new Date();
  await ref.set(
    {
      phone: `+91${key}`,
      tier: info.tier || 'explore',
      leadStatus: info.leadStatus || '',
      inZoho: Boolean(info.inZoho),
      ...(info.zohoLeadId ? { zohoLeadId: info.zohoLeadId } : {}),
      needsCx: info.needsCx || null,
      lastSeenAt: now,
      visits: FieldValue.increment(1),
      ...(snap.exists ? {} : { firstSeenAt: now, challengeDay: 0 }),
      updatedAt: now,
    },
    { merge: true }
  );
}

function splitName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { First_Name: '', Last_Name: 'App guest' };
  if (parts.length === 1) return { First_Name: '', Last_Name: parts[0] };
  return { First_Name: parts.slice(0, -1).join(' '), Last_Name: parts[parts.length - 1] };
}

/**
 * The guest typed her name. Save it, and — if her number is not in Zoho — create
 * the Lead once (name, mobile, source "Online - IronLady App", status "New").
 * Only for a number that signed in as a guest in the last day.
 */
async function runRegisterAppGuest(db, deps, data = {}) {
  const key = phoneKey(data.phone);
  const name = String(data.name || '')
    .trim()
    .slice(0, 80);
  if (key.length !== 10) return { ok: false, reason: 'phone' };
  const ref = db.collection(COLLECTION).doc(key);
  const snap = await ref.get();
  const guest = snap.data();
  const lastSeen = guest?.lastSeenAt?.toMillis ? guest.lastSeenAt.toMillis() : 0;
  if (!snap.exists || Date.now() - lastSeen > 24 * 3600 * 1000)
    return { ok: false, reason: 'not-a-recent-guest' };

  const patch = { updatedAt: new Date(), ...(name ? { name } : {}) };
  if (!guest.inZoho && !guest.zohoLeadId && deps?.createLead) {
    try {
      const leadId = await deps.createLead({
        ...splitName(name),
        Mobile: `+91${key}`,
        Lead_Source: 'Online - IronLady App',
        Lead_Status: 'New',
        Description: 'Joined the Iron Lady app as a guest (number was not in Zoho).',
      });
      if (leadId)
        Object.assign(patch, {
          zohoLeadId: leadId,
          inZoho: true,
          leadCreatedByApp: true,
          leadStatus: 'New',
        });
    } catch (err) {
      patch.leadError = String(err.message || err).slice(0, 200);
    }
  }
  await ref.set(patch, { merge: true });
  return { ok: true };
}

/** Guest activity: app opened, challenge opened or finished. Only for known guests. */
async function runTrackAppGuest(db, data = {}) {
  const key = phoneKey(data.phone);
  if (key.length !== 10) return { ok: false };
  const ref = db.collection(COLLECTION).doc(key);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false };
  const event = String(data.event || 'open');
  const now = new Date();
  const patch = { lastSeenAt: now, updatedAt: now };
  if (event === 'open') patch.opens = FieldValue.increment(1);
  if (event === 'challenge-start')
    patch.challengeStartedAt = snap.data()?.challengeStartedAt || now;
  if (event === 'challenge-day') {
    const day = Math.max(0, Math.min(30, Number(data.day) || 0));
    if (day > (snap.data()?.challengeDay || 0)) patch.challengeDay = day;
    patch.lastChallengeAt = now;
  }
  if (event === 'challenge-done')
    Object.assign(patch, { challengeDoneAt: now, lastChallengeAt: now });
  if (event === 'recording') patch.recordingsWatched = FieldValue.increment(1);
  await ref.set(patch, { merge: true });
  return { ok: true };
}

module.exports = {
  classifyGuest,
  recordGuestVisit,
  runRegisterAppGuest,
  runTrackAppGuest,
  phoneKey,
  MC_RECORDING_STATUSES,
};
