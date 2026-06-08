/**
 * Zoho CRM integration — server-side only (secrets never in the browser).
 * Credentials live in functions/.env (gitignored), loaded by Firebase on deploy.
 */

const { HttpsError } = require('firebase-functions/v2/https');

const DEFAULT_API_DOMAIN = 'https://www.zohoapis.in';
const DEFAULT_MODULE = 'Contacts';

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

function contactPayload({ uid, email, displayName, enrolledCourses = [], role, blocked }) {
  const courses = Array.isArray(enrolledCourses) ? enrolledCourses : [];
  return {
    Email: email,
    Last_Name: displayName || email?.split('@')[0] || 'User',
    Description: `Firebase UID: ${uid}`,
    Enrolled_Courses: courses.join(', '),
    LMS_Role: role || 'student',
    LMS_Blocked: blocked ? 'Yes' : 'No',
    Firebase_UID: uid,
  };
}

async function upsertContact(fields) {
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

async function searchContactByEmail(email) {
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

async function syncUserToZoho(db, uid, profile) {
  if (!isConfigured()) return { synced: false, reason: 'Zoho not configured' };
  if (!profile?.email) return { synced: false, reason: 'No email on profile' };

  const fields = contactPayload({
    uid,
    email: profile.email,
    displayName: profile.displayName,
    enrolledCourses: profile.enrolledCourses,
    role: profile.role,
    blocked: profile.blocked,
  });

  let zohoContactId = profile.zohoContactId || null;
  try {
    zohoContactId = (await upsertContact(fields)) || zohoContactId;
  } catch (err) {
    console.warn(`Zoho upsert failed for ${profile.email}:`, err.message);
    if (!zohoContactId) {
      zohoContactId = await searchContactByEmail(profile.email);
    }
    if (!zohoContactId) return { synced: false, reason: err.message };
  }

  if (zohoContactId && zohoContactId !== profile.zohoContactId) {
    await db.collection('users').doc(uid).update({
      zohoContactId,
      zohoSyncedAt: new Date(),
    });
  } else if (zohoContactId) {
    await db.collection('users').doc(uid).update({ zohoSyncedAt: new Date() });
  }

  return { synced: true, zohoContactId };
}

async function logActivityToZoho(db, activity) {
  if (!isConfigured()) return { synced: false, reason: 'Zoho not configured' };

  const userSnap = await db.collection('users').doc(activity.userId).get();
  if (!userSnap.exists) return { synced: false, reason: 'User not found' };

  const profile = userSnap.data();
  let zohoContactId = profile.zohoContactId;

  if (!zohoContactId) {
    const sync = await syncUserToZoho(db, activity.userId, profile);
    zohoContactId = sync.zohoContactId;
  }
  if (!zohoContactId) return { synced: false, reason: 'No Zoho contact id' };

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
            id: zohoContactId,
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

const RELEVANT_USER_FIELDS = ['email', 'displayName', 'enrolledCourses', 'role', 'blocked'];

function userProfileChanged(before, after) {
  if (!before) return true;
  return RELEVANT_USER_FIELDS.some(
    (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field])
  );
}

module.exports = {
  isConfigured,
  getAccessToken,
  syncUserToZoho,
  logActivityToZoho,
  assertStaff,
  assertAdmin,
  userProfileChanged,
};
