/**
 * Zoho CRM integration — server-side only (secrets never in the browser).
 * Credentials live in functions/.env (gitignored), loaded by Firebase on deploy.
 *
 * Syncs LMS users to Zoho **Leads** only (no Contacts module).
 */

const { HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const provisioning = require('./zohoProvisioning');
const ilUsers = require('./zohoIlUsers');
const batchSync = require('./zohoBatchSync');
const batchApply = require('./zohoBatchApply');
const ilRegistration = require('./zohoIlRegistration');
const leadsCohort = require('./zohoLeadsCohort');
const rosterSync = require('./zohoRosterSync');
const { readPasswordFromLead } = require('./zohoFieldMap');
const { FAILURES } = require('./syncAlerts');
const reconciler = require('./zohoReconcile');
const budget = require('./zohoBudget');

/* admin.firestore() is only valid once the app is initialised, which happens in
   index.js — resolved lazily so requiring this module stays side-effect free. */
function getDb() {
  return admin.firestore();
}

const DEFAULT_API_DOMAIN = 'https://www.zohoapis.in';
const DEFAULT_MODULE = 'Leads';

let cachedAccessToken = null;
let tokenExpiry = 0;

function getApiDomain() {
  return process.env.ZOHO_API_DOMAIN || DEFAULT_API_DOMAIN;
}

function getAccountsDomain() {
  if (process.env.ZOHO_ACCOUNTS_DOMAIN) return process.env.ZOHO_ACCOUNTS_DOMAIN;
  const api = getApiDomain();
  if (api.includes('.in')) return 'https://accounts.zoho.in';
  if (api.includes('.eu')) return 'https://accounts.zoho.eu';
  if (api.includes('.com.au')) return 'https://accounts.zoho.com.au';
  return 'https://accounts.zoho.com';
}

function getModule() {
  return process.env.ZOHO_CRM_MODULE || DEFAULT_MODULE;
}

function isConfigured() {
  return Boolean(
    process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET && process.env.ZOHO_REFRESH_TOKEN
  );
}

/** Read linked Zoho Lead id (supports legacy zohoContactId from older syncs). */
function getZohoLeadId(profile) {
  return profile?.zohoLeadId || profile?.zohoContactId || null;
}

/**
 * Where the access token is shared between function instances.
 *
 * In-memory caching alone is per-container, and there are a lot of containers:
 * the webhook scales out under load, the reconciler wakes every three minutes,
 * the profile trigger fires on every write, and each cold start refreshed its
 * own token. Zoho allows only a handful of refreshes a minute, so the fleet
 * rate-limited itself — "You have made too many requests continuously" — and
 * every Zoho call failed with an invalid token until it cleared.
 *
 * One shared record collapses that back to roughly one refresh an hour.
 */
const TOKEN_DOC = 'sync_state/zohoToken';

async function readSharedToken() {
  try {
    const snap = await admin.firestore().doc(TOKEN_DOC).get();
    if (!snap.exists) return null;
    const { token, expiresAt } = snap.data() || {};
    if (!token || !expiresAt) return null;
    return Date.now() < expiresAt ? { token, expiresAt } : null;
  } catch {
    // A cache that cannot be read must not stop the call it was speeding up.
    return null;
  }
}

async function writeSharedToken(token, expiresAt) {
  try {
    await admin.firestore().doc(TOKEN_DOC).set({ token, expiresAt, at: new Date() });
  } catch {
    /* best effort */
  }
}

async function getAccessToken() {
  if (!isConfigured()) return null;
  if (cachedAccessToken && Date.now() < tokenExpiry) return cachedAccessToken;

  // Another instance may have refreshed seconds ago; reuse rather than ask again.
  const shared = await readSharedToken();
  if (shared) {
    cachedAccessToken = shared.token;
    tokenExpiry = shared.expiresAt;
    return cachedAccessToken;
  }

  const res = await fetch(`${getAccountsDomain()}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    console.warn('Zoho token refresh failed', await res.text());
    return null;
  }

  const data = await res.json();
  if (!data?.access_token) {
    console.warn('Zoho token refresh returned no token', JSON.stringify(data));
    return null;
  }
  cachedAccessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  await writeSharedToken(cachedAccessToken, tokenExpiry);
  return cachedAccessToken;
}

/*
 * Course id → title, cached.
 *
 * Enrolled_Courses used to arrive in Zoho as raw Firestore ids —
 * "YLwsh7uCJJQy4yiBAQ2i, MycpoZ5DpvOxjqnDc3G6" — which is accurate and tells
 * whoever opens the lead nothing. A bulk sync runs this for every learner, so
 * the collection is read once per window rather than once per user.
 */
const COURSE_TITLE_TTL_MS = 5 * 60 * 1000;
let courseTitleCache = null;
let courseTitleCachedAt = 0;

async function loadCourseTitles(db) {
  const now = Date.now();
  if (courseTitleCache && now - courseTitleCachedAt < COURSE_TITLE_TTL_MS) {
    return courseTitleCache;
  }
  try {
    const snap = await db.collection('courses').get();
    const map = {};
    snap.docs.forEach((d) => {
      const title = d.data()?.title;
      if (title) map[d.id] = title;
    });
    courseTitleCache = map;
    courseTitleCachedAt = now;
    return map;
  } catch (err) {
    // A lookup failure must not cost the whole sync. Falling back to ids keeps
    // the record correct, just less readable.
    console.warn('Course title lookup failed, syncing raw ids:', err.message);
    return courseTitleCache || {};
  }
}

function leadPayload({
  uid,
  email,
  displayName,
  enrolledCourses = [],
  role,
  blocked,
  courseTitles,
}) {
  const titles = courseTitles || {};
  const courses = (Array.isArray(enrolledCourses) ? enrolledCourses : []).map(
    (id) => titles[id] || id
  );
  /*
   * Description is deliberately not written. It used to carry the Firebase UID,
   * from before Firebase_UID existed as a field — but Description is where the
   * CRM keeps the brief CX actually reads, and overwriting it destroyed that on
   * every sync. The UID has its own field now.
   *
   * Entitlements are deliberately not written either. Zoho owns them: Lead
   * Status is where CX records what somebody paid for, and the LMS derives its
   * access from that. Sending a flat payment status back the other way meant
   * the LMS's own value would be read on the next pull and beat Lead Status —
   * so a stale "paid" in a profile could overwrite the CRM's correct answer and
   * could never be corrected by re-syncing.
   */
  return {
    Email: email,
    Last_Name: displayName || email?.split('@')[0] || 'User',
    Enrolled_Courses: courses.join(', '),
    LMS_Role: role || 'student',
    LMS_Blocked: blocked ? 'Yes' : 'No',
    Firebase_UID: uid,
  };
}

function profileToLeadFields(uid, profile, courseTitles = null) {
  return leadPayload({
    courseTitles,
    uid,
    email: profile.email,
    displayName: profile.displayName,
    enrolledCourses: profile.enrolledCourses,
    role: profile.role,
    blocked: profile.blocked,
  });
}

/**
 * A timestamp in the shape Zoho's DateTime fields accept.
 *
 * Date.toISOString() is not it. Zoho wants an explicit UTC offset and no
 * milliseconds — `2026-08-19T07:32:00+00:00`, never `...:00.123Z` — and rejects
 * the whole upsert when it gets the latter:
 *
 *   invalid data ({"expected_data_type":"datetime",
 *                  "api_name":"LMS_Password_Updated_At"})
 *
 * Callers pass Dates, ISO strings and epoch milliseconds, so all three are
 * normalised here rather than at each call site. Anything unparseable becomes
 * null, which omits the field: a bad timestamp must not take the rest of the
 * record down with it.
 */
function toZohoDateTime(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.toISOString().slice(0, 19)}+00:00`;
}

function leadPasswordPayload(baseFields, password, options = {}) {
  const { status = 'Password updated via LMS', updatedAt = new Date() } = options;
  const stamp = toZohoDateTime(updatedAt);
  return {
    ...baseFields,
    LMS_Password: password,
    ...(stamp ? { LMS_Password_Updated_At: stamp } : {}),
    LMS_Credential_Status: status,
  };
}

/**
 * Every CRM API call goes through here so the day's spend is actually known.
 *
 * Counting is the point: a budget nobody measures is a budget that gets spent.
 * The OAuth token refresh is deliberately not counted — it is cached in memory
 * and shared across instances, so it is neither frequent nor optional.
 *
 * A 429 from Zoho is recorded as the rate limit it is, so the budget reflects
 * reality rather than only what we intended to spend.
 */
async function zohoApiFetch(url, init) {
  const res = await fetch(url, init);
  try {
    await budget.record(getDb(), 1);
    if (res.status === 429) {
      // Burn the rest of the background allowance: Zoho is already refusing us.
      await budget.record(getDb(), budget.DEFAULT_DAILY_BUDGET);
      console.warn('Zoho returned 429 — background sync paused for the rest of the day');
    }
  } catch {
    /* never let accounting break a call that already succeeded */
  }
  return res;
}

async function upsertLead(fields) {
  const token = await getAccessToken();
  if (!token) throw new Error('Unable to obtain Zoho access token');

  const res = await zohoApiFetch(`${getApiDomain()}/crm/v2/${getModule()}/upsert`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: [fields],
      duplicate_check_fields: ['Email'],
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.message || JSON.stringify(body));
  }

  const row = body?.data?.[0];
  if (row?.status === 'error') {
    /*
     * row.details names the field Zoho objected to. Dropping it turned every
     * schema mismatch into the same unactionable "invalid data", which is how
     * a payload aimed at fields that did not exist on the layout failed
     * silently for weeks.
     */
    const detail = row.details ? ` (${JSON.stringify(row.details)})` : '';
    throw new Error(`${row.message || 'Zoho upsert failed'}${detail}`);
  }

  return row?.details?.id || null;
}

const LEAD_LIST_FIELDS = [
  'Email',
  'Last_Name',
  'Lead_Status',
  'LMS_Program',
  'LMS_Payment_Status',
  'LMS_Access_Tier',
  'Firebase_UID',
  'Phone',
].join(',');

function leadToSummaryRow(lead) {
  if (!lead) return null;
  return {
    id: lead.id,
    email: lead.Email || '',
    name: lead.Last_Name || lead.Full_Name || '',
    program: lead.LMS_Program || '',
    paymentStatus: lead.LMS_Payment_Status || '',
    accessTier: lead.LMS_Access_Tier || '',
    leadStatus: lead.Lead_Status || '',
    phone: lead.Phone || '',
    firebaseUid: lead.Firebase_UID || '',
  };
}

/** Paginated Leads list for admin directory (Zoho → LMS browse). */
async function listLeadsPage({ page = 1, perPage = 50 } = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error('Unable to obtain Zoho access token');

  const params = new URLSearchParams({
    page: String(page),
    per_page: String(Math.min(Math.max(perPage, 1), 200)),
    fields: LEAD_LIST_FIELDS,
  });

  const res = await zohoApiFetch(`${getApiDomain()}/crm/v2/${getModule()}?${params}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.message || JSON.stringify(body));
  }

  const rows = (body?.data || []).map(leadToSummaryRow).filter(Boolean);
  const info = body?.info || {};

  return {
    ok: true,
    module: getModule(),
    rows,
    page: info.page || page,
    perPage: info.per_page || perPage,
    count: info.count ?? rows.length,
    moreRecords: Boolean(info.more_records),
  };
}

async function searchLeadByEmail(email) {
  const token = await getAccessToken();
  if (!token || !email) return null;

  const criteria = encodeURIComponent(`(Email:equals:${email})`);
  const res = await zohoApiFetch(
    `${getApiDomain()}/crm/v2/${getModule()}/search?criteria=${criteria}`,
    {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    }
  );

  if (res.status === 204) return null;
  if (!res.ok) return null;

  const body = await res.json();
  return body?.data?.[0]?.id || null;
}

/** Digits-only and common India variants for Lead Phone / Mobile search. */
function phoneSearchVariants(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return [];
  const out = new Set();
  out.add(digits);
  if (digits.length === 10) {
    out.add(`91${digits}`);
    out.add(`+91${digits}`);
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    out.add(digits.slice(2));
    out.add(`+${digits}`);
  }
  if (String(raw || '').startsWith('+')) out.add(String(raw).trim());
  return [...out];
}

async function searchLeadByFirebaseUid(uid) {
  const token = await getAccessToken();
  if (!token || !uid) return null;

  const criteria = encodeURIComponent(`(Firebase_UID:equals:${String(uid).trim()})`);
  const res = await zohoApiFetch(
    `${getApiDomain()}/crm/v2/${getModule()}/search?criteria=${criteria}`,
    { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
  );
  if (res.status === 204) return null;
  if (!res.ok) return null;
  const body = await res.json();
  return body?.data?.[0]?.id || null;
}

async function searchLeadByPhone(phone) {
  const token = await getAccessToken();
  if (!token || !phone) return null;

  for (const variant of phoneSearchVariants(phone)) {
    const criteria = encodeURIComponent(`((Phone:equals:${variant})or(Mobile:equals:${variant}))`);
    const res = await zohoApiFetch(
      `${getApiDomain()}/crm/v2/${getModule()}/search?criteria=${criteria}`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    if (res.status === 204) continue;
    if (!res.ok) continue;
    const body = await res.json();
    const id = body?.data?.[0]?.id || null;
    if (id) return id;
  }
  return null;
}

/**
 * Every Lead on this mobile number (Phone or Mobile, any format) — not just the
 * first — so a shared family number is noticed instead of guessed.
 * @returns [{ id, status, email, name }]
 */
async function searchLeadsByPhone(phone) {
  const token = await getAccessToken();
  if (!token || !phone) return [];
  const byId = new Map();
  for (const variant of phoneSearchVariants(phone)) {
    const criteria = encodeURIComponent(`((Phone:equals:${variant})or(Mobile:equals:${variant}))`);
    const res = await zohoApiFetch(
      `${getApiDomain()}/crm/v2/${getModule()}/search?criteria=${criteria}`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    if (res.status === 204 || !res.ok) continue;
    const body = await res.json();
    (body?.data || []).forEach((lead) => {
      if (!lead?.id || byId.has(lead.id)) return;
      byId.set(lead.id, {
        id: lead.id,
        status: lead.Lead_Status || '',
        email: lead.Email || '',
        name: lead.Full_Name || [lead.First_Name, lead.Last_Name].filter(Boolean).join(' '),
      });
    });
    if (byId.size) break;
  }
  return [...byId.values()];
}

/** Create one Lead (no duplicate merge — callers check the number first). Returns its id. */
async function createLead(fields) {
  const token = await getAccessToken();
  if (!token) throw new Error('Unable to obtain Zoho access token');
  const res = await zohoApiFetch(`${getApiDomain()}/crm/v2/${getModule()}`, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [fields], trigger: ['workflow'] }),
  });
  const body = await res.json();
  const row = body?.data?.[0];
  if (!res.ok || row?.status === 'error') {
    throw new Error(row?.message || body?.message || 'Zoho lead create failed');
  }
  return row?.details?.id || null;
}

async function updateLeadById(leadId, fields) {
  const token = await getAccessToken();
  if (!token || !leadId) throw new Error('Unable to update Zoho lead');

  const res = await zohoApiFetch(`${getApiDomain()}/crm/v2/${getModule()}/${leadId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: [fields] }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.message || JSON.stringify(body));
  }
  const row = body?.data?.[0];
  if (row?.status === 'error') {
    const detail = row.details ? ` (${JSON.stringify(row.details)})` : '';
    throw new Error(`${row.message || 'Zoho update failed'}${detail}`);
  }
  return leadId;
}

