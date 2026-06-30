/**
 * IL_Users module — where Pre-IL → IL registration stores Username / Password (existing Zoho flow).
 * Old Moodle LMS reads this module; new LMS reads the same records in parallel.
 */

function getIlUsersModule() {
  return process.env.ZOHO_IL_USERS_MODULE || 'IL_Users';
}

function getIlRegistrationModule() {
  return process.env.ZOHO_IL_REGISTRATION_MODULE || 'IL_Registration';
}

function getFieldNames() {
  return {
    email: process.env.ZOHO_IL_USERS_EMAIL_FIELD?.trim() || 'Email',
    username: process.env.ZOHO_IL_USERS_USERNAME_FIELD?.trim() || 'Username',
    phone: process.env.ZOHO_IL_USERS_PHONE_FIELD?.trim() || 'Phone',
    regEmail: process.env.ZOHO_IL_REG_EMAIL_FIELD?.trim() || 'Email',
    regUserLookup:
      process.env.ZOHO_IL_REG_ILUSER_LOOKUP_FIELD?.trim() || 'IL_User',
    credentialStatus:
      process.env.ZOHO_IL_CREDENTIAL_STATUS_FIELD?.trim() || 'LMS_Credential_Status',
    passwordUpdatedAt:
      process.env.ZOHO_IL_PASSWORD_UPDATED_AT_FIELD?.trim() || 'LMS_Password_Updated_At',
  };
}

/** When false (default), new LMS writes LMS_Password only — legacy Password stays for old Moodle. */
function shouldSyncLegacyIlPassword() {
  const raw = process.env.ZOHO_SYNC_IL_USERS_LEGACY_PASSWORD?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function escapeCoql(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function zohoCoql(selectQuery, deps) {
  const token = await deps.getAccessToken();
  if (!token || !selectQuery) return null;

  for (const version of ['v6', 'v7']) {
    const res = await fetch(`${deps.getApiDomain()}/crm/${version}/coql`, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ select_query: selectQuery }),
    });

    if (res.status === 204) return null;
    if (!res.ok) {
      deps.lastApiError = `coql ${version} HTTP ${res.status}`;
      if (res.status === 401 || res.status === 403) deps.permissionDenied = true;
      continue;
    }

    const body = await res.json();
    return body?.data?.[0] || null;
  }

  return null;
}

