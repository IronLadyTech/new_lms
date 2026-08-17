/**
 * Zoho IL_Registration — cohort/batch source of truth for many learners.
 * IL_Users holds credentials; IL_Registration often has Email + Batch + Status.
 */

function getIlRegistrationModule() {
  return process.env.ZOHO_IL_REGISTRATION_MODULE || 'IL_Registration';
}

function getRegistrationModuleCandidates() {
  const configured = getIlRegistrationModule();
  return [
    ...new Set(
      [configured, 'CustomModule6', 'IL_Registration', 'IL_Registrations'].filter(Boolean)
    ),
  ];
}

function getRegistrationFieldNames() {
  return {
    email: process.env.ZOHO_IL_REG_EMAIL_FIELD?.trim() || 'Email',
    name: process.env.ZOHO_IL_REG_NAME_FIELD?.trim() || 'Name',
    batch: process.env.ZOHO_IL_REG_BATCH_FIELD?.trim() || 'Batch',
    program: process.env.ZOHO_IL_REG_PROGRAM_FIELD?.trim() || 'Program_Registration_Details',
    programAlt: process.env.ZOHO_IL_REG_PROGRAM_ALT_FIELD?.trim() || 'Program',
    status: process.env.ZOHO_IL_REG_STATUS_FIELD?.trim() || 'Current_Status',
    statusAlt: process.env.ZOHO_IL_REG_STATUS_ALT_FIELD?.trim() || 'Lead_Status',
    ilUserLookup: process.env.ZOHO_IL_REG_ILUSER_LOOKUP_FIELD?.trim() || 'IL_User',
    username: process.env.ZOHO_IL_REG_USERNAME_FIELD?.trim() || 'Username',
    password: process.env.ZOHO_IL_REG_PASSWORD_FIELD?.trim() || 'Password',
  };
}

