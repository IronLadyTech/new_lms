/**
 * Zoho CRM parallel sync — mirrors Firebase user/enrollment data.
 * Uses refresh token flow; in production, proxy tokens through a backend.
 */

const ZOHO_DOMAIN = import.meta.env.VITE_ZOHO_API_DOMAIN || 'https://www.zohoapis.com';
const CLIENT_ID = import.meta.env.VITE_ZOHO_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_ZOHO_CLIENT_SECRET;
const REFRESH_TOKEN = import.meta.env.VITE_ZOHO_REFRESH_TOKEN;
const CRM_MODULE = import.meta.env.VITE_ZOHO_CRM_MODULE || 'Contacts';

let cachedAccessToken = null;
let tokenExpiry = 0;

export function isZohoConfigured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);
}

async function getAccessToken() {
  if (!isZohoConfigured()) return null;
  if (cachedAccessToken && Date.now() < tokenExpiry) return cachedAccessToken;

  const res = await fetch(`${ZOHO_DOMAIN}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: REFRESH_TOKEN,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
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

export async function syncUserToZoho({ email, displayName, uid, enrolledCourses = [] }) {
  if (!isZohoConfigured()) {
    return { synced: false, reason: 'Zoho not configured' };
  }

  const token = await getAccessToken();
  if (!token) return { synced: false, reason: 'No Zoho token' };

  const payload = {
    data: [
      {
        Email: email,
        Last_Name: displayName || email.split('@')[0],
        Description: `Firebase UID: ${uid}`,
        Enrolled_Courses: enrolledCourses.join(', '),
      },
    ],
  };

  const res = await fetch(`${ZOHO_DOMAIN}/crm/v2/${CRM_MODULE}/upsert`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      duplicate_check_fields: ['Email'],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn('Zoho upsert failed', err);
    return { synced: false, reason: err };
  }

  const result = await res.json();
  return { synced: true, result };
}

export async function logActivityToZoho({ email, activityType, courseId, metadata = {} }) {
  if (!isZohoConfigured()) return { synced: false };

  const token = await getAccessToken();
  if (!token) return { synced: false };

  const note = `Activity: ${activityType} | Course: ${courseId || 'N/A'} | ${JSON.stringify(metadata)}`;

  const res = await fetch(`${ZOHO_DOMAIN}/crm/v2/Notes`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: [{ Note_Title: activityType, Note_Content: note, Parent_Id: email }],
    }),
  });

  return { synced: res.ok };
}
