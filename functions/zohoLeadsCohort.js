/**
 * Zoho Leads cohort — authoritative batch membership via program start/end dates.
 *
 * Field API names (Leads module) — matches Zoho CRM filters:
 *   Program, BM_Reg_Date1, BM_End_Date, LEP_Reg_Date, LEP_End_Date,
 *   MBW_Reg_Date, MBW_End_Date
 *
 * Example Jul 2026 100BM cohort (same as CRM filter):
 *   Program contains 100BM
 *   BM_Reg_Date1 = 11/07/2026
 *   BM_End_Date  = 16/01/2027
 */

const { normalizeProgram } = require('./accessTiers');
const { readLeadStatusFromLead } = require('./zohoFieldMap');

const KNOWN_PROGRAMS = new Set(['lep', '100bm', 'mbw']);
const PROGRAM_SHORT = { lep: 'LEP', '100bm': '100BM', mbw: 'MBW' };
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function getCohortFieldMap() {
  const programField = process.env.ZOHO_LEAD_PROGRAM_FIELD?.trim() || 'Program';
  return {
    '100bm': {
      start: process.env.ZOHO_LEAD_BM_START_FIELD?.trim() || 'BM_Reg_Date1',
      end: process.env.ZOHO_LEAD_BM_END_FIELD?.trim() || 'BM_End_Date',
      programField,
    },
    lep: {
      start: process.env.ZOHO_LEAD_LEP_START_FIELD?.trim() || 'LEP_Reg_Date',
      end: process.env.ZOHO_LEAD_LEP_END_FIELD?.trim() || 'LEP_End_Date',
      programField,
    },
    mbw: {
      start: process.env.ZOHO_LEAD_MBW_START_FIELD?.trim() || 'MBW_Reg_Date',
      end: process.env.ZOHO_LEAD_MBW_END_FIELD?.trim() || 'MBW_End_Date',
      programField,
    },
  };
}

function parseDateParts(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      d: value.getUTCDate(),
      m: value.getUTCMonth() + 1,
      y: value.getUTCFullYear(),
    };
  }

  const s = String(value).trim();
  // dd/mm/yyyy (Zoho India / CRM UI)
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return { d: Number(m[1]), m: Number(m[2]), y: Number(m[3]) };

  // yyyy-mm-dd (Zoho API / COQL)
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return { d: Number(m[3]), m: Number(m[2]), y: Number(m[1]) };

  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) {
    return { d: dt.getUTCDate(), m: dt.getUTCMonth() + 1, y: dt.getUTCFullYear() };
  }
  return null;
}