/** Drop invalid layout fields until Zoho accepts the Lead update (welcome fields). */
async function updateLeadByIdResilient(leadId, fields) {
  const payload = { ...fields };
  const keys = Object.keys(payload);
  for (let attempt = 0; attempt <= keys.length + 2; attempt++) {
    try {
      return await updateLeadById(leadId, payload);
    } catch (err) {
      const msg = String(err.message || '');
      const match =
        msg.match(/"api_name":"([^"]+)"/) || msg.match(/api_name[":\s]+([A-Za-z0-9_]+)/);
      const badKey = match?.[1];
      if (!badKey || !(badKey in payload)) throw err;
      delete payload[badKey];
      if (!Object.keys(payload).length) throw err;
      console.warn(`updateLeadByIdResilient: dropped invalid field ${badKey}`);
    }
  }
  throw new Error('Zoho lead update failed');
}

function welcomeFieldsToLeadPayload(fields = {}) {
  const payload = {};
  if (fields.city) {
    payload.City = fields.city;
    payload.Current_City = fields.city;
  }
  if (fields.domain) {
    payload.Industry = fields.domain;
    payload.Industry_Field_of_Work = fields.domain;
    payload.LMS_Domain = fields.domain;
  }
  if (fields.bhag) {
    payload.Month_B_HAG = fields.bhag;
    payload.B_HAG_Next_3_month = fields.bhag;
    payload.LMS_BHAG = fields.bhag;
  }
  if (fields.lepBatch) {
    payload.LEP_Batch = fields.lepBatch;
  }
  if (fields.salaryRange) {
    // Zoho "Annual Income" picklist. A value Zoho does not list yet is dropped by
    // updateLeadByIdResilient and stays saved on the LMS profile.
    payload.Annual_Income = fields.salaryRange;
  }
  return payload;
}