async function searchIlUserByCriteria(criteria, deps) {
  const token = await deps.getAccessToken();
  if (!token || !criteria) return null;

  const module = getIlUsersModule();
  const encoded = encodeURIComponent(criteria);
  const res = await fetch(`${deps.getApiDomain()}/crm/v2/${module}/search?criteria=${encoded}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });

  if (res.status === 204) return null;
  if (!res.ok) {
    deps.lastApiError = `criteria search HTTP ${res.status}`;
    console.warn(`IL_Users search failed (${criteria}):`, res.status);
    return null;
  }

  const body = await res.json();
  return body?.data?.[0] || null;
}

/** Zoho native email param — often works when criteria search fails on custom modules. */
async function searchIlUserByEmailParam(email, deps) {
  const token = await deps.getAccessToken();
  const trimmed = email?.trim();
  if (!token || !trimmed) return null;

  const module = getIlUsersModule();
  const res = await fetch(
    `${deps.getApiDomain()}/crm/v2/${module}/search?email=${encodeURIComponent(trimmed)}`,
    { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
  );

  if (res.status === 204) return null;
  if (!res.ok) {
    deps.lastApiError = `email search HTTP ${res.status}`;
    if (res.status === 401 || res.status === 403) {
      deps.permissionDenied = true;
    }
    return null;
  }

  const body = await res.json();
  return body?.data?.[0] || null;
}

function phoneVariants(phone) {
  const raw = String(phone || '').replace(/\D/g, '');
  if (!raw) return [];
  const variants = new Set([raw]);
  if (raw.startsWith('91') && raw.length > 10) variants.add(raw.slice(2));
  if (!raw.startsWith('91') && raw.length === 10) variants.add(`91${raw}`);
  return [...variants];
}

async function searchIlUserByPhone(phone, deps) {
  const token = await deps.getAccessToken();
  if (!token) return null;

  const module = getIlUsersModule();
  for (const variant of phoneVariants(phone)) {
    const res = await fetch(
      `${deps.getApiDomain()}/crm/v2/${module}/search?phone=${encodeURIComponent(variant)}`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    if (res.status === 204) continue;
    if (!res.ok) {
      deps.lastApiError = `phone search HTTP ${res.status}`;
      if (res.status === 401 || res.status === 403) deps.permissionDenied = true;
      continue;
    }
    const body = await res.json();
    if (body?.data?.[0]) return body.data[0];
  }
  return null;
}

async function searchIlUserByEmail(email, deps) {
  const trimmed = email?.trim();
  if (!trimmed) return null;

  const { email: emailField } = getFieldNames();
  return searchIlUserByCriteria(`(${emailField}:equals:${trimmed})`, deps);
}

async function searchIlUserByUsername(username, deps) {
  const trimmed = username?.trim();
  if (!trimmed) return null;

  const { username: usernameField } = getFieldNames();
  return searchIlUserByCriteria(`(${usernameField}:equals:${trimmed})`, deps);
}

async function searchIlUserByEmailOrUsername(value, deps) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const { email: emailField, username: usernameField } = getFieldNames();
  return searchIlUserByCriteria(
    `((${emailField}:equals:${trimmed})or(${usernameField}:equals:${trimmed}))`,
    deps
  );
}

async function searchIlUserByCoql(email, username, phone, deps) {
  const module = getIlUsersModule();
  const { email: emailField, username: usernameField, phone: phoneField } = getFieldNames();
  const trimmedEmail = email?.trim();
  const trimmedUsername = username?.trim();
  const trimmedPhone = phone?.trim();

  const queries = [];
  if (trimmedEmail) {
    queries.push(
      `select id, ${emailField}, ${usernameField} from ${module} where ${emailField} = '${escapeCoql(trimmedEmail)}' limit 1`
    );
    if (trimmedEmail !== trimmedEmail.toLowerCase()) {
      queries.push(
        `select id, ${emailField}, ${usernameField} from ${module} where ${emailField} = '${escapeCoql(trimmedEmail.toLowerCase())}' limit 1`
      );
    }
  }

  const userLookup = trimmedUsername || trimmedEmail;
  if (userLookup) {
    queries.push(
      `select id, ${emailField}, ${usernameField} from ${module} where ${usernameField} = '${escapeCoql(userLookup)}' limit 1`
    );
    if (userLookup !== userLookup.toLowerCase()) {
      queries.push(
        `select id, ${emailField}, ${usernameField} from ${module} where ${usernameField} = '${escapeCoql(userLookup.toLowerCase())}' limit 1`
      );
    }
  }

  if (trimmedPhone) {
    for (const variant of phoneVariants(trimmedPhone)) {
      queries.push(
        `select id, ${emailField}, ${usernameField} from ${module} where ${phoneField} = '${escapeCoql(variant)}' limit 1`
      );
    }
  }

  for (const query of queries) {
    const row = await zohoCoql(query, deps);
    if (row?.id) return row;
  }

  return null;
}

/** IL Registration often holds Email while IL_Users only has Username. */
async function findIlUserIdViaRegistration(email, deps) {
  const trimmed = email?.trim();
  if (!trimmed) return null;

  const configured = getIlRegistrationModule();
  const regModules = [...new Set([configured, 'IL_Registration', 'IL_Registrations'].filter(Boolean))];
  const { regEmail, regUserLookup } = getFieldNames();

  for (const regModule of regModules) {
    const query = `select id, ${regEmail}, ${regUserLookup} from ${regModule} where ${regEmail} = '${escapeCoql(trimmed)}' limit 1`;
    const row = await zohoCoql(query, deps);
    if (!row) continue;

    const lookup = row[regUserLookup];
    if (typeof lookup === 'object' && lookup?.id) return String(lookup.id);
    if (typeof lookup === 'string' && lookup.trim()) return lookup.trim();
  }

  return null;
}

async function getIlUserById(recordId, deps) {
  const token = await deps.getAccessToken();
  if (!token || !recordId) return null;

  const module = getIlUsersModule();
  const res = await fetch(`${deps.getApiDomain()}/crm/v2/${module}/${recordId}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });

  if (!res.ok) {
    console.warn(`IL_Users get by id failed for ${recordId}:`, res.status);
    return null;
  }

  const body = await res.json();
  return body?.data?.[0] || null;
}