function pickField(record, ...keys) {
  for (const key of keys) {
    if (!key) continue;
    const val = record?.[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return '';
}

/** Username/password on IL_Registration when not duplicated on IL_Users (some orgs store creds here). */
function registrationToCredentialFields(reg) {
  if (!reg) return {};
  const f = getRegistrationFieldNames();
  const email = pickField(reg, f.email, 'Email');
  const username = pickField(
    reg,
    f.username,
    'Username',
    'LMS_Username',
    'User_Name',
    'IL_Username'
  );
  let password = pickField(
    reg,
    f.password,
    'LMS_Password',
    'Password',
    'IL_Password',
    'Registration_Password'
  );

  if (!password) {
    for (const [key, val] of Object.entries(reg)) {
      if (key === 'id' || key.endsWith('_Id')) continue;
      if (!/password/i.test(key)) continue;
      const candidate = String(val ?? '').trim();
      if (candidate.length >= 6) {
        password = candidate;
        break;
      }
    }
  }

  const out = {};
  if (email) out.Email = email;
  if (username) out.Username = username;
  if (password) {
    out.Password = password;
    out.LMS_Password = password;
  }
  return out;
}

function hasRegistrationCredentials(reg) {
  const creds = registrationToCredentialFields(reg);
  return Boolean(creds.Password && creds.Password.length >= 6);
}

/** Map IL_Registration row → IL_Users-shaped record for batch pairing. */
function registrationToBatchRecord(reg) {
  const f = getRegistrationFieldNames();
  const email = pickField(reg, f.email, 'Email');
  const batch = pickField(reg, f.batch, 'Batch');
  const program = pickField(
    reg,
    f.program,
    f.programAlt,
    'Program_Registration_Details',
    'Program_Enrollment_Details',
    'Program',
    'LMS_Program'
  );
  const status = pickField(reg, f.status, f.statusAlt, 'Status', 'Lead_Status');

  return {
    id: reg.id || null,
    Email: email,
    Name: pickField(reg, f.name, 'Name'),
    Username: email,
    Batch: batch,
    Program_Registration_Details: program,
    Program_Enrollment_Details: '',
    _source: 'il_registration',
    _registrationId: reg.id || null,
    _status: status || null,
  };
}

function getRegistrationCredentialFields() {
  const fromEnv = process.env.ZOHO_IL_REG_CREDENTIAL_FIELDS?.trim();
  if (fromEnv) {
    return fromEnv
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [
    'Username',
    'LMS_Username',
    'User_Name',
    'IL_Username',
    'LMS_Password',
    'Password',
    'IL_Password',
  ];
}

function extractIlUserLookupId(reg) {
  if (!reg) return null;
  const f = getRegistrationFieldNames();
  const lookup = reg[f.ilUserLookup] ?? reg.IL_User;
  if (typeof lookup === 'object' && lookup?.id) return String(lookup.id);
  if (typeof lookup === 'string' && lookup.trim()) return lookup.trim();
  return null;
}

function registrationCoqlSelectFields() {
  const custom = process.env.ZOHO_IL_REG_BATCH_FIELDS?.trim();
  if (custom) return custom;

  const f = getRegistrationFieldNames();
  // Minimal COQL — password/username API names vary; hydrate via full GET by id.
  return ['id', f.email, f.ilUserLookup].join(', ');
}

function registrationLookupCoqlFields() {
  return registrationCoqlSelectFields();
}

function registrationListFields() {
  const custom = process.env.ZOHO_IL_REG_LIST_FIELDS?.trim();
  if (custom) return custom;
  return registrationCoqlSelectFields();
}

async function getRegistrationById(recordId, deps) {
  const token = await deps.getAccessToken();
  if (!token || !recordId) return null;

  for (const module of getRegistrationModuleCandidates()) {
    const res = await fetch(`${deps.getApiDomain()}/crm/v2/${module}/${recordId}`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });

    if (!res.ok) continue;
    const body = await res.json();
    if (body?.data?.[0]) return body.data[0];
  }

  return null;
}

async function hydrateRegistrationRecord(record, deps) {
  if (!record?.id) return record;
  if (hasRegistrationCredentials(record)) return record;
  const full = await getRegistrationById(record.id, deps);
  return full || record;
}

async function fetchRegistrationViaCoql({ offset = 0, limit = 200 }, deps) {
  const token = await deps.getAccessToken();
  if (!token) throw new Error('Unable to obtain Zoho access token');

  const f = getRegistrationFieldNames();
  const selectFields = registrationCoqlSelectFields();

  /*
   * The by-id lookup tries every module candidate; this scan used to query only
   * the configured name. Zoho answers an unknown module or field with the same
   * opaque "column given seems to be invalid", so a single attempt could not
   * tell the two apart — and the caller reported 0 records, which reads as
   * "this org has no registrations" rather than "the query never ran".
   */
  let lastError = null;
  for (const module of getRegistrationModuleCandidates()) {
    const selectQuery =
      `select ${selectFields} from ${module} ` +
      `where ${f.batch} is not null limit ${limit} offset ${offset}`;

    for (const version of ['v7', 'v6', 'v2']) {
      const res = await fetch(`${deps.getApiDomain()}/crm/${version}/coql`, {
        method: 'POST',
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ select_query: selectQuery }),
      });

      if (res.status === 204) return { rows: [], more: false };

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        lastError = `${module}/${version}: ${body?.message || `HTTP ${res.status}`}`;
        continue;
      }

      const body = await res.json();
      return { rows: body?.data || [], more: Boolean(body?.info?.more_records) };
    }
  }

  /*
   * Name what was tried. Zoho's own message identifies neither the module nor
   * the offending column, and every one of these is overridable by environment
   * variable — so the fix is almost always a config change, and this is the
   * only place that knows which values were used.
   */
  throw new Error(
    `IL_Registration COQL failed for every module tried ` +
      `(${getRegistrationModuleCandidates().join(', ')}). ` +
      `Last response — ${lastError || 'no response'}. ` +
      `Query used: select ${selectFields} where ${f.batch} is not null. ` +
      `Set ZOHO_IL_REGISTRATION_MODULE, ZOHO_IL_REG_BATCH_FIELD, ` +
      `ZOHO_IL_REG_EMAIL_FIELD or ZOHO_IL_REG_ILUSER_LOOKUP_FIELD to the API ` +
      `names in your Zoho (Setup > Developer Space > APIs > API Names).`
  );
}