async function searchIlUserByEmail(email) {
  return ilUsers.searchIlUserByEmail(email, { getAccessToken, getApiDomain });
}

function zohoEnrollmentDeps() {
  const api = { getAccessToken, getApiDomain };
  return {
    searchAllIlRegistrationsByEmail: (addr) =>
      ilRegistration.searchAllIlRegistrationsByEmail(addr, api),
    searchAllIlUsersByEmail: (addr) => ilUsers.searchAllIlUsersByEmail(addr, api),
  };
}

async function getLeadById(leadId) {
  const token = await getAccessToken();
  if (!token || !leadId) return null;

  const res = await zohoApiFetch(`${getApiDomain()}/crm/v2/${getModule()}/${leadId}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });

  if (!res.ok) return null;
  const body = await res.json();
  return body?.data?.[0] || null;
}

async function getLeadByEmail(email) {
  const leadId = await searchLeadByEmail(email);
  if (!leadId) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const res = await zohoApiFetch(`${getApiDomain()}/crm/v2/${getModule()}/${leadId}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });

  if (!res.ok) return null;
  const body = await res.json();
  return body?.data?.[0] || null;
}

function credentialTimeMs(value) {
  if (!value) return 0;
  if (value?.toDate) return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isUsableZohoPassword(password) {
  return typeof password === 'string' && password.trim().length >= 6 && password !== 'USER_MANAGED';
}

async function applyFirebasePassword(uid, password) {
  await admin.auth().updateUser(uid, { password });
}

/**
 * Keeps LMS (Firebase Auth) and Zoho LMS_Password aligned using the newest source.
 * Requires lmsCredentialPassword on the Firestore profile (set at signup/reset).
 */
async function reconcileCredentials(db, uid, profile) {
  const lead = await getLeadByEmail(profile.email);
  const ilUser = await searchIlUserByEmail(profile.email);
  let zohoPassword = readPasswordFromLead(lead);
  if (!isUsableZohoPassword(zohoPassword) && ilUser) {
    if (isUsableZohoPassword(ilUser.LMS_Password)) {
      zohoPassword = ilUser.LMS_Password.trim();
    } else if (isUsableZohoPassword(ilUser.Password)) {
      zohoPassword = ilUser.Password.trim();
    }
  }
  let zohoUpdatedMs = credentialTimeMs(lead?.LMS_Password_Updated_At);
  if (!zohoUpdatedMs && ilUser?.LMS_Password_Updated_At) {
    zohoUpdatedMs = credentialTimeMs(ilUser.LMS_Password_Updated_At);
  }
  const lmsUpdatedMs = credentialTimeMs(profile.passwordUpdatedAt);
  const lmsPassword = profile.lmsCredentialPassword?.trim() || '';

  let passwordForZoho = null;
  let credentialAction = null;

  if (lmsPassword && lmsUpdatedMs >= zohoUpdatedMs) {
    passwordForZoho = lmsPassword;
    credentialAction = 'pushed_to_zoho';
  } else if (isUsableZohoPassword(zohoPassword) && zohoUpdatedMs > lmsUpdatedMs) {
    try {
      await applyFirebasePassword(uid, zohoPassword);
      const syncedAt = zohoUpdatedMs ? new Date(zohoUpdatedMs) : new Date();
      await db.collection('users').doc(uid).update({
        lmsCredentialPassword: zohoPassword,
        passwordUpdatedAt: syncedAt,
        updatedAt: new Date(),
      });
      credentialAction = 'applied_from_zoho';
    } catch (err) {
      console.warn(`Firebase password update failed for ${profile.email}:`, err.message);
      credentialAction = `firebase_password_failed:${err.message}`;
    }
  } else if (isUsableZohoPassword(zohoPassword) && !lmsPassword) {
    try {
      await applyFirebasePassword(uid, zohoPassword);
      const syncedAt = zohoUpdatedMs ? new Date(zohoUpdatedMs) : new Date();
      await db.collection('users').doc(uid).update({
        lmsCredentialPassword: zohoPassword,
        passwordUpdatedAt: syncedAt,
        updatedAt: new Date(),
      });
      credentialAction = 'seeded_from_zoho';
    } catch (err) {
      console.warn(`Firebase password seed failed for ${profile.email}:`, err.message);
      credentialAction = `firebase_password_failed:${err.message}`;
    }
  } else if (lmsPassword && !isUsableZohoPassword(zohoPassword)) {
    passwordForZoho = lmsPassword;
    credentialAction = 'pushed_to_zoho';
  } else if (lmsPassword && zohoPassword === lmsPassword) {
    passwordForZoho = lmsPassword;
    credentialAction = 'refreshed_on_lead_sync';
  }

  return { passwordForZoho, credentialAction, zohoLeadId: lead?.id || getZohoLeadId(profile) };
}

/**
 * Leave a durable trace of a failed sync.
 *
 * Deliberately swallows its own errors: this runs inside a catch block, and an
 * alert that cannot be written must not replace the failure it was recording.
 */
async function recordSyncFailure(db, email, message) {
  try {
    await db.collection(FAILURES).add({
      email: email || null,
      message: message || 'Unknown error',
      direction: 'lms-to-zoho',
      notified: false,
      at: new Date(),
    });
  } catch (err) {
    console.warn('Could not record sync failure:', err.message);
  }
}

async function syncUserToZoho(db, uid, profile, options = {}) {
  const { syncCredentials = true } = options;
  if (!isConfigured()) return { synced: false, reason: 'Zoho not configured' };
  if (!profile?.email) return { synced: false, reason: 'No email on profile' };

  let passwordForZoho = null;
  let credentialAction = null;
  let knownLeadId = getZohoLeadId(profile);

  if (syncCredentials) {
    /*
     * getLeadByEmail is two calls: a search, then a fetch by the id it found.
     * Once a profile carries zohoLeadId there is nothing to search for, so the
     * search is skipped and only the fetch is made — a third off the cost of
     * every repeat sync, which is almost all of them.
     */
    const lead = knownLeadId
      ? (await getLeadById(knownLeadId)) || (await getLeadByEmail(profile.email))
      : await getLeadByEmail(profile.email);
    if (lead) {
      await provisioning.applyEntitlements(db, uid, lead, profile);
      const freshSnap = await db.collection('users').doc(uid).get();
      profile = freshSnap.data() || profile;
      knownLeadId = lead.id || knownLeadId;
    }

    const reconciled = await reconcileCredentials(db, uid, profile);
    passwordForZoho = reconciled.passwordForZoho;
    credentialAction = reconciled.credentialAction;
    knownLeadId = reconciled.zohoLeadId || knownLeadId;
    if (
      reconciled.credentialAction?.startsWith('applied_') ||
      reconciled.credentialAction?.startsWith('seeded_')
    ) {
      const freshSnap = await db.collection('users').doc(uid).get();
      profile = freshSnap.data() || profile;
    }
    if (!passwordForZoho && isUsableZohoPassword(profile.lmsCredentialPassword)) {
      passwordForZoho = profile.lmsCredentialPassword.trim();
      credentialAction = credentialAction || 'pushed_stored_on_lead_sync';
    }
  }

  const base = profileToLeadFields(uid, profile, await loadCourseTitles(db));
  const fields = passwordForZoho
    ? leadPasswordPayload(base, passwordForZoho, {
        status: 'Active LMS credential (lead sync)',
        updatedAt: profile.passwordUpdatedAt
          ? new Date(credentialTimeMs(profile.passwordUpdatedAt)).toISOString()
          : new Date().toISOString(),
      })
    : base;

  let zohoLeadId = knownLeadId;
  try {
    zohoLeadId = (await upsertLead(fields)) || zohoLeadId;
  } catch (err) {
    console.warn(`Zoho upsert failed for ${profile.email}:`, err.message);
    await recordSyncFailure(db, profile.email, err.message);
    if (!zohoLeadId) {
      zohoLeadId = await searchLeadByEmail(profile.email);
    }
    if (!zohoLeadId) return { synced: false, reason: err.message };
  }

  /*
   * The write below re-triggers onUserProfileZohoSync, which then exits on the
   * field guard because zohoSyncedAt is not one of RELEVANT_USER_FIELDS. That
   * echo costs one extra invocation and no Zoho call.
   *
   * It stays on the profile deliberately: the admin panel reads zohoSyncedAt
   * from the user document, and the bulk paths write it there too. Moving it to
   * a subcollection to save an invocation would leave that column empty for
   * every automatically synced learner.
   */
  if (zohoLeadId && zohoLeadId !== getZohoLeadId(profile)) {
    await db.collection('users').doc(uid).update({
      zohoLeadId,
      zohoSyncedAt: new Date(),
    });
  } else if (zohoLeadId) {
    await db.collection('users').doc(uid).update({ zohoSyncedAt: new Date() });
  }

  return { synced: true, zohoLeadId, credentialAction };
}

async function logActivityToZoho(db, activity) {
  if (!isConfigured()) return { synced: false, reason: 'Zoho not configured' };

  const userSnap = await db.collection('users').doc(activity.userId).get();
  if (!userSnap.exists) return { synced: false, reason: 'User not found' };

  const profile = userSnap.data();
  let zohoLeadId = getZohoLeadId(profile);

  if (!zohoLeadId) {
    const sync = await syncUserToZoho(db, activity.userId, profile);
    zohoLeadId = sync.zohoLeadId;
  }
  if (!zohoLeadId) return { synced: false, reason: 'No Zoho lead id' };

  const token = await getAccessToken();
  if (!token) return { synced: false, reason: 'No Zoho token' };

  const noteTitle = activity.title || activity.type || 'LMS Activity';
  const noteContent = [
    `Type: ${activity.type || 'unknown'}`,
    activity.courseId ? `Course: ${activity.courseId}` : null,
    activity.metadata ? `Details: ${JSON.stringify(activity.metadata)}` : null,
    `Logged at: ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join('\n');

  const res = await zohoApiFetch(`${getApiDomain()}/crm/v2/Notes`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: [
        {
          Note_Title: noteTitle,
          Note_Content: noteContent,
          Parent_Id: {
            id: zohoLeadId,
          },
          se_module: getModule(),
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn('Zoho note failed', err);
    return { synced: false, reason: err };
  }

  return { synced: true };
}

async function assertStaff(db, uid) {
  const snap = await db.collection('users').doc(uid).get();
  const role = snap.data()?.role;
  if (!['moderator', 'admin', 'superadmin'].includes(role)) {
    throw new HttpsError('permission-denied', 'Staff access required');
  }
  return role;
}

async function assertAdmin(db, uid) {
  const snap = await db.collection('users').doc(uid).get();
  const role = snap.data()?.role;
  if (!['admin', 'superadmin'].includes(role)) {
    throw new HttpsError('permission-denied', 'Admin access required');
  }
}

const RELEVANT_USER_FIELDS = [
  'email',
  'displayName',
  'enrolledCourses',
  'role',
  'blocked',
  'program',
  'accessTier',
  'paymentStatus',
];

function userProfileChanged(before, after) {
  if (!before) return true;
  return RELEVANT_USER_FIELDS.some(
    (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field])
  );
}

async function pushIlUserCredentialsFromFields(profile, fields, statusOverride) {
  const password = (fields?.LMS_Password || fields?.password || '').trim();
  if (!isUsableZohoPassword(password) || !profile?.email) {
    return { updated: false, reason: 'No valid password or email' };
  }

  return ilUsers.updateIlUserCredentials(
    profile.email,
    {
      password,
      username: profile.lmsUsername || fields?.LMS_Username || profile.email,
      lmsUserId: profile.moodleUserId,
      ilUserRecordId: profile.zohoIlUserId,
      phone: profile.phone || profile.phoneNumber,
      status: statusOverride || fields?.LMS_Credential_Status,
      updatedAt: fields?.LMS_Password_Updated_At,
    },
    { getAccessToken, getApiDomain }
  );
}

async function upsertCredentialFields(db, uid, profile, fields) {
  let zohoLeadId = getZohoLeadId(profile);
  let leadSynced = Boolean(zohoLeadId);

  try {
    zohoLeadId = (await upsertLead(fields)) || zohoLeadId;
    leadSynced = Boolean(zohoLeadId);
  } catch (err) {
    console.warn(`Zoho Lead credential sync failed for ${profile.email}:`, err.message);
    if (!zohoLeadId) {
      zohoLeadId = await searchLeadByEmail(profile.email);
      leadSynced = Boolean(zohoLeadId);
    }
  }

  let ilResult = { updated: false };
  try {
    ilResult = await pushIlUserCredentialsFromFields(profile, fields);
  } catch (err) {
    console.warn(`IL_Users credential sync failed for ${profile.email}:`, err.message);
  }

  await db
    .collection('users')
    .doc(uid)
    .update({
      zohoSyncedAt: new Date(),
      ...(zohoLeadId && !getZohoLeadId(profile) ? { zohoLeadId } : {}),
      ...(ilResult.ilUserId && !profile.zohoIlUserId ? { zohoIlUserId: ilResult.ilUserId } : {}),
    });

  return {
    synced: leadSynced || ilResult.updated,
    zohoLeadId,
    ilUsersUpdated: ilResult.updated,
    ilUsersReason: ilResult.reason,
    ilMetaSynced: ilResult.metaSynced ?? null,
    ilMetaReason: ilResult.metaReason || null,
    zohoIlUserId: ilResult.ilUserId || profile.zohoIlUserId || null,
  };
}

async function findUserByEmail(db, email) {
  const trimmed = email?.trim();
  if (!trimmed) return null;

  let snap = await db.collection('users').where('email', '==', trimmed).limit(1).get();
  if (!snap.empty) return snap.docs[0];

  snap = await db.collection('users').where('email', '==', trimmed.toLowerCase()).limit(1).get();
  if (!snap.empty) return snap.docs[0];

  return null;
}

/** Push the current password to Zoho without changing LMS password timestamps (pre-reset snapshot). */
async function pushCredentialSnapshotToZoho(db, uid, profile, password) {
  if (!isConfigured()) return { synced: false, reason: 'Zoho not configured' };
  if (!profile?.email) return { synced: false, reason: 'No email on profile' };
  if (!isUsableZohoPassword(password)) return { synced: false, reason: 'No valid credential' };

  const base = profileToLeadFields(uid, profile, await loadCourseTitles(db));
  const updatedAt = profile.passwordUpdatedAt
    ? new Date(credentialTimeMs(profile.passwordUpdatedAt)).toISOString()
    : new Date().toISOString();
  const fields = leadPasswordPayload(base, password, {
    status: 'Active',
    updatedAt,
  });

  return upsertCredentialFields(db, uid, profile, fields);
}

/** Before reset email — snapshot last known LMS password to Zoho. */
async function syncStoredCredentialBeforeReset(db, email) {
  const doc = await findUserByEmail(db, email);
  if (!doc) return { synced: false, reason: 'Profile not found' };

  const profile = doc.data();
  const password = profile.lmsCredentialPassword?.trim();
  if (!isUsableZohoPassword(password)) {
    return { synced: false, reason: 'No stored credential to snapshot' };
  }

  return pushCredentialSnapshotToZoho(db, doc.id, profile, password);
}

/** After signup, login, or reset — store credential and push to Zoho. */
async function syncPasswordCredentialToZoho(db, uid, profile, newPassword, options = {}) {
  if (!isConfigured()) return { synced: false, reason: 'Zoho not configured' };
  if (!profile?.email) return { synced: false, reason: 'No email on profile' };

  const { status = 'Password updated via LMS' } = options;
  const base = profileToLeadFields(uid, profile, await loadCourseTitles(db));
  const fields = leadPasswordPayload(base, newPassword, { status });

  let zohoLeadId = getZohoLeadId(profile);
  try {
    zohoLeadId = (await upsertLead(fields)) || zohoLeadId;
  } catch (err) {
    console.warn(`Zoho Lead password sync failed for ${profile.email}:`, err.message);
    if (!zohoLeadId) {
      zohoLeadId = await searchLeadByEmail(profile.email);
    }
  }

  const now = new Date();
  let ilResult = { updated: false };
  try {
    ilResult = await pushIlUserCredentialsFromFields(
      profile,
      {
        ...fields,
        LMS_Password_Updated_At:
          toZohoDateTime(fields.LMS_Password_Updated_At) || toZohoDateTime(now),
      },
      status
    );
  } catch (err) {
    console.warn(`IL_Users password sync failed for ${profile.email}:`, err.message);
  }

  await db
    .collection('users')
    .doc(uid)
    .update({
      lmsCredentialPassword: newPassword,
      passwordUpdatedAt: now,
      updatedAt: now,
      zohoSyncedAt: now,
      ...(zohoLeadId && !getZohoLeadId(profile) ? { zohoLeadId } : {}),
      ...(ilResult.ilUserId && !profile.zohoIlUserId ? { zohoIlUserId: ilResult.ilUserId } : {}),
    });

  return {
    synced: Boolean(zohoLeadId) || ilResult.updated,
    zohoLeadId,
    ilUsersUpdated: ilResult.updated,
    ilUsersReason: ilResult.reason,
    ilMetaSynced: ilResult.metaSynced ?? null,
    ilMetaReason: ilResult.metaReason || null,
    zohoIlUserId: ilResult.ilUserId || profile.zohoIlUserId || null,
  };
}

/** Login/signup — refresh Zoho; full write when password changed since last sync. */
async function syncCredentialOnAuth(db, uid, profile, password) {
  if (profile.lmsCredentialPassword === password) {
    return pushCredentialSnapshotToZoho(db, uid, profile, password);
  }
  return syncPasswordCredentialToZoho(db, uid, profile, password, {
    status: 'Active',
  });
}

async function provisionUserForBatchSync(fs, email) {
  const trimmed = email?.trim();
  if (!trimmed) return { ok: false, reason: 'Email is required' };

  const deps = { getAccessToken, getApiDomain };
  const [lead, ilUserFound, ilRegRecord] = await Promise.all([
    getLeadByEmail(trimmed).catch(() => null),
    ilUsers.findIlUserRecord(trimmed, trimmed, deps, {}).catch(() => null),
    ilRegistration.searchIlRegistrationByEmail(trimmed, deps).catch(() => null),
  ]);

  let ilUser = ilUserFound;
  if (!ilUsers.hasUsableIlPassword(ilUser)) {
    const lookupId = ilRegistration.extractIlUserLookupId(ilRegRecord);
    if (lookupId) {
      ilUser = (await ilUsers.getIlUserById(lookupId, deps)) || ilUser;
    }
  }

  const regCreds = ilRegistration.registrationToCredentialFields(ilRegRecord);
  const ilForMerge =
    ilUser || Object.keys(regCreds).length ? { ...(ilUser || {}), ...regCreds } : null;

  if (!lead && !ilForMerge) {
    return {
      ok: false,
      reason: 'No Zoho Lead, IL_Users, or IL_Registration record found for this email',
    };
  }

  const record = provisioning.mergeProvisioningRecord(lead, ilForMerge, null);
  const ent = provisioning.parseEntitlementsFromRecord(record);
  if (!ent.password || ent.password.length < 6) {
    const bits = [];
    if (lead?.id) bits.push('Lead found');
    if (ilUser?.id) bits.push(`IL_Users ${ilUser.id} (no LMS_Password/Password)`);
    if (ilRegRecord?.id) {
      const regKeys = Object.keys(ilRegRecord).filter((key) => /password|username|user/i.test(key));
      bits.push(
        ilRegistration.hasRegistrationCredentials(ilRegRecord)
          ? `IL_Registration ${ilRegRecord.id} (password field not mapped)`
          : `IL_Registration ${ilRegRecord.id} (no password on record${
              regKeys.length ? `; credential-like fields: ${regKeys.join(', ')}` : ''
            })`
      );
    }
    const ilUserLink = ilRegistration.extractIlUserLookupId(ilRegRecord);
    if (ilUserLink && !ilUser?.id)
      bits.push(`IL_Registration links IL_User ${ilUserLink} (lookup failed)`);

    return {
      ok: false,
      reason:
        'Password not found for batch provisioning — set LMS_Password on linked IL_Users ' +
        'or Password/LMS_Password on IL_Registration. ' +
        (bits.length ? `Checked: ${bits.join('; ')}.` : 'No credential fields returned from Zoho.'),
    };
  }

  return provisioning.provisionFromRecord(fs, record, { skipUnpaidCheck: true });
}

/**
 * Run one reconciler pass.
 *
 * Wires the pure loop in zohoReconcile.js to Zoho and Firestore. Provisioning
 * reuses provisionUserForBatchSync because it already reads all three modules —
 * Leads, IL_Users and IL_Registration — and IL_Registration is where the
 * credentials actually live.
 */
async function runZohoReconcile(db, options = {}) {
  /*
   * A catch-up names its own start date and must not touch the live watermark.
   * The scheduled pass is tracking the present; a sweep of last month has no
   * business rewinding it, and writing a month-old timestamp back would make
   * the next scheduled pass re-read everything since.
   */
  const catchUpFrom = options.since || null;

  const reconcileDeps = {
    readWatermark: async () => {
      if (catchUpFrom) return catchUpFrom;
      const snap = await db.doc(reconciler.WATERMARK_DOC).get();
      return snap.exists ? snap.data()?.ilUsersModifiedSince || null : null;
    },
    writeWatermark: async (value) => {
      if (catchUpFrom) return;
      await db
        .doc(reconciler.WATERMARK_DOC)
        .set({ ilUsersModifiedSince: value, lastRunAt: new Date() }, { merge: true });
    },
    queryIlUsers: async (since, limit, offset = 0) => {
      const token = await getAccessToken();
      /*
       * Filtered first, unfiltered as a fallback. The filter cuts out the ~97%
       * of IL Users edits that touch nothing to do with access, but if this
       * Zoho org rejects the compound condition the reconciler must keep
       * working rather than stop on a refinement.
       */
      let query = reconciler.buildQuery(since, ilUsers.getIlUsersModule(), limit, offset, true);
      let usedFallback = false;
      // Same version ladder the registration reader uses: Zoho answers an
      // unsupported endpoint and an invalid column with the same opaque error,
      // so a single attempt cannot tell "no records" from "never ran".
      let lastError = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        for (const version of ['v7', 'v6', 'v2']) {
          const res = await zohoApiFetch(`${getApiDomain()}/crm/${version}/coql`, {
            method: 'POST',
            headers: {
              Authorization: `Zoho-oauthtoken ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ select_query: query }),
          });
          if (res.status === 204) return [];
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            lastError = `${version}: ${body?.message || `HTTP ${res.status}`}`;
            continue;
          }
          const body = await res.json();
          return body?.data || [];
        }
        if (usedFallback) break;
        console.warn(`IL_Users filtered query rejected (${lastError}); retrying unfiltered`);
        query = reconciler.buildQuery(since, ilUsers.getIlUsersModule(), limit, offset, false);
        usedFallback = true;
      }
      throw new Error(`IL_Users COQL failed — ${lastError || 'no version accepted the query'}`);
    },
    hasAccount: async (email) => {
      const found = await provisioning.getAuthUserByEmail(email);
      return Boolean(found);
    },
    provision: (email) => provisionUserForBatchSync(db, email),
    applyEntitlements: (email) =>
      provisioning.syncEntitlementsFromZoho(db, getLeadByEmail, searchIlUserByEmail, email, null, {
        provisionMissing: (addr) => provisionUserForBatchSync(db, addr),
      }),
    recordFailure: (email, message) => recordSyncFailure(db, email, message),
  };

  return reconciler.runReconcile(reconcileDeps, options);
}

