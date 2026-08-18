/**
 * Maps Zoho Lead fields → LMS (supports existing Zoho setup without renaming fields).
 * Lead Status (Follow up / * Enrolled / * Start) can drive program + access.
 * Username/password are read from Lead custom fields — NOT from OAuth API keys.
 */

const {
  normalizeAccessTier,
  normalizeProgram,
  accessTierFromPaymentStatus,
  normalizePaymentStatus,
  PAYMENT_STATUS,
} = require('./accessTiers');

function envField(key, fallback) {
  return process.env[key]?.trim() || fallback;
}

function getFieldMap() {
  return {
    password: envField('ZOHO_FIELD_PASSWORD', 'LMS_Password'),
    username: envField('ZOHO_FIELD_USERNAME', 'LMS_Username'),
    program: envField('ZOHO_FIELD_PROGRAM', 'LMS_Program'),
    accessTier: envField('ZOHO_FIELD_ACCESS_TIER', 'LMS_Access_Tier'),
    paymentStatus: envField('ZOHO_FIELD_PAYMENT_STATUS', 'LMS_Payment_Status'),
    leadStatus: envField('ZOHO_FIELD_LEAD_STATUS', 'Lead_Status'),
  };
}

function pickLeadValue(lead, ...keys) {
  for (const key of keys) {
    if (!key) continue;
    const val = lead?.[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return '';
}

function readLeadStatusFromLead(lead) {
  const map = getFieldMap();
  return pickLeadValue(lead, map.leadStatus, 'Lead_Status', 'Status');
}

function inferFromLeadStatus(statusRaw) {
  const s = (statusRaw || '').toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return null;

  let program = null;
  if (/\bmbw\b|business warfare/.test(s)) program = 'mbw';
  else if (/\blep\b|leadership essentials/.test(s)) program = 'lep';
  else if (/100\s*bm|100bm|100 board/.test(s)) program = '100bm';

  /*
   * Refunds, from the Current Lead Status field. The old LMS removed the
   * programme on Refund Completed and restored it on Refund Cancelled, and
   * nothing in this one revoked access at all — a refunded learner kept the
   * content indefinitely.
   *
   * Checked before the enrol and start tests below, because the status still
   * names the programme: "100 BM Refund Completed" contains both "refund" and
   * the programme, and whichever test runs first wins.
   *
   * Initiated is deliberately not a revocation. It records an intent, and the
   * old system only wrote it to IL Registration; taking content away while a
   * refund is merely being considered would be wrong.
   */
  if (/refund/.test(s)) {
    if (/cancel/.test(s)) {
      // Refund called off — the entitlement stands. Say nothing about payment
      // so the ratchet leaves whatever they had in place.
      return { program, paymentStatus: null, accessTier: null, leadStatus: statusRaw, refund: 'cancelled' };
    }
    if (/complete/.test(s)) {
      return {
        program,
        paymentStatus: PAYMENT_STATUS.UNPAID,
        accessTier: null,
        leadStatus: statusRaw,
        refund: 'completed',
      };
    }
    return { program, paymentStatus: null, accessTier: null, leadStatus: statusRaw, refund: 'initiated' };
  }

  if (/follow\s*up/.test(s)) {
    return {
      program: null,
      paymentStatus: PAYMENT_STATUS.UNPAID,
      accessTier: null,
      leadStatus: statusRaw,
    };
  }

  /*
   * No trailing word boundary. The statuses in Zoho read "100 BM started" and
   * "MBW started", and \bstart\b matches only the bare word — so every learner
   * who had begun a programme fell through to unpaid and was locked out of
   * content they had paid for in full. The enrol test above already uses the
   * loose form, and the Deluge matches with contains().
   */
  if (/\bstart/.test(s) && program) {
    return {
      program,
      paymentStatus: PAYMENT_STATUS.PAID,
      accessTier: accessTierFromPaymentStatus(PAYMENT_STATUS.PAID),
      leadStatus: statusRaw,
    };
  }

  if (/\benroll/.test(s) && program) {
    return {
      program,
      paymentStatus: PAYMENT_STATUS.REGISTER,
      accessTier: accessTierFromPaymentStatus(PAYMENT_STATUS.REGISTER),
      leadStatus: statusRaw,
    };
  }

  if (program) {
    return { program, paymentStatus: null, accessTier: null, leadStatus: statusRaw };
  }

  return { program: null, paymentStatus: null, accessTier: null, leadStatus: statusRaw };
}

function inferProgramFromLead(lead, fromStatus) {
  if (fromStatus?.program) return fromStatus.program;

  const map = getFieldMap();
  const direct = normalizeProgram(
    pickLeadValue(lead, map.program, 'Program', 'program', 'LMS_Program')
  );
  if (direct) return direct;

  const blob = JSON.stringify(lead || {}).toLowerCase();
  if (blob.includes('100bm') || blob.includes('100 board')) return '100bm';
  if (blob.includes('"lep"') || blob.includes('leadership essentials')) return 'lep';
  if (blob.includes('"mbw"') || blob.includes('business warfare')) return 'mbw';
  return null;
}

function readUsernameFromLead(lead) {
  const map = getFieldMap();
  return pickLeadValue(
    lead,
    map.username,
    'LMS_Username',
    'Username',
    'User_Name',
    'IL_Username',
    'Login_Username'
  );
}

function readPasswordFromLead(lead) {
  const map = getFieldMap();
  return pickLeadValue(
    lead,
    map.password,
    'LMS_Password',
    'Password',
    'IL_Password',
    'Login_Password'
  );
}

function readPaymentStatusFromLead(lead) {
  const map = getFieldMap();
  return (
    pickLeadValue(
      lead,
      map.paymentStatus,
      'LMS_Payment_Status',
      'Payment_Status',
      'Payment Status',
      'IL_Payment_Status'
    ) || null
  );
}

function resolveLoginEmail(lead, lmsUsername) {
  const email = lead?.Email?.trim() || '';
  if (email) return email;
  if (lmsUsername && lmsUsername.includes('@')) return lmsUsername;
  return '';
}

function parseLeadEntitlements(lead) {
  const statusRaw = readLeadStatusFromLead(lead);
  const fromStatus = inferFromLeadStatus(statusRaw);
  const paymentRaw = readPaymentStatusFromLead(lead);
  const lmsUsername = readUsernameFromLead(lead);

  const paymentStatus = paymentRaw
    ? normalizePaymentStatus(paymentRaw)
    : fromStatus?.paymentStatus || PAYMENT_STATUS.UNPAID;

  const accessTier =
    accessTierFromPaymentStatus(paymentStatus) ||
    fromStatus?.accessTier ||
    normalizeAccessTier(
      pickLeadValue(
        lead,
        getFieldMap().accessTier,
        'LMS_Access_Tier',
        'Access_Tier',
        'IL_Access_Tier'
      )
    );

  return {
    // Carried through so applyEntitlements can revoke: a refund has to bypass
    // the never-downgrade ratchet, which exists to stop webhook replays
    // lowering somebody's tier by accident.
    refund: fromStatus?.refund || null,
    email: resolveLoginEmail(lead, lmsUsername),
    displayName: lead?.Last_Name || lead?.Full_Name || lead?.First_Name || '',
    program: inferProgramFromLead(lead, fromStatus),
    accessTier,
    paymentStatus,
    leadStatus: statusRaw || null,
    lmsUsername: lmsUsername || null,
    password: readPasswordFromLead(lead),
    zohoLeadId: lead?.id || null,
  };
}

function entitlementsToLeadFields(profile) {
  const map = getFieldMap();
  const out = {};
  if (profile.program) out[map.program] = profile.program;
  if (profile.accessTier) out[map.accessTier] = profile.accessTier;
  if (profile.paymentStatus) out[map.paymentStatus] = profile.paymentStatus;
  return out;
}

module.exports = {
  getFieldMap,
  parseLeadEntitlements,
  inferFromLeadStatus,
  readLeadStatusFromLead,
  entitlementsToLeadFields,
  readPasswordFromLead,
  readUsernameFromLead,
};