/** ISO date for Zoho COQL equality: '2026-07-11' */
function dateKey(value) {
  const p = parseDateParts(value);
  if (!p) return '';
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

function formatDisplayDate(value) {
  const p = parseDateParts(value);
  if (!p) return String(value || '').trim();
  return `${String(p.d).padStart(2, '0')} ${MONTHS_SHORT[p.m - 1]} ${p.y}`;
}

function datesMatch(a, b) {
  const ka = dateKey(a);
  const kb = dateKey(b);
  return ka && kb && ka === kb;
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cohortDocId(programId, startDate, endDate) {
  return `zoho_${programId}_${slug(dateKey(startDate))}_${slug(dateKey(endDate))}`;
}

function cohortDisplayName(programId, startDate, endDate) {
  const short = PROGRAM_SHORT[programId] || programId.toUpperCase();
  return `${short} · ${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)}`;
}

function resolveLeadProgramId(lead, fieldMap = getCohortFieldMap()) {
  const fromFields =
    normalizeProgram(lead?.[fieldMap['100bm'].programField]) ||
    normalizeProgram(lead?.Program) ||
    normalizeProgram(lead?.LMS_Program);

  if (fromFields && KNOWN_PROGRAMS.has(fromFields)) return fromFields;

  // Date fields are program-specific — presence implies program even if Program picklist is odd
  if (lead?.[fieldMap['100bm'].start] || lead?.[fieldMap['100bm'].end]) return '100bm';
  if (lead?.[fieldMap.mbw.start] || lead?.[fieldMap.mbw.end]) return 'mbw';
  if (lead?.[fieldMap.lep.start] || lead?.[fieldMap.lep.end]) return 'lep';

  return fromFields && KNOWN_PROGRAMS.has(fromFields) ? fromFields : null;
}

/**
 * Minimal SELECT for COQL — only fields needed for the target program.
 * Avoid Full_Name / LMS_Program (often not COQL-valid) and avoid selecting
 * LEP/MBW date columns when querying 100BM (invalid column kills the whole query).
 */
function leadCoqlSelectFields(fieldMap = getCohortFieldMap(), programId = null) {
  const custom = process.env.ZOHO_LEAD_COHORT_FIELDS?.trim();
  if (custom) return custom;

  const uniq = new Set([
    'id',
    'Email',
    'Last_Name',
    'First_Name',
    'Lead_Status',
    fieldMap['100bm'].programField || 'Program',
  ]);

  const programs = programId && fieldMap[programId] ? [programId] : ['100bm', 'lep', 'mbw'];
  programs.forEach((pid) => {
    if (!fieldMap[pid]) return;
    uniq.add(fieldMap[pid].start);
    uniq.add(fieldMap[pid].end);
  });

  return [...uniq].join(', ');
}

/** Absolute minimum select — used when a wider SELECT hits "column given seems to be invalid". */
function leadCoqlSelectFieldsMinimal(fieldMap = getCohortFieldMap(), programId = '100bm') {
  const pid = fieldMap[programId] ? programId : '100bm';
  const { start, end, programField } = fieldMap[pid];
  return ['id', 'Email', 'Last_Name', 'Lead_Status', programField || 'Program', start, end].join(
    ', '
  );
}

/**
 * Build COQL WHERE for Leads — mirrors Zoho CRM filters.
 * Exact dates: BM_Reg_Date1 = '2026-07-11' AND BM_End_Date = '2027-01-16'
 * Discovery:    BM_Reg_Date1 is not null AND BM_End_Date is not null
 */
function buildLeadsWhereClause({ programId = null, startDate = null, endDate = null } = {}) {
  const fieldMap = getCohortFieldMap();

  if (programId && fieldMap[programId]) {
    const { start, end } = fieldMap[programId];
    const startK = startDate ? dateKey(startDate) : '';
    const endK = endDate ? dateKey(endDate) : '';

    if (startK && endK) {
      return `${start} = '${startK}' and ${end} = '${endK}'`;
    }
    return `${start} is not null and ${end} is not null`;
  }

  // All programs: any cohort date pair filled
  const clauses = ['100bm', 'lep', 'mbw'].map((pid) => {
    const { start, end } = fieldMap[pid];
    return `(${start} is not null and ${end} is not null)`;
  });
  return clauses.join(' or ');
}

async function runCoqlQuery(selectQuery, deps) {
  const token = await deps.getAccessToken();
  if (!token) throw new Error('Unable to obtain Zoho access token');

  let lastError = null;
  let lastDetails = null;

  for (const version of ['v7', 'v6', 'v2']) {
    const res = await fetch(`${deps.getApiDomain()}/crm/${version}/coql`, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ select_query: selectQuery }),
    });

    if (res.status === 204) return { rows: [], more: false, query: selectQuery };

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      lastError = body?.message || `leads coql ${version} HTTP ${res.status}`;
      lastDetails = body?.details || body;
      continue;
    }

    const body = await res.json();
    return {
      rows: body?.data || [],
      more: Boolean(body?.info?.more_records),
      query: selectQuery,
    };
  }

  const err = new Error(lastError || 'Leads COQL query failed');
  err.details = lastDetails;
  err.query = selectQuery;
  throw err;
}