function buildBatchSyncDeps(db) {
  return {
    db,
    getAccessToken,
    getApiDomain,
    getModule,
    getLeadByEmail,
    searchIlUserByEmail,
    searchIlRegistrationByEmail: (email) =>
      ilRegistration.searchIlRegistrationByEmail(email, { getAccessToken, getApiDomain }),
    fetchIlRegistrationWithBatch: ilRegistration.fetchIlRegistrationWithBatch,
    previewLeadCohorts: leadsCohort.previewLeadCohorts,
    provisionUserFromEmail: (fs, email) => provisionUserForBatchSync(fs, email),
    applyEntitlements: provisioning.applyEntitlements,
  };
}

async function runUserBatchSync(db, email, opts = {}) {
  return batchApply.syncUserBatchFromZoho(
    {
      email,
      dryRun: opts.dryRun === true,
      triggeredBy: opts.triggeredBy || null,
      provisionIfMissing: opts.provisionIfMissing !== false,
    },
    buildBatchSyncDeps(db)
  );
}

/**
 * First-login welcome / batch fields → Lead.
 * Accepts legacy email string, or `{ email, phone, leadId }` for phone-login learners.
 */
async function updateLeadWelcomeFields(emailOrIdentity, fields = {}) {
  let email = '';
  let phone = '';
  let leadId = null;
  let uid = null;
  if (typeof emailOrIdentity === 'string') {
    email = emailOrIdentity.trim();
  } else if (emailOrIdentity && typeof emailOrIdentity === 'object') {
    email = String(emailOrIdentity.email || '').trim();
    phone = String(emailOrIdentity.phone || '').trim();
    leadId = emailOrIdentity.leadId || emailOrIdentity.zohoLeadId || null;
    uid = emailOrIdentity.uid || null;
  }

  const payload = welcomeFieldsToLeadPayload(fields);
  if (!Object.keys(payload).length) return null;

  if (!leadId && uid) {
    leadId = await searchLeadByFirebaseUid(uid);
  }
  if (!leadId && email) {
    leadId = await searchLeadByEmail(email);
  }
  if (!leadId && phone) {
    leadId = await searchLeadByPhone(phone);
  }

  if (leadId) {
    return updateLeadByIdResilient(leadId, payload);
  }

  if (!email) {
    return null;
  }
  return upsertLead({ Email: email, ...payload });
}