async function fetchRegistrationViaList({ page = 1, perPage = 200 }, deps) {
  const token = await deps.getAccessToken();
  if (!token) throw new Error('Unable to obtain Zoho access token');

  const module = getIlRegistrationModule();
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(Math.min(Math.max(perPage, 1), 200)),
    fields: registrationListFields(),
  });

  const res = await fetch(`${deps.getApiDomain()}/crm/v2/${module}?${params}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });

  if (res.status === 204) return { rows: [], more: false };

  const body = await res.json();
  if (!res.ok) throw new Error(body?.message || JSON.stringify(body));

  return { rows: body?.data || [], more: Boolean(body?.info?.more_records) };
}

/**
 * Paginated fetch of IL_Registration rows that carry a Batch value.
 *
 * Only runs when ZOHO_IL_REG_BATCH_FIELD names a real field. Cohorts live on
 * Leads (BM_Reg_Date1 / BM_End_Date) and, for legacy records, on IL_Users;
 * IL_Registration holds credentials and registration amount, not batches. With
 * no batch field there, `where Batch is not null` was rejected by Zoho as an
 * invalid column, the list-scan fallback then filtered every row away, and the
 * caller reported "0 scanned" — indistinguishable from a module that simply had
 * nothing in it. Skipping says so plainly instead.
 */
async function fetchIlRegistrationWithBatch({ maxPages = 50, perPage = 200 } = {}, deps) {
  const rows = [];
  let method = 'coql';
  let coqlError = null;
  let more = true;
  let pages = 0;

  if (!process.env.ZOHO_IL_REG_BATCH_FIELD?.trim()) {
    return {
      module: getIlRegistrationModule(),
      rows: [],
      method: 'skipped',
      skippedReason:
        'No ZOHO_IL_REG_BATCH_FIELD configured — batches are read from Leads and IL_Users. ' +
        'Set it only if your IL_Registration module really carries a batch field.',
      coqlError: null,
      pagesFetched: 0,
      truncated: false,
    };
  }

  try {
    while (more && pages < maxPages) {
      const result = await fetchRegistrationViaCoql(
        { offset: pages * perPage, limit: perPage },
        deps
      );
      rows.push(...result.rows);
      more = result.more;
      pages += 1;
    }
  } catch (err) {
    coqlError = err.message || String(err);
    method = 'list-scan';
    rows.length = 0;
    more = true;
    pages = 0;

    while (more && pages < maxPages) {
      const result = await fetchRegistrationViaList({ page: pages + 1, perPage }, deps);
      rows.push(
        ...result.rows.filter((r) => pickField(r, getRegistrationFieldNames().batch, 'Batch'))
      );
      more = result.more;
      pages += 1;
    }
  }

  return {
    module: getIlRegistrationModule(),
    rows,
    method,
    coqlError,
    pagesFetched: pages,
    truncated: more,
  };
}

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

/**
 * Merge IL_Users + IL_Registration for batch mapping.
 * IL_Registration wins on email conflict (matches ops sheet / cohort tracker).
 */
function mergeBatchSources(ilUserRows = [], registrationRows = []) {
  const byEmail = new Map();

  ilUserRows.forEach((row) => {
    const email = normalizeEmail(row.Email);
    if (!email) return;
    byEmail.set(email, { ...row, _source: row._source || 'il_users' });
  });

  registrationRows.forEach((row) => {
    const mapped = registrationToBatchRecord(row);
    const email = normalizeEmail(mapped.Email);
    if (!email || !mapped.Batch) return;
    byEmail.set(email, mapped);
  });

  return [...byEmail.values()];
}

function registrationToSummaryRow(record) {
  const f = getRegistrationFieldNames();
  const mapped = registrationToBatchRecord(record);
  return {
    id: record.id,
    email: mapped.Email || '',
    name: mapped.Name || '',
    batch: mapped.Batch || '',
    program: mapped.Program_Registration_Details || '',
    status: mapped._status || '',
  };
}

async function listIlRegistrationPage({ page = 1, perPage = 50 } = {}, deps) {
  const token = await deps.getAccessToken();
  if (!token) throw new Error('Unable to obtain Zoho access token');

  const params = new URLSearchParams({
    page: String(page),
    per_page: String(Math.min(Math.max(perPage, 1), 200)),
    fields: registrationListFields(),
  });

  /*
   * Try each module candidate, as the by-id lookup and the COQL scan already
   * do. A stray ZOHO_IL_REGISTRATION_MODULE pointing at a module that does not
   * exist made this fail outright with Zoho's "the module name given seems to
   * be invalid", which surfaced in the admin UI as a bare "INTERNAL".
   */
  let module = null;
  let body = null;
  let lastError = null;
  for (const candidate of getRegistrationModuleCandidates()) {
    const res = await fetch(`${deps.getApiDomain()}/crm/v2/${candidate}?${params}`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    if (res.status === 204) return { ok: true, module: candidate, rows: [], page, perPage, count: 0, moreRecords: false };
    const parsed = await res.json().catch(() => ({}));
    if (res.ok) {
      module = candidate;
      body = parsed;
      break;
    }
    lastError = `${candidate}: ${parsed?.message || `HTTP ${res.status}`}`;
  }

  if (!body) {
    throw new Error(
      `IL_Registration list failed for every module tried ` +
        `(${getRegistrationModuleCandidates().join(', ')}). Last response — ${lastError}. ` +
        `Set ZOHO_IL_REGISTRATION_MODULE to the module's API name.`
    );
  }

  const rows = (body?.data || []).map(registrationToSummaryRow).filter(Boolean);
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