async function fetchLeadsPageCoql(
  { offset = 0, limit = 200, programId = null, startDate = null, endDate = null },
  deps
) {
  const module = deps.getModule?.() || process.env.ZOHO_CRM_MODULE || 'Leads';
  const fieldMap = getCohortFieldMap();
  const whereClause = buildLeadsWhereClause({ programId, startDate, endDate });

  const selectVariants = [];
  // 1) Program-scoped fields only (preferred for dry-run / apply)
  selectVariants.push(leadCoqlSelectFields(fieldMap, programId));
  // 2) Absolute minimum if a SELECT column is invalid
  if (programId && fieldMap[programId]) {
    selectVariants.push(leadCoqlSelectFieldsMinimal(fieldMap, programId));
  }
  // 3) Bare essentials without Program (Program picklist can also be invalid in some orgs)
  if (programId && fieldMap[programId]) {
    const { start, end } = fieldMap[programId];
    selectVariants.push(['id', 'Email', 'Last_Name', 'Lead_Status', start, end].join(', '));
  }

  const tried = [];
  let lastErr = null;

  for (const selectFields of selectVariants) {
    const selectQuery = `select ${selectFields} from ${module} where ${whereClause} limit ${limit} offset ${offset}`;
    tried.push(selectQuery);
    try {
      return await runCoqlQuery(selectQuery, deps);
    } catch (err) {
      lastErr = err;
      const msg = String(err.message || '').toLowerCase();
      // Retry narrower SELECT only for invalid-column errors
      if (!msg.includes('column') && !msg.includes('invalid')) {
        break;
      }
    }
  }

  const detail =
    lastErr?.details?.api_name ||
    lastErr?.details?.column_name ||
    lastErr?.details?.resource_path_index ||
    '';
  throw new Error(
    `${lastErr?.message || 'Leads COQL failed'}${detail ? ` (${detail})` : ''}. ` +
      `Tried queries: ${tried.join(' || ')}`
  );
}

async function fetchLeadsPageSearch(
  { page = 1, perPage = 200, programId, startDate, endDate, dateFormat = 'iso' },
  deps
) {
  const token = await deps.getAccessToken();
  if (!token) throw new Error('Unable to obtain Zoho access token');

  const module = deps.getModule?.() || process.env.ZOHO_CRM_MODULE || 'Leads';
  const fieldMap = getCohortFieldMap();
  if (!programId || !fieldMap[programId] || !startDate || !endDate) {
    throw new Error('Search API fallback requires programId + startDate + endDate');
  }

  const { start, end } = fieldMap[programId];
  const startK = dateKey(startDate);
  const endK = dateKey(endDate);
  const parts = parseDateParts(startDate);
  const partsEnd = parseDateParts(endDate);

  let startLiteral = startK;
  let endLiteral = endK;
  if (dateFormat === 'dmy' && parts && partsEnd) {
    startLiteral = `${String(parts.d).padStart(2, '0')}/${String(parts.m).padStart(2, '0')}/${parts.y}`;
    endLiteral = `${String(partsEnd.d).padStart(2, '0')}/${String(partsEnd.m).padStart(2, '0')}/${partsEnd.y}`;
  }

  const criteria = `((${start}:equals:${startLiteral})and(${end}:equals:${endLiteral}))`;
  const queryLabel = `search criteria=${criteria}`;

  const params = new URLSearchParams({
    criteria,
    page: String(page),
    per_page: String(Math.min(perPage, 200)),
  });

  let lastError = null;
  for (const version of ['v7', 'v6', 'v2']) {
    const res = await fetch(`${deps.getApiDomain()}/crm/${version}/${module}/search?${params}`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });

    if (res.status === 204) return { rows: [], more: false, query: queryLabel, method: 'search' };

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      lastError = body?.message || `leads search ${version} HTTP ${res.status}`;
      continue;
    }

    const body = await res.json();
    return {
      rows: body?.data || [],
      more: Boolean(body?.info?.more_records),
      query: queryLabel,
      method: 'search',
    };
  }

  throw new Error(lastError || 'Leads Search API failed');
}