module.exports = {
  /** Zoho + Firestore helpers the batch syncs share (used by zohoCmsSync). */
  buildBatchSyncDeps,
  runZohoReconcile: (db, options) => runZohoReconcile(db, options),
  /** Exported for the outbound-payload test — see zohoOutbound.test.js. */
  profileToLeadFields,
  toZohoDateTime,
  leadPasswordPayload,
  isConfigured,
  getAccessToken,
  getApiDomain,
  updateLeadWelcomeFields,
  getLeadByEmail,
  getLeadById,
  searchLeadByPhone,
  searchLeadsByPhone,
  createLead,
  syncUserToZoho,
  syncPasswordCredentialToZoho,
  syncCredentialOnAuth,
  syncStoredCredentialBeforeReset,
  provisionUserFromLead: (db, lead, opts) => provisioning.provisionFromRecord(db, lead, opts),
  provisionUserFromEmail: (db, email) =>
    provisioning.provisionUserFromEmail(
      db,
      getLeadByEmail,
      searchIlUserByEmail,
      email,
      null,
      zohoEnrollmentDeps()
    ),
  /** Lead Status changed in Zoho — refresh entitlements, create nothing. */
  syncEntitlementsFromZoho: (db, email, body) =>
    provisioning.syncEntitlementsFromZoho(db, getLeadByEmail, searchIlUserByEmail, email, body, {
      // Reads IL_Registration as well as Leads and IL_Users, so a status change
      // can create the account the registration webhook never did.
      provisionMissing: (addr) => provisionUserForBatchSync(db, addr),
      ...zohoEnrollmentDeps(),
    }),
  provisionFromRegistrationWebhook: async (db, body) => {
    const result = await provisioning.provisionFromRegistrationWebhook(db, body, {
      getLeadByEmail,
      searchIlUserByEmail,
      ...zohoEnrollmentDeps(),
    });

    if (result.ok && result.uid && isConfigured()) {
      const snap = await db.collection('users').doc(result.uid).get();
      const profile = snap.data();
      const password = profile?.lmsCredentialPassword?.trim();
      if (isUsableZohoPassword(password)) {
        try {
          const base = profileToLeadFields(result.uid, profile, await loadCourseTitles(db));
          await upsertCredentialFields(
            db,
            result.uid,
            profile,
            leadPasswordPayload(base, password, {
              status: 'Synced after Zoho webhook provision',
              updatedAt: new Date().toISOString(),
            })
          );
        } catch (err) {
          console.warn(
            `Post-provision Zoho credential sync failed for ${profile?.email}:`,
            err.message
          );
        }
      }
    }

    const syncEmail = (body?.email || body?.Email || result?.email || '').trim();
    if (result.ok && syncEmail) {
      try {
        result.batchSync = await runUserBatchSync(db, syncEmail, {
          triggeredBy: 'provision-webhook',
        });
      } catch (err) {
        console.warn(`Batch sync after provision failed for ${syncEmail}:`, err.message);
        result.batchSync = { ok: false, reason: err.message || String(err) };
      }
    }

    return result;
  },
  provisionFromLoginCredentials: (db, email, password) =>
    provisioning.provisionFromLoginCredentials(db, email, password, {
      getLeadByEmail,
      searchIlUserByEmail,
      findIlUserRecord: ilUsers.findIlUserRecord,
      getAccessToken,
      getApiDomain,
    }),
  searchIlUserByEmail,
  diagnoseIlUserLookup: (email, username, options = {}) =>
    ilUsers.diagnoseIlUserLookup(email, username, { getAccessToken, getApiDomain }, options),
  logActivityToZoho,
  assertStaff,
  assertAdmin,
  listLeadsPage,
  listIlUsersPage: (opts) => ilUsers.listIlUsersPage(opts, { getAccessToken, getApiDomain }),
  listIlRegistrationPage: (opts) =>
    ilRegistration.listIlRegistrationPage(opts, { getAccessToken, getApiDomain }),
  /** Batch mapping preview — read-only, writes nothing. */
  previewBatchSync: (opts) =>
    batchSync.previewBatchSync(opts, {
      getAccessToken,
      getApiDomain,
      getModule,
      fetchIlRegistrationWithBatch: ilRegistration.fetchIlRegistrationWithBatch,
      previewLeadCohorts: leadsCohort.previewLeadCohorts,
    }),
  /** Apply one Zoho cohort to Firestore (admin only). */
  applyBatchSync: (firestore, opts) =>
    batchApply.applyBatchSync(opts, buildBatchSyncDeps(firestore)),
  /**
   * Bulk sync IL Registration + Contacts → LMS accounts + paid status.
   * Paginated; dry-run by default. Admin continues until moreRecords is false.
   */
  runRosterSync: (firestore, opts) =>
    rosterSync.runRosterSync(opts, {
      db: firestore,
      getAccessToken,
      getApiDomain,
      provisionUserFromEmail: (fs, email) => provisionUserForBatchSync(fs, email),
    }),
  /** Sync one learner's batch from Zoho into Firestore groups. */
  syncUserBatchFromZoho: (firestore, email, opts = {}) => runUserBatchSync(firestore, email, opts),
  /** Unique Leads LEP_Batch strings for mobile staff CMS (Delivery Desk cohort list). */
  listCmsLepBatchKeys: () =>
    leadsCohort.listUniqueLepBatchValues({ getAccessToken, getApiDomain, getModule }),
  userProfileChanged,
};
