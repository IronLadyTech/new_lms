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
const { entitlementsToLeadFields, readPasswordFromLead } = require('./zohoFieldMap');

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
    process.env.ZOHO_CLIENT_ID &&
      process.env.ZOHO_CLIENT_SECRET &&
      process.env.ZOHO_REFRESH_TOKEN
  );
}

/** Read linked Zoho Lead id (supports legacy zohoContactId from older syncs). */
function getZohoLeadId(profile) {
  return profile?.zohoLeadId || profile?.zohoContactId || null;
}

async function getAccessToken() {
  if (!isConfigured()) return null;
  if (cachedAccessToken && Date.now() < tokenExpiry) return cachedAccessToken;

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
  cachedAccessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedAccessToken;
}

function leadPayload({ uid, email, displayName, enrolledCourses = [], role, blocked, program, accessTier, paymentStatus }) {
  const courses = Array.isArray(enrolledCourses) ? enrolledCourses : [];
  const payload = {
    Email: email,
    Last_Name: displayName || email?.split('@')[0] || 'User',
    Description: `Firebase UID: ${uid}`,
    Enrolled_Courses: courses.join(', '),
    LMS_Role: role || 'student',
    LMS_Blocked: blocked ? 'Yes' : 'No',
    Firebase_UID: uid,
  };

  Object.assign(payload, entitlementsToLeadFields({ program, accessTier, paymentStatus }));

  return payload;
}

function profileToLeadFields(uid, profile) {
  return leadPayload({
    uid,
    email: profile.email,
    displayName: profile.displayName,
    enrolledCourses: profile.enrolledCourses,
    role: profile.role,
    blocked: profile.blocked,
    program: profile.program,
    accessTier: profile.accessTier,
    paymentStatus: profile.paymentStatus,
  });
}

function leadPasswordPayload(baseFields, password, options = {}) {
  const {
    status = 'Password updated via LMS',
    updatedAt = new Date().toISOString(),
  } = options;
  return {
    ...baseFields,
    LMS_Password: password,
    LMS_Password_Updated_At: updatedAt,
    LMS_Credential_Status: status,
  };
}