async function fetchAllLeads(
  { maxPages = 50, perPage = 200, programId = null, startDate = null, endDate = null } = {},
  deps
) {
  const rows = [];
  let more = true;
  let pages = 0;
  let lastQuery = '';
  let method = 'coql';

  // Prefer COQL; if columns are invalid and we have exact dates, fall back to Search API
  try {
    while (more && pages < maxPages) {
      const result = await fetchLeadsPageCoql(
        {
          offset: pages * perPage,
          limit: perPage,
          programId,
          startDate,
          endDate,
        },
        deps
      );
      lastQuery = result.query || lastQuery;
      rows.push(...result.rows);
      more = result.more;
      pages += 1;
    }
    return { rows, pagesFetched: pages, truncated: more, query: lastQuery, method };
  } catch (coqlErr) {
    const canSearch = Boolean(programId && startDate && endDate);
    if (!canSearch) throw coqlErr;

    const dateFormats = ['iso', 'dmy'];
    let lastSearchErr = coqlErr;

    for (const dateFormat of dateFormats) {
      try {
        rows.length = 0;
        more = true;
        pages = 0;
        method = `search:${dateFormat}`;

        while (more && pages < maxPages) {
          const result = await fetchLeadsPageSearch(
            {
              page: pages + 1,
              perPage,
              programId,
              startDate,
              endDate,
              dateFormat,
            },
            deps
          );
          lastQuery = `${result.query} (fallback after COQL: ${coqlErr.message})`;
          rows.push(...result.rows);
          more = result.more;
          pages += 1;
        }

        // Prefer a format that returns rows; if iso returns 0 try dmy
        if (rows.length > 0 || dateFormat === dateFormats[dateFormats.length - 1]) {
          return { rows, pagesFetched: pages, truncated: more, query: lastQuery, method };
        }
      } catch (searchErr) {
        lastSearchErr = searchErr;
      }
    }

    throw new Error(
      `Leads lookup failed. COQL: ${coqlErr.message}. Search: ${lastSearchErr.message}`
    );
  }
}

/**
 * Group Leads into cohorts by program + start/end date fields.
 */
function buildLeadCohortPlan(leads = []) {
  const fieldMap = getCohortFieldMap();
  const cohorts = new Map();

  leads.forEach((lead) => {
    const email = String(lead.Email || '')
      .trim()
      .toLowerCase();
    if (!email) return;

    const programId = resolveLeadProgramId(lead, fieldMap);
    if (!programId || !fieldMap[programId]) return;

    const { start, end } = fieldMap[programId];
    const startVal = lead[start];
    const endVal = lead[end];
    if (!startVal || !endVal) return;

    const startK = dateKey(startVal);
    const endK = dateKey(endVal);
    if (!startK || !endK) return;

    const key = `${programId}|${startK}|${endK}`;
    if (!cohorts.has(key)) {
      cohorts.set(key, {
        docId: cohortDocId(programId, startVal, endVal),
        program: programId,
        displayName: cohortDisplayName(programId, startVal, endVal),
        startDate: startVal,
        endDate: endVal,
        startDateKey: startK,
        endDateKey: endK,
        source: 'leads',
        members: new Map(),
      });
    }

    cohorts.get(key).members.set(email, {
      email,
      lead,
      leadStatus: readLeadStatusFromLead(lead),
      name:
        [lead.First_Name, lead.Last_Name].filter(Boolean).join(' ') ||
        lead.Last_Name ||
        lead.Full_Name ||
        '',
    });
  });

  const plannedCohorts = [...cohorts.values()]
    .map((c) => ({
      docId: c.docId,
      program: c.program,
      displayName: c.displayName,
      startDate: c.startDate,
      endDate: c.endDate,
      startDateKey: c.startDateKey,
      endDateKey: c.endDateKey,
      source: 'leads',
      memberCount: c.members.size,
      // UI-friendly raw label matching CRM date range style
      rawBatch: `${formatDisplayDate(c.startDate)} – ${formatDisplayDate(c.endDate)}`,
    }))
    .sort((a, b) => b.memberCount - a.memberCount || a.displayName.localeCompare(b.displayName));

  return { plannedCohorts, cohortsByKey: cohorts };
}

