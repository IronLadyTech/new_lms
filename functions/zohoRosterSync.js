/**
 * Bulk roster sync — IL Registration + Contacts → LMS accounts + paid status.
 *
 * Unlike the IL_Users reconciler (incremental watermark), this walks CRM pages
 * so ops can backfill everyone who paid / registered even when webhooks missed.
 *
 * Rate-limit safe: one Zoho list page per call, serial provision, fail-fast on
 * daily quota. Admin UI continues page-by-page until moreRecords is false.
 */

const { inferFromLeadStatus } = require('./zohoFieldMap');
const { normalizePaymentStatus, PAYMENT_STATUS } = require('./accessTiers');
const { isZohoRateLimitMessage } = require('./zohoLeadsCohort');
const { listIlRegistrationPage } = require('./zohoIlRegistration');
const { findUserUidByEmail } = require('./zohoBatchApply');

const CONTACTS_MODULE = process.env.ZOHO_CONTACTS_MODULE || 'Contacts';
const CONTACTS_FIELDS = [
  'id',
  'Email',
  'First_Name',
  'Last_Name',
  'Full_Name',
  'Lead_Source',
  'LMS_Payment_Status',
  'Payment_Status',
  'Program',
  'LMS_Program',
].join(',');

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function throwIfRateLimited(message) {
  if (!isZohoRateLimitMessage(message)) return;
  const err = new Error(
    `${message}. Daily Zoho CRM API quota exhausted — wait for reset, then continue from the same page.`
  );
  err.code = 'ZOHO_RATE_LIMIT';
  throw err;
}

function paymentFromStatusAndProgram(statusRaw, programRaw) {
  const fromStatus = inferFromLeadStatus(statusRaw);
  if (fromStatus?.paymentStatus) return normalizePaymentStatus(fromStatus.paymentStatus);
  if (programRaw && String(programRaw).trim()) return PAYMENT_STATUS.REGISTER;
  return PAYMENT_STATUS.UNPAID;
}

function contactDisplayName(row) {
  return (
    String(row?.Full_Name || '').trim() ||
    [row?.First_Name, row?.Last_Name].filter(Boolean).join(' ').trim() ||
    ''
  );
}

function paymentFromContact(row) {
  const paymentRaw = row?.LMS_Payment_Status || row?.Payment_Status || null;
  if (paymentRaw) return normalizePaymentStatus(paymentRaw);
  return paymentFromStatusAndProgram(null, row?.Program || row?.LMS_Program);
}

/**
 * List one page of Zoho Contacts (CRM standard module).
 */