/** Match IL_Users by Email, Username, COQL, IL Registration lookup, then stored id. */
async function findIlUserRecord(email, username, deps, options = {}) {
  const trimmedEmail = email?.trim();
  const trimmedUsername = username?.trim();
  const phone = options.phone?.trim();
  deps.lastApiError = null;
  deps.permissionDenied = false;

  if (trimmedEmail) {
    const byEmailParam = await searchIlUserByEmailParam(trimmedEmail, deps);
    if (byEmailParam) return byEmailParam;

    const combined = await searchIlUserByEmailOrUsername(trimmedEmail, deps);
    if (combined) return combined;

    const byEmail = await searchIlUserByEmail(trimmedEmail, deps);
    if (byEmail) return byEmail;

    if (trimmedEmail !== trimmedEmail.toLowerCase()) {
      const byLowerParam = await searchIlUserByEmailParam(trimmedEmail.toLowerCase(), deps);
      if (byLowerParam) return byLowerParam;
      const byLower = await searchIlUserByEmail(trimmedEmail.toLowerCase(), deps);
      if (byLower) return byLower;
    }
  }

  const userLookup = trimmedUsername || trimmedEmail;
  if (userLookup) {
    const byUsername = await searchIlUserByUsername(userLookup, deps);
    if (byUsername) return byUsername;

    if (userLookup !== userLookup.toLowerCase()) {
      const byLowerUser = await searchIlUserByUsername(userLookup.toLowerCase(), deps);
      if (byLowerUser) return byLowerUser;
    }
  }

  if (phone) {
    const byPhone = await searchIlUserByPhone(phone, deps);
    if (byPhone) return byPhone;
  }

  const byCoql = await searchIlUserByCoql(trimmedEmail, trimmedUsername, phone, deps);
  if (byCoql) return byCoql;

  const regIlUserId = await findIlUserIdViaRegistration(trimmedEmail, deps);
  if (regIlUserId) {
    const viaReg = await getIlUserById(regIlUserId, deps);
    if (viaReg) return viaReg;
  }

  if (options.ilUserRecordId) {
    const viaId = await getIlUserById(options.ilUserRecordId, deps);
    if (viaId) return viaId;
  }

  return null;
}