/**
 * Fetch Leads matching program + start + end dates (same filter as Zoho CRM UI).
 * COQL: BM_Reg_Date1 = 'YYYY-MM-DD' and BM_End_Date = 'YYYY-MM-DD'
 */
async function fetchLeadsCohortMembers(
  { programId, startDate, endDate, maxPages = 50, perPage = 200 },
  deps
) {
  const pid = String(programId || '')
    .trim()
    .toLowerCase();
  if (!KNOWN_PROGRAMS.has(pid)) {
    return { ok: false, reason: `Unknown program "${programId}"` };
  }
  if (!startDate || !endDate) {
    return { ok: false, reason: 'startDate and endDate are required for Leads cohort sync' };
  }

  const startK = dateKey(startDate);
  const endK = dateKey(endDate);
  if (!startK || !endK) {
    return {
      ok: false,
      reason: `Could not parse dates (got start="${startDate}", end="${endDate}"). Use DD/MM/YYYY or YYYY-MM-DD.`,
    };
  }

  const {
    rows,
    pagesFetched,
    truncated,
    query,
    method: fetchMethod,
  } = await fetchAllLeads({ maxPages, perPage, programId: pid, startDate, endDate }, deps);

  const fieldMap = getCohortFieldMap();
  const members = new Map();
  let skippedNoEmail = 0;
  let skippedDateMismatch = 0;
  let duplicateEmails = 0;
  const sampleDates = [];
  const duplicateSamples = [];

  rows.forEach((lead) => {
    const email = String(lead.Email || '')
      .trim()
      .toLowerCase();
    const startVal = lead[fieldMap[pid].start];
    const endVal = lead[fieldMap[pid].end];
    const name =
      [lead.First_Name, lead.Last_Name].filter(Boolean).join(' ') ||
      lead.Last_Name ||
      lead.Full_Name ||
      '';

    if (sampleDates.length < 8) {
      sampleDates.push({
        start: startVal ?? '(missing)',
        end: endVal ?? '(missing)',
        email: email || '(no email)',
        name: name || '(no name)',
      });
    }

    if (!email) {
      skippedNoEmail += 1;
      return;
    }

    const hasBothDates = startVal != null && startVal !== '' && endVal != null && endVal !== '';
    if (hasBothDates && (!datesMatch(startVal, startDate) || !datesMatch(endVal, endDate))) {
      skippedDateMismatch += 1;
      return;
    }

    if (members.has(email)) {
      duplicateEmails += 1;
      if (duplicateSamples.length < 10) {
        duplicateSamples.push({ email, name });
      }
      return;
    }

    members.set(email, {
      email,
      lead,
      leadStatus: readLeadStatusFromLead(lead),
      name,
    });
  });

  // If exact filter returned nothing, sample recent leads with start date filled
  // so the UI can show what date values Zoho actually stores.
  let discoverySamples = sampleDates;
  if (members.size === 0 && rows.length === 0) {
    try {
      const probe = await fetchAllLeads({ maxPages: 1, perPage: 25, programId: pid }, deps);
      discoverySamples = (probe.rows || []).slice(0, 8).map((lead) => ({
        start: lead[fieldMap[pid].start] ?? '(missing)',
        end: lead[fieldMap[pid].end] ?? '(missing)',
        email:
          String(lead.Email || '')
            .trim()
            .toLowerCase() || '(no email)',
      }));
    } catch {
      // keep empty samples
    }
  }

  return {
    ok: true,
    program: pid,
    startDate,
    endDate,
    startDateKey: startK,
    endDateKey: endK,
    docId: cohortDocId(pid, startDate, endDate),
    displayName: cohortDisplayName(pid, startDate, endDate),
    members: [...members.values()],
    scannedLeads: rows.length,
    pagesFetched,
    truncated,
    query,
    method: fetchMethod,
    skippedNoEmail,
    skippedDateMismatch,
    duplicateEmails,
    duplicateSamples,
    sampleDates: discoverySamples,
    learners: [...members.values()].map((m) => ({
      email: m.email,
      name: m.name || '',
      leadStatus: m.leadStatus || '',
    })),
    reason:
      members.size === 0
        ? rows.length === 0
          ? `No Leads matched ${fieldMap[pid].start}=${startK} and ${fieldMap[pid].end}=${endK}`
          : `Zoho returned ${rows.length} row(s) but none had usable email/dates`
        : rows.length > members.size
          ? `Zoho returned ${rows.length} rows → ${members.size} unique emails` +
            (duplicateEmails ? ` (${duplicateEmails} duplicate email row(s))` : '') +
            (skippedNoEmail ? ` (${skippedNoEmail} without email)` : '')
          : undefined,
    fieldsUsed: {
      program: fieldMap[pid].programField,
      start: fieldMap[pid].start,
      end: fieldMap[pid].end,
    },
  };
}