async function listContactsPage({ page = 1, perPage = 50 } = {}, deps) {
  const token = await deps.getAccessToken();
  if (!token) throw new Error('Unable to obtain Zoho access token');

  const params = new URLSearchParams({
    page: String(page),
    per_page: String(Math.min(Math.max(perPage, 1), 200)),
    fields: CONTACTS_FIELDS,
  });

  const res = await fetch(`${deps.getApiDomain()}/crm/v2/${CONTACTS_MODULE}?${params}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });

  if (res.status === 204) {
    return { ok: true, module: CONTACTS_MODULE, rows: [], page, perPage, count: 0, moreRecords: false };
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.message || `Contacts list HTTP ${res.status}`;
    throwIfRateLimited(message);
    throw new Error(message);
  }

  const rows = (body?.data || [])
    .map((row) => {
      const email = normalizeEmail(row.Email);
      if (!email) return null;
      return {
        id: row.id,
        email,
        name: contactDisplayName(row),
        paymentStatus: paymentFromContact(row),
        program: row.Program || row.LMS_Program || '',
        _source: 'contacts',
        _raw: row,
      };
    })
    .filter(Boolean);

  const info = body?.info || {};
  return {
    ok: true,
    module: CONTACTS_MODULE,
    rows,
    page: info.page || page,
    perPage: info.per_page || perPage,
    count: info.count ?? rows.length,
    moreRecords: Boolean(info.more_records),
  };
}

function registrationMember(summary) {
  const email = normalizeEmail(summary.email);
  if (!email) return null;
  return {
    id: summary.id,
    email,
    name: summary.name || '',
    batch: summary.batch || '',
    program: summary.program || '',
    status: summary.status || '',
    paymentStatus: paymentFromStatusAndProgram(summary.status, summary.program),
    _source: 'il_registration',
  };
}

/**
 * One page of roster candidates from IL Registration and/or Contacts.
 * Dedupes by email within the page (IL Registration wins over Contacts).
 */
async function fetchRosterPage(
  { source = 'both', page = 1, perPage = 50 } = {},
  deps
) {
  const wantReg = source === 'both' || source === 'il_registration';
  const wantContacts = source === 'both' || source === 'contacts';
  const byEmail = new Map();
  const meta = { ilRegistration: null, contacts: null };

  if (wantReg) {
    try {
      const reg = await listIlRegistrationPage({ page, perPage }, deps);
      meta.ilRegistration = {
        module: reg.module,
        count: reg.count,
        moreRecords: reg.moreRecords,
      };
      (reg.rows || []).forEach((row) => {
        const member = registrationMember(row);
        if (member) byEmail.set(member.email, member);
      });
    } catch (err) {
      throwIfRateLimited(err.message);
      throw err;
    }
  }

  if (wantContacts) {
    try {
      const contacts = await listContactsPage({ page, perPage }, deps);
      meta.contacts = {
        module: contacts.module,
        count: contacts.count,
        moreRecords: contacts.moreRecords,
      };
      (contacts.rows || []).forEach((row) => {
        if (byEmail.has(row.email)) {
          const existing = byEmail.get(row.email);
          existing.sources = [...new Set([...(existing.sources || [existing._source]), 'contacts'])];
          return;
        }
        byEmail.set(row.email, {
          ...row,
          sources: ['contacts'],
        });
      });
    } catch (err) {
      throwIfRateLimited(err.message);
      throw err;
    }
  }

  const members = [...byEmail.values()].map((m) => ({
    ...m,
    sources: m.sources || [m._source],
  }));

  const moreRecords = Boolean(
    meta.ilRegistration?.moreRecords || meta.contacts?.moreRecords
  );

  return { members, moreRecords, page, perPage, meta };
}

/**
 * Sync one CRM page into LMS accounts + payment entitlements.
 *
 * @param {object} opts
 * @param {boolean} [opts.dryRun=true]
 * @param {'both'|'il_registration'|'contacts'} [opts.source='both']
 * @param {number} [opts.page=1]
 * @param {number} [opts.perPage=50]
 * @param {boolean} [opts.createUnpaid=false] — rarely needed; default skips creating unpaid
 * @param {string|null} [opts.triggeredBy]
 */
async function runRosterSync(opts, deps) {
  const dryRun = opts.dryRun !== false;
  const source = ['il_registration', 'contacts', 'both'].includes(opts.source)
    ? opts.source
    : 'both';
  const page = Math.max(1, Number(opts.page) || 1);
  const perPage = Math.min(Math.max(Number(opts.perPage) || 50, 1), 100);
  const createUnpaid = opts.createUnpaid === true;
  const { db } = deps;

  if (!db) return { ok: false, reason: 'Firestore db is required' };
  if (!deps.provisionUserFromEmail) {
    return { ok: false, reason: 'provisionUserFromEmail dependency is required' };
  }

  let roster;
  try {
    roster = await fetchRosterPage({ source, page, perPage }, deps);
  } catch (err) {
    return {
      ok: false,
      reason: err.message || String(err),
      code: err.code || null,
      dryRun,
      source,
      page,
      perPage,
    };
  }

  const stats = {
    scanned: roster.members.length,
    wouldCreate: 0,
    wouldRefresh: 0,
    wouldSkipUnpaid: 0,
    provisioned: 0,
    refreshed: 0,
    skippedUnpaid: 0,
    skipped: 0,
    errors: [],
  };

  const sample = [];

  for (const member of roster.members) {
    const email = member.email;
    let uid = null;
    try {
      uid = await findUserUidByEmail(db, email);
    } catch (err) {
      stats.errors.push({ email, stage: 'lookup', reason: err.message || String(err) });
      stats.skipped += 1;
      continue;
    }

    const unpaid = member.paymentStatus === PAYMENT_STATUS.UNPAID;
    const action = uid ? 'refresh' : unpaid && !createUnpaid ? 'skip-unpaid' : 'create';

    if (dryRun) {
      if (action === 'create') stats.wouldCreate += 1;
      else if (action === 'refresh') stats.wouldRefresh += 1;
      else stats.wouldSkipUnpaid += 1;

      if (sample.length < 25) {
        sample.push({
          email,
          name: member.name || '',
          action,
          paymentStatus: member.paymentStatus,
          sources: member.sources,
          hasAccount: Boolean(uid),
        });
      }
      continue;
    }

    if (action === 'skip-unpaid') {
      stats.skippedUnpaid += 1;
      continue;
    }

    try {
      const result = await deps.provisionUserFromEmail(db, email);
      if (!result?.ok) {
        stats.skipped += 1;
        if (stats.errors.length < 40) {
          stats.errors.push({
            email,
            stage: uid ? 'refresh' : 'provision',
            reason: result?.reason || 'Provision failed',
          });
        }
        continue;
      }

      if (result.created || !uid) stats.provisioned += 1;
      else stats.refreshed += 1;

      if (sample.length < 25) {
        sample.push({
          email,
          action: result.created || !uid ? 'created' : 'refreshed',
          paymentStatus: result.paymentStatus || member.paymentStatus,
          uid: result.uid || uid,
        });
      }
    } catch (err) {
      if (err.code === 'ZOHO_RATE_LIMIT' || isZohoRateLimitMessage(err.message)) {
        return {
          ok: false,
          code: 'ZOHO_RATE_LIMIT',
          reason: err.message,
          dryRun: false,
          source,
          page,
          perPage,
          moreRecords: roster.moreRecords,
          nextPage: page,
          meta: roster.meta,
          ...stats,
          sample,
          stoppedEarly: true,
        };
      }
      stats.skipped += 1;
      if (stats.errors.length < 40) {
        stats.errors.push({
          email,
          stage: 'sync',
          reason: err.message || String(err),
        });
      }
    }
  }

  return {
    ok: true,
    dryRun,
    source,
    page,
    perPage,
    moreRecords: roster.moreRecords,
    nextPage: roster.moreRecords ? page + 1 : null,
    meta: roster.meta,
    triggeredBy: opts.triggeredBy || null,
    ...stats,
    sample,
  };
}

module.exports = {
  listContactsPage,
  fetchRosterPage,
  runRosterSync,
  paymentFromStatusAndProgram,
  registrationMember,
  normalizeEmail,
};