function ilUserToCredentialFields(ilUser) {
  if (!ilUser) return {};
  const { email: emailField, username: usernameField } = getFieldNames();
  return {
    Email: ilUser[emailField] ?? ilUser.Email,
    Username: ilUser[usernameField] ?? ilUser.Username,
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

  const deps = { getAccessToken, getApiDomain };
  const ilUser = await findIlUserRecord(trimmed, fields.username, deps, {
    phone: fields.phone,
    ilUserRecordId: fields.ilUserRecordId,
  });

  if (!ilUser?.id) {
    const scopeHint = deps.permissionDenied
      ? ' — OAuth token may lack IL_Users scope; regenerate refresh token with ZohoCRM.modules.ALL or IL_Users module access'
      : '';
    return {
      updated: false,
      reason: `IL_Users record not found for "${trimmed}"${scopeHint}`,
      searchedEmail: trimmed,
      searchedUsername: fields.username || trimmed,
      apiError: deps.lastApiError || null,
    };
  }

  const { email: emailField, username: usernameField, credentialStatus, passwordUpdatedAt } =
    getFieldNames();
  const existingUsername = ilUser[usernameField] ?? ilUser.Username;

  const corePayload = {};
  if (fields.password) {
    corePayload.LMS_Password = fields.password;
    if (shouldSyncLegacyIlPassword()) {
      corePayload.Password = fields.password;
    }
  }

  const statusValue = String(fields.status || 'Active').slice(0, 120);
  const updatedAtIso = formatZohoDateTimeIso(fields.updatedAt || new Date());
  const updatedAtPlain = formatZohoDateTimePlain(fields.updatedAt || new Date());

  const metaPayload = {};
  if (fields.username && fields.username !== existingUsername) {
    metaPayload.Username = fields.username;
  }
  if (fields.lmsUserId) metaPayload.LMS_User_Id = String(fields.lmsUserId);
  if (fields.password || fields.status) {
    metaPayload[credentialStatus] = statusValue;
    metaPayload[passwordUpdatedAt] = updatedAtIso;
  }
  if (trimmed && !ilUser[emailField] && !ilUser.Email) metaPayload.Email = trimmed;

  const fullPayload = { ...corePayload, ...metaPayload };
  if (!Object.keys(fullPayload).length) return { updated: false, reason: 'Nothing to update' };

  const token = await getAccessToken();
  if (!token) return { updated: false, reason: 'No Zoho token' };

  const module = getIlUsersModule();

  async function putPayload(payload) {
    const res = await fetch(`${getApiDomain()}/crm/v2/${module}/${ilUser.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: [payload] }),
    });
    const body = await res.json().catch(() => ({}));
    const row = body?.data?.[0];
    if (!res.ok) {
      return {
        ok: false,
        reason: body?.message || row?.message || `HTTP ${res.status}`,
        details: row?.details || body,
      };
    }
    if (row?.status === 'error') {
      return { ok: false, reason: row.message || 'IL_Users update error', details: row.details };
    }
    return { ok: true };
  }

  let lastReason = 'IL_Users update error';
  let lastDetails = null;

  const metaVariants = [
    metaPayload,
    { ...metaPayload, [passwordUpdatedAt]: updatedAtPlain },
    {
      [credentialStatus]: statusValue,
      [passwordUpdatedAt]: updatedAtIso,
    },
    {
      [credentialStatus]: statusValue,
      [passwordUpdatedAt]: updatedAtPlain,
    },
  ].filter((p) => Object.keys(p).length);

  const attempts = [fullPayload, ...metaVariants.filter((m) => Object.keys(corePayload).length)];
  if (Object.keys(corePayload).length) attempts.push(corePayload);

  let passwordSynced = false;
  let metaSynced = false;

  for (const payload of attempts) {
    const result = await putPayload(payload);
    if (!result.ok) {
      lastReason = result.reason;
      lastDetails = result.details;
      continue;
    }
    if (payload.LMS_Password) passwordSynced = true;
    if (payload[credentialStatus] || payload[passwordUpdatedAt]) metaSynced = true;
    if (passwordSynced && metaSynced) {
      return { updated: true, ilUserId: ilUser.id, passwordSynced: true, metaSynced: true };
    }
  }

  if (passwordSynced || metaSynced) {
    return {
      updated: true,
      ilUserId: ilUser.id,
      passwordSynced,
      metaSynced,
      metaReason: metaSynced ? null : lastReason,
      metaDetails: metaSynced ? null : lastDetails,
    };
  }

  return { updated: false, reason: lastReason, details: lastDetails, ilUserId: ilUser.id };
}

/** Zoho DateTime fields expect ISO 8601 with offset, e.g. 2026-06-19T14:30:00+05:30 */
function formatZohoDateTimeIso(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return formatZohoDateTimeIso(new Date());
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}+05:30`;
}

/** Plain text fallback for Single Line custom fields. */
function formatZohoDateTimePlain(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return formatZohoDateTimePlain(new Date());
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** Admin/debug — reports which lookup strategies find a record (no password writes). */
async function diagnoseIlUserLookup(email, username, deps, options = {}) {
  const trimmedEmail = email?.trim();
  const trimmedUsername = username?.trim();
  const result = {
    module: getIlUsersModule(),
    registrationModule: getIlRegistrationModule(),
    fields: getFieldNames(),
    strategies: {},
    found: null,
  };

  if (trimmedEmail) {
    result.strategies.emailOrUsernameSearch = await searchIlUserByEmailOrUsername(trimmedEmail, deps);
    result.strategies.emailSearch = await searchIlUserByEmail(trimmedEmail, deps);
  }
  if (trimmedUsername || trimmedEmail) {
    result.strategies.usernameSearch = await searchIlUserByUsername(
      trimmedUsername || trimmedEmail,
      deps
    );
  }
  result.strategies.coql = await searchIlUserByCoql(
    trimmedEmail,
    trimmedUsername,
    options.phone,
    deps
  );
  result.strategies.registrationLookupId = await findIlUserIdViaRegistration(trimmedEmail, deps);
  if (options.ilUserRecordId) {
    result.strategies.storedId = await getIlUserById(options.ilUserRecordId, deps);
  }

  const found =
    result.strategies.emailOrUsernameSearch ||
    result.strategies.emailSearch ||
    result.strategies.usernameSearch ||
    result.strategies.coql ||
    (result.strategies.registrationLookupId
      ? await getIlUserById(result.strategies.registrationLookupId, deps)
      : null) ||
    result.strategies.storedId;

  if (found) {
    result.found = {
      id: found.id,
      Email: found.Email ?? found[result.fields.email],
      Username: found.Username ?? found[result.fields.username],
    };
  }

  return result;
}

const IL_USER_LIST_FIELDS = (() => {
  const f = getFieldNames();
  return [f.email, f.username, f.phone, 'LMS_User_Id', 'LMS_Password', 'Password', 'Name'].join(',');
})();

function ilUserToSummaryRow(record) {
  if (!record) return null;
  const f = getFieldNames();
  return {
    id: record.id,
    email: record[f.email] || record.Email || '',
    username: record[f.username] || record.Username || '',
    phone: record[f.phone] || record.Phone || '',
    name: record.Name || '',
    lmsUserId: record.LMS_User_Id || '',
    hasPassword: Boolean(
      (record.LMS_Password && String(record.LMS_Password).trim()) ||
        (record.Password && String(record.Password).trim())
    ),
  };
}

/** Paginated IL_Users list for admin directory. */
async function listIlUsersPage({ page = 1, perPage = 50 } = {}, deps) {
  const token = await deps.getAccessToken();
  if (!token) throw new Error('Unable to obtain Zoho access token');

  const module = getIlUsersModule();
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(Math.min(Math.max(perPage, 1), 200)),
    fields: IL_USER_LIST_FIELDS,
  });

  const res = await fetch(`${deps.getApiDomain()}/crm/v2/${module}?${params}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.message || JSON.stringify(body));
  }

  const rows = (body?.data || []).map(ilUserToSummaryRow).filter(Boolean);
  const info = body?.info || {};

  return {
    ok: true,
    module,
    rows,
    page: info.page || page,
    perPage: info.per_page || perPage,
    count: info.count ?? rows.length,
    moreRecords: Boolean(info.more_records),
  };
}

module.exports = {
  getIlUsersModule,
  getIlUserById,
  searchIlUserByEmail,
  searchIlUserByUsername,
  findIlUserRecord,
  diagnoseIlUserLookup,
  ilUserToCredentialFields,
  updateIlUserCredentials,
  listIlUsersPage,
  ilUserToSummaryRow,
};