/**
 * Preview: scan Leads with cohort dates filled, group by program + start + end.
 * Runs one COQL per program so 100BM dates are not drowned out by unrelated leads.
 */
async function previewLeadCohorts({ maxPages = 50, perPage = 200, programId = null } = {}, deps) {
  const programs =
    programId && KNOWN_PROGRAMS.has(programId) ? [programId] : ['100bm', 'lep', 'mbw'];
  const allRows = [];
  const queries = [];
  let truncated = false;
  let pagesFetched = 0;
  const errors = [];

  for (const pid of programs) {
    try {
      const result = await fetchAllLeads({ maxPages, perPage, programId: pid }, deps);
      allRows.push(...result.rows);
      pagesFetched += result.pagesFetched;
      if (result.truncated) truncated = true;
      if (result.query) queries.push(result.query);
    } catch (err) {
      errors.push(`${pid}: ${err.message || String(err)}`);
    }
  }

  if (allRows.length === 0 && errors.length > 0) {
    throw new Error(`Leads cohort COQL failed — ${errors.join('; ')}`);
  }

  const plan = buildLeadCohortPlan(allRows);
  return {
    scannedLeads: allRows.length,
    pagesFetched,
    truncated,
    cohortCount: plan.plannedCohorts.length,
    queries,
    fieldsUsed: getCohortFieldMap(),
    coqlErrors: errors.length ? errors : null,
    ...plan,
  };
}

function resolveLeadCohortFromLead(lead) {
  if (!lead) return null;

  const fieldMap = getCohortFieldMap();
  const programId = resolveLeadProgramId(lead, fieldMap);
  if (!programId || !fieldMap[programId]) return null;

  const { start, end } = fieldMap[programId];
  const startVal = lead[start];
  const endVal = lead[end];
  if (!startVal || !endVal) return null;

  return {
    source: 'leads',
    programId,
    docId: cohortDocId(programId, startVal, endVal),
    displayName: cohortDisplayName(programId, startVal, endVal),
    batchValue: `${formatDisplayDate(startVal)} – ${formatDisplayDate(endVal)}`,
    startDate: startVal,
    endDate: endVal,
  };
}

module.exports = {
  getCohortFieldMap,
  parseDateParts,
  dateKey,
  datesMatch,
  formatDisplayDate,
  cohortDocId,
  cohortDisplayName,
  resolveLeadProgramId,
  resolveLeadCohortFromLead,
  buildLeadsWhereClause,
  buildLeadCohortPlan,
  fetchLeadsCohortMembers,
  previewLeadCohorts,
};
