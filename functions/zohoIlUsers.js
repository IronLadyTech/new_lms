/**
 * IL_Users module — where Pre-IL → IL registration stores Username / Password (existing Zoho flow).
 * Old Moodle LMS reads this module; new LMS reads the same records in parallel.
 */

function getIlUsersModule() {
  return process.env.ZOHO_IL_USERS_MODULE || 'IL_Users';
}

async function searchIlUserByEmail(email, { getAccessToken, getApiDomain }) {
  const token = await getAccessToken();
  if (!token || !email) return null;

  const module = getIlUsersModule();
  const criteria = encodeURIComponent(`(Email:equals:${email.trim()})`);
  const res = await fetch(`${getApiDomain()}/crm/v2/${module}/search?criteria=${criteria}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });

  if (res.status === 204) return null;
  if (!res.ok) {
    console.warn(`IL_Users search failed for ${email}:`, res.status);
    return null;
  }

  const body = await res.json();
  return body?.data?.[0] || null;
}

function ilUserToCredentialFields(ilUser) {
  if (!ilUser) return {};
  return {
    Email: ilUser.Email,
    Username: ilUser.Username,
    Password: ilUser.Password,
    LMS_User_Id: ilUser.LMS_User_Id,
    Phone: ilUser.Phone,
    id: ilUser.id,
  };
}

/** Keeps IL_Users in sync when students change password on the new LMS. */
async function updateIlUserCredentials(email, fields, { getAccessToken, getApiDomain }) {
  const trimmed = email?.trim();
  if (!trimmed) return { updated: false, reason: 'No email' };

  const ilUser = await searchIlUserByEmail(trimmed, { getAccessToken, getApiDomain });
  if (!ilUser?.id) return { updated: false, reason: 'IL_Users record not found' };

  const payload = {};
  if (fields.password) payload.Password = fields.password;
  if (fields.username) payload.Username = fields.username;
  if (fields.lmsUserId) payload.LMS_User_Id = String(fields.lmsUserId);

  if (!Object.keys(payload).length) return { updated: false, reason: 'Nothing to update' };

  const token = await getAccessToken();
  if (!token) return { updated: false, reason: 'No Zoho token' };

  const module = getIlUsersModule();
  const res = await fetch(`${getApiDomain()}/crm/v2/${module}/${ilUser.id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: [payload] }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn(`IL_Users update failed for ${trimmed}:`, body?.message || res.status);
    return { updated: false, reason: body?.message || `HTTP ${res.status}` };
  }

  const row = body?.data?.[0];
  if (row?.status === 'error') {
    return { updated: false, reason: row.message || 'IL_Users update error' };
  }

  return { updated: true, ilUserId: ilUser.id };
}

module.exports = {
  getIlUsersModule,
  searchIlUserByEmail,
  ilUserToCredentialFields,
  updateIlUserCredentials,
};