async function searchIlRegistrationByEmail(email, deps) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const token = await deps.getAccessToken();
  if (!token) throw new Error('Unable to obtain Zoho access token');

  const moduleCandidates = getRegistrationModuleCandidates();
  const f = getRegistrationFieldNames();
  const selectFields = registrationLookupCoqlFields();
  const safeEmail = normalized.replace(/'/g, "''");
  let foundId = null;
  let foundModule = moduleCandidates[0];

  for (const module of moduleCandidates) {
    const selectQuery = `select ${selectFields} from ${module} where ${f.email} = '${safeEmail}' limit 1`;

    for (const version of ['v7', 'v6', 'v2']) {
      const res = await fetch(`${deps.getApiDomain()}/crm/${version}/coql`, {
        method: 'POST',
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ select_query: selectQuery }),
      });

      if (res.status === 204) break;

      if (res.ok) {
        const body = await res.json();
        const row = body?.data?.[0];
        if (row?.id) {
          foundId = row.id;
          foundModule = module;
          break;
        }
      }
    }
    if (foundId) break;
  }

  if (!foundId) {
    for (const module of moduleCandidates) {
      const params = new URLSearchParams({
        criteria: `(${f.email}:equals:${normalized})`,
        page: '1',
        per_page: '1',
      });

      const searchRes = await fetch(`${deps.getApiDomain()}/crm/v2/${module}/search?${params}`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
      });

      if (searchRes.ok && searchRes.status !== 204) {
        const searchBody = await searchRes.json();
        foundId = searchBody?.data?.[0]?.id || null;
        if (foundId) {
          foundModule = module;
          break;
        }
      }
    }
  }

  if (!foundId) return null;
  const full = await getRegistrationById(foundId, deps);
  return full || { id: foundId, _module: foundModule };
}

module.exports = {
  getIlRegistrationModule,
  getRegistrationFieldNames,
  getRegistrationCredentialFields,
  extractIlUserLookupId,
  registrationToCredentialFields,
  hasRegistrationCredentials,
  registrationToBatchRecord,
  getRegistrationById,
  fetchIlRegistrationWithBatch,
  mergeBatchSources,
  listIlRegistrationPage,
  registrationToSummaryRow,
  searchIlRegistrationByEmail,
};