async function upsertLead(fields) {
  const token = await getAccessToken();
  if (!token) throw new Error('Unable to obtain Zoho access token');

  const res = await fetch(`${getApiDomain()}/crm/v2/${getModule()}/upsert`, {
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
    throw new Error(row.message || 'Zoho upsert failed');
  }

  return row?.details?.id || null;
}

async function searchLeadByEmail(email) {
  const token = await getAccessToken();
  if (!token || !email) return null;

  const criteria = encodeURIComponent(`(Email:equals:${email})`);
  const res = await fetch(
    `${getApiDomain()}/crm/v2/${getModule()}/search?criteria=${criteria}`,
    { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
  );

  if (res.status === 204) return null;
  if (!res.ok) return null;

  const body = await res.json();
  return body?.data?.[0]?.id || null;
}

async function searchIlUserByEmail(email) {
  return ilUsers.searchIlUserByEmail(email, { getAccessToken, getApiDomain });
}

async function getLeadById(leadId) {
  const token = await getAccessToken();
  if (!token || !leadId) return null;

  const res = await fetch(`${getApiDomain()}/crm/v2/${getModule()}/${leadId}`, {
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

  const res = await fetch(`${getApiDomain()}/crm/v2/${getModule()}/${leadId}`, {
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
  if (!isUsableZohoPassword(zohoPassword) && isUsableZohoPassword(ilUser?.Password)) {
    zohoPassword = ilUser.Password.trim();
  }
  const zohoUpdatedMs = credentialTimeMs(lead?.LMS_Password_Updated_At);
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

async function syncUserToZoho(db, uid, profile, options = {}) {
  const { syncCredentials = true } = options;
  if (!isConfigured()) return { synced: false, reason: 'Zoho not configured' };
  if (!profile?.email) return { synced: false, reason: 'No email on profile' };

  let passwordForZoho = null;
  let credentialAction = null;
  let knownLeadId = getZohoLeadId(profile);

  if (syncCredentials) {
    const lead = await getLeadByEmail(profile.email);
    if (lead) {
      await provisioning.applyEntitlementsFromLead(db, uid, lead, profile);
      const freshSnap = await db.collection('users').doc(uid).get();
      profile = freshSnap.data() || profile;
      knownLeadId = lead.id || knownLeadId;
    }

    const reconciled = await reconcileCredentials(db, uid, profile);
    passwordForZoho = reconciled.passwordForZoho;
    credentialAction = reconciled.credentialAction;
    knownLeadId = reconciled.zohoLeadId || knownLeadId;
    if (reconciled.credentialAction?.startsWith('applied_') || reconciled.credentialAction?.startsWith('seeded_')) {
      const freshSnap = await db.collection('users').doc(uid).get();
      profile = freshSnap.data() || profile;
    }
    if (!passwordForZoho && isUsableZohoPassword(profile.lmsCredentialPassword)) {
      passwordForZoho = profile.lmsCredentialPassword.trim();
      credentialAction = credentialAction || 'pushed_stored_on_lead_sync';
    }
  }

  const base = profileToLeadFields(uid, profile);
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
    if (!zohoLeadId) {
      zohoLeadId = await searchLeadByEmail(profile.email);
    }
    if (!zohoLeadId) return { synced: false, reason: err.message };
  }

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

  const res = await fetch(`${getApiDomain()}/crm/v2/Notes`, {
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

async function upsertCredentialFields(db, uid, profile, fields) {
  let zohoLeadId = getZohoLeadId(profile);
  try {
    zohoLeadId = (await upsertLead(fields)) || zohoLeadId;
  } catch (err) {
    console.warn(`Zoho credential sync failed for ${profile.email}:`, err.message);
    if (!zohoLeadId) {
      zohoLeadId = await searchLeadByEmail(profile.email);
    }
    if (!zohoLeadId) throw err;
  }

  const password = fields?.LMS_Password?.trim();
  if (isUsableZohoPassword(password)) {
    try {
      await ilUsers.updateIlUserCredentials(
        profile.email,
        {
          password,
          username: profile.lmsUsername || fields?.LMS_Username || profile.email,
          lmsUserId: profile.moodleUserId,
        },
        { getAccessToken, getApiDomain }
      );
    } catch (err) {
      console.warn(`IL_Users credential sync failed for ${profile.email}:`, err.message);
    }
  }

  await db.collection('users').doc(uid).update({
    zohoSyncedAt: new Date(),
    ...(zohoLeadId && !getZohoLeadId(profile) ? { zohoLeadId } : {}),
  });

  return { synced: true, zohoLeadId };
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

  const base = profileToLeadFields(uid, profile);
  const updatedAt = profile.passwordUpdatedAt
    ? new Date(credentialTimeMs(profile.passwordUpdatedAt)).toISOString()
    : new Date().toISOString();
  const fields = leadPasswordPayload(base, password, {
    status: 'Active LMS credential (pre-reset)',
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
  const base = profileToLeadFields(uid, profile);
  const fields = leadPasswordPayload(base, newPassword, { status });

  let zohoLeadId = getZohoLeadId(profile);
  try {
    zohoLeadId = (await upsertLead(fields)) || zohoLeadId;
  } catch (err) {
    console.warn(`Zoho password sync failed for ${profile.email}:`, err.message);
    if (!zohoLeadId) {
      zohoLeadId = await searchLeadByEmail(profile.email);
    }
    if (!zohoLeadId) throw err;
  }

  const now = new Date();
  await db.collection('users').doc(uid).update({
    lmsCredentialPassword: newPassword,
    passwordUpdatedAt: now,
    updatedAt: now,
    zohoSyncedAt: now,
    ...(zohoLeadId && !getZohoLeadId(profile) ? { zohoLeadId } : {}),
  });

  try {
    await ilUsers.updateIlUserCredentials(
      profile.email,
      {
        password: newPassword,
        username: profile.lmsUsername || profile.email,
        lmsUserId: profile.moodleUserId,
      },
      { getAccessToken, getApiDomain }
    );
  } catch (err) {
    console.warn(`IL_Users password sync failed for ${profile.email}:`, err.message);
  }

  return { synced: true, zohoLeadId };
}

/** Login/signup — refresh Zoho; full write when password changed since last sync. */
async function syncCredentialOnAuth(db, uid, profile, password) {
  if (profile.lmsCredentialPassword === password) {
    return pushCredentialSnapshotToZoho(db, uid, profile, password);
  }
  return syncPasswordCredentialToZoho(db, uid, profile, password, {
    status: 'Active LMS credential',
  });
}

module.exports = {
  isConfigured,
  getAccessToken,
  getLeadByEmail,
  getLeadById,
  syncUserToZoho,
  syncPasswordCredentialToZoho,
  syncCredentialOnAuth,
  syncStoredCredentialBeforeReset,
  provisionUserFromLead: (db, lead, opts) => provisioning.provisionFromRecord(db, lead, opts),
  provisionUserFromEmail: (db, email) =>
    provisioning.provisionUserFromEmail(db, getLeadByEmail, searchIlUserByEmail, email),
  provisionFromRegistrationWebhook: async (db, body) => {
    const result = await provisioning.provisionFromRegistrationWebhook(db, body, {
      getLeadByEmail,
      searchIlUserByEmail,
    });

    if (result.ok && result.uid && isConfigured()) {
      const snap = await db.collection('users').doc(result.uid).get();
      const profile = snap.data();
      const password = profile?.lmsCredentialPassword?.trim();
      if (isUsableZohoPassword(password)) {
        try {
          const base = profileToLeadFields(result.uid, profile);
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
          console.warn(`Post-provision Zoho credential sync failed for ${profile?.email}:`, err.message);
        }
      }
    }

    return result;
  },
  searchIlUserByEmail,
  logActivityToZoho,
  assertStaff,
  assertAdmin,
  userProfileChanged,
};
