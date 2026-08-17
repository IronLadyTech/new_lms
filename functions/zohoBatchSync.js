/**
 * Zoho IL_Users → LMS batch mapping — PREVIEW / DRY-RUN ONLY.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ SAFETY CONTRACT — this module performs NO writes of any kind.           │
 * │  • Zoho: read-only (GET list only). It never PUTs/POSTs to the CRM.     │
 * │  • Firestore: never written. No set/update/delete anywhere in this file.│
 * │ It only reports what batches WOULD be created. Applying the plan is a   │
 * │ separate, deliberate step that intentionally does not exist yet.        │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Zoho shape (see IL_Users): `Batch` is a comma-separated list positionally
 * paired with `Program_Enrollment_Details` / `Program_Registration_Details`:
 *
 *   Program_Enrollment_Details: "Leadership Essentials Program,Master of Business Warfare"
 *   Batch:                      "23/05/2026 - 23/06/2026,01/11/2026 - 01/11/2027"
 *
 * Because that pairing is positional it is only trustworthy when the two lists
 * are the same length. Anything else is routed to `review` rather than guessed.
 */

const { normalizeProgram } = require('./accessTiers');
const { getIlUsersModule } = require('./zohoIlUsers');
const { fetchIlRegistrationWithBatch, mergeBatchSources } = require('./zohoIlRegistration');
const { previewLeadCohorts } = require('./zohoLeadsCohort');

const IL_USERS_BATCH_FIELDS = [
  'Email',
  'Name',
  'Username',
  'Batch',
  'Program_Enrollment_Details',
  'Program_Registration_Details',
].join(',');

const PROGRAM_SHORT = { lep: 'LEP', '100bm': '100BM', mbw: 'MBW' };

/**
 * Only these three are real LMS programmes. normalizeProgram() falls through to
 * returning the raw string for anything it doesn't recognise, which would let
 * junk like "102 Board Members Program" masquerade as a programme — so every
 * value must clear this whitelist before we trust it.
 */
const KNOWN_PROGRAMS = new Set(['lep', '100bm', 'mbw']);

function toKnownProgram(value) {
  const id = normalizeProgram(value);
  return KNOWN_PROGRAMS.has(id) ? id : null;
}

/** Plausible batch length per program, in days — warnings only, deliberately wide. */
const EXPECTED_SPAN_DAYS = {
  lep: [1, 90],
  '100bm': [90, 400],
  mbw: [140, 460],
};

const MONTH_BATCH_RE = /^[A-Za-z]+\s+\d{4}$/;
const RANGE_BATCH_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
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

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Deterministic id — makes the future apply step idempotent and race-free. */
function batchDocId(programId, rawBatch) {
  return `zoho_${programId}_${slug(rawBatch)}`;
}

function dmyToUtc(d, m, y) {
  return Date.UTC(Number(y), Number(m) - 1, Number(d));
}

/** Validate/classify a single raw batch value from Zoho. */
function classifyBatchValue(raw) {
  const value = String(raw || '').trim();
  if (!value) return { ok: false, reason: 'empty' };
  /*
   * Junk that reached Zoho from some writer, not a batch anyone typed. '$'
   * catches an unreplaced ${...} template; the words are what JavaScript and
   * spreadsheets leave behind when a value was missing at the point of write.
   * Classified as a placeholder rather than a bad format, because there is no
   * format here to correct — the record simply has no batch.
   */
  const PLACEHOLDERS = new Set(['#batch', 'undefined', 'null', 'nan', 'n/a', '-', '--']);
  if (PLACEHOLDERS.has(value.toLowerCase()) || value.includes('$')) {
    return { ok: false, reason: 'placeholder-value', value };
  }

  if (MONTH_BATCH_RE.test(value)) return { ok: true, kind: 'month', value };

  const m = RANGE_BATCH_RE.exec(value);
  if (!m) return { ok: false, reason: 'unrecognised-format', value };

  const start = dmyToUtc(m[1], m[2], m[3]);
  const end = dmyToUtc(m[4], m[5], m[6]);
  if (Number.isNaN(start) || Number.isNaN(end)) return { ok: false, reason: 'invalid-date', value };
  if (end <= start) return { ok: false, reason: 'end-before-start', value };

  const days = Math.round((end - start) / 86400000);
  if (days > 800) return { ok: false, reason: 'implausible-span', value, days };

  return { ok: true, kind: 'range', value, start, days };
}

/** Human-friendly cohort name. Raw value stays the matching key. */
function batchDisplayName(programId, info) {
  const short = PROGRAM_SHORT[programId] || String(programId).toUpperCase();
  if (info.kind === 'month') return `${short} · ${info.value}`;
  const d = new Date(info.start);
  const label = `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return `${short} · ${label}`;
}

/**
 * Pair the Batch list against a program list.
 * Only equal-length lists are trusted; everything else is flagged for review.
 */
function resolvePairing(record) {
  const batches = splitList(record.Batch);
  if (!batches.length) return { status: 'skip', reason: 'no-batch-value', batches: [] };

  const enrolment = splitList(record.Program_Enrollment_Details);
  const registration = splitList(record.Program_Registration_Details);

  if (!enrolment.length && !registration.length) {
    return {
      status: 'review',
      reason: 'no programme on record — cannot tell which programme this batch belongs to',
      detail: batches.join(' | '),
      batches,
    };
  }

  const candidates = [];
  if (enrolment.length === batches.length)
    candidates.push({ source: 'enrolment', list: enrolment });
  if (registration.length === batches.length) {
    candidates.push({ source: 'registration', list: registration });
  }

  if (!candidates.length) {
    return {
      status: 'review',
      reason: 'programme/batch count mismatch',
      detail: `batches=${batches.length}, enrolment=${enrolment.length}, registration=${registration.length}`,
      batches,
    };
  }

  // Prefer whichever column resolves cleanly to real programmes. In this CRM the
  // registration column carries the canonical "100 Board Members Program" while
  // enrolment often carries a cohort-numbered variant ("121 Board Members Program").
  let chosen = null;
  for (const candidate of candidates) {
    const ids = candidate.list.map(toKnownProgram);
    if (ids.every(Boolean)) {
      chosen = { ...candidate, ids };
      break;
    }
  }

  if (!chosen) {
    const unknown = [
      ...new Set(candidates.flatMap((c) => c.list).filter((p) => !toKnownProgram(p))),
    ];
    return {
      status: 'review',
      reason: 'unrecognised programme name',
      detail: unknown.join(', '),
      batches,
    };
  }

  // Both columns resolvable but disagreeing means there is no safe winner —
  // assigning a learner to the wrong programme is the failure we most want to
  // avoid, so hand it to a human instead of picking one.
  const other = candidates.find((c) => c.source !== chosen.source);
  if (other) {
    for (let i = 0; i < batches.length; i += 1) {
      const alternate = toKnownProgram(other.list[i]);
      if (alternate && chosen.ids[i] !== alternate) {
        const fromEnrolment = chosen.source === 'enrolment' ? chosen.list[i] : other.list[i];
        const fromRegistration = chosen.source === 'enrolment' ? other.list[i] : chosen.list[i];
        return {
          status: 'review',
          reason: 'enrolment and registration disagree on programme',
          detail: `batch "${batches[i]}": enrolment="${fromEnrolment}" vs registration="${fromRegistration}"`,
          batches,
        };
      }
    }
  }

  const pairs = batches.map((rawBatch, i) => ({ programId: chosen.ids[i], rawBatch }));
  return { status: 'ok', source: chosen.source, pairs };
}

/**
 * Build the plan from raw IL_Users rows. Pure — no I/O, no writes.
 * Returns the batches that WOULD be created plus everything needing a human.
 */
function buildPlan(records = []) {
  const batches = new Map();
  const review = [];
  const invalidValues = [];
  const byEmail = new Map();
  const emailRecordCount = new Map();

  records.forEach((record) => {
    const email = String(record.Email || '')
      .trim()
      .toLowerCase();
    const who = email || record.Username || record.id || 'unknown';
    if (email) emailRecordCount.set(email, (emailRecordCount.get(email) || 0) + 1);

    const pairing = resolvePairing(record);
    if (pairing.status === 'skip') return;

    if (pairing.status === 'review') {
      review.push({
        recordId: record.id || null,
        email: who,
        reason: pairing.reason,
        detail: pairing.detail || null,
        batches: pairing.batches,
      });
      return;
    }

    pairing.pairs.forEach(({ programId, rawBatch }) => {
      const info = classifyBatchValue(rawBatch);
      if (!info.ok) {
        invalidValues.push({
          recordId: record.id || null,
          email: who,
          program: programId,
          rawBatch,
          reason: info.reason,
        });
        return;
      }

      const docId = batchDocId(programId, rawBatch);
      if (!batches.has(docId)) {
        batches.set(docId, {
          docId,
          program: programId,
          rawBatch,
          displayName: batchDisplayName(programId, info),
          kind: info.kind,
          members: new Set(),
          warnings: new Set(),
        });
      }

      const entry = batches.get(docId);
      if (email) entry.members.add(email);

      const span = EXPECTED_SPAN_DAYS[programId];
      if (info.kind === 'range' && span && (info.days < span[0] || info.days > span[1])) {
        entry.warnings.add(
          `span ${info.days}d is unusual for ${PROGRAM_SHORT[programId] || programId}`
        );
      }
      // Month-name batches are the 100BM convention; elsewhere it hints at a
      // mis-paired program/batch column rather than a real cohort.
      if (info.kind === 'month' && programId !== '100bm') {
        entry.warnings.add(
          `month-name batch on ${PROGRAM_SHORT[programId] || programId} — verify pairing`
        );
      }

      if (!byEmail.has(email)) byEmail.set(email, new Map());
      const perProgram = byEmail.get(email);
      if (!perProgram.has(programId)) perProgram.set(programId, new Set());
      perProgram.get(programId).add(rawBatch);
    });
  });

  // Same learner assigned to two different batches of the SAME program.
  const conflicts = [];
  byEmail.forEach((perProgram, email) => {
    perProgram.forEach((rawBatches, programId) => {
      if (rawBatches.size > 1) {
        conflicts.push({ email, program: programId, batches: [...rawBatches] });
      }
    });
  });

  const duplicateRecords = [...emailRecordCount.entries()]
    .filter(([, count]) => count > 1)
    .map(([email, count]) => ({ email, records: count }));

  const plannedBatches = [...batches.values()]
    .map((b) => ({
      docId: b.docId,
      program: b.program,
      rawBatch: b.rawBatch,
      displayName: b.displayName,
      kind: b.kind,
      memberCount: b.members.size,
      warnings: [...b.warnings],
    }))
    .sort((a, b) => b.memberCount - a.memberCount || a.displayName.localeCompare(b.displayName));

  const byProgram = plannedBatches.reduce((acc, b) => {
    acc[b.program] = (acc[b.program] || 0) + 1;
    return acc;
  }, {});

  return {
    plannedBatches,
    byProgram,
    review,
    conflicts,
    invalidValues,
    duplicateRecords,
  };
}

const COQL_SELECT_FIELDS = [
  'Email',
  'Name',
  'Username',
  'Batch',
  'Program_Enrollment_Details',
  'Program_Registration_Details',
].join(', ');

/**
 * Preferred read path: COQL `where Batch is not null`.
 *
 * The REST /search endpoint cannot express a null check (`not_equal:null` is
 * rejected as "invalid query formed"), and an unfiltered module listing burns
 * its page budget on masterclass signups that have no Batch at all. COQL gives
 * us exactly the enrolled records, and nothing else.
 */
async function fetchViaCoql({ offset = 0, limit = 200 }, deps) {
  const token = await deps.getAccessToken();
  if (!token) throw new Error('Unable to obtain Zoho access token');

  const selectQuery =
    `select ${COQL_SELECT_FIELDS} from ${getIlUsersModule()} ` +
    `where Batch is not null limit ${limit} offset ${offset}`;

  let lastError = null;

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
      lastError = body?.message || `coql ${version} HTTP ${res.status}`;
      continue;
    }

    const body = await res.json();
    return { rows: body?.data || [], more: Boolean(body?.info?.more_records) };
  }

  throw new Error(lastError || 'COQL query failed');
}

/** Fallback read path: plain module listing, filtered client-side. Incomplete by nature. */
async function fetchViaList({ page = 1, perPage = 200 }, deps) {
  const token = await deps.getAccessToken();
  if (!token) throw new Error('Unable to obtain Zoho access token');

  const params = new URLSearchParams({
    page: String(page),
    per_page: String(Math.min(Math.max(perPage, 1), 200)),
    fields: IL_USERS_BATCH_FIELDS,
  });

  const res = await fetch(`${deps.getApiDomain()}/crm/v2/${getIlUsersModule()}?${params}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });

  if (res.status === 204) return { rows: [], more: false };

  const body = await res.json();
  if (!res.ok) throw new Error(body?.message || JSON.stringify(body));

  return { rows: body?.data || [], more: Boolean(body?.info?.more_records) };
}

/**
 * Scan IL_Users + IL_Registration and report the batch plan. DRY-RUN ONLY.
 * IL_Registration is preferred when the same email exists in both modules.
 */
async function previewBatchSync({ maxPages = 10, perPage = 200 } = {}, deps) {
  const ilUsersFetch = await fetchIlUsersWithBatchInternal({ maxPages, perPage }, deps);
  let registrationFetch = {
    rows: [],
    method: 'skipped',
    coqlError: null,
    truncated: false,
    pagesFetched: 0,
  };

  if (deps.fetchIlRegistrationWithBatch) {
    try {
      registrationFetch = await deps.fetchIlRegistrationWithBatch({ maxPages, perPage }, deps);
    } catch (err) {
      registrationFetch = {
        rows: [],
        method: 'error',
        coqlError: err.message || String(err),
        truncated: false,
        pagesFetched: 0,
      };
    }
  }

  const ilUsersWithBatch = ilUsersFetch.rows.filter((r) => splitList(r.Batch).length > 0);
  const regWithBatch = registrationFetch.rows.filter((r) => {
    const batch = String(r.Batch || r[getRegistrationBatchField()] || '').trim();
    return Boolean(batch);
  });
  const merged = mergeBatchSources(ilUsersWithBatch, registrationFetch.rows);
  const withBatch = merged.filter((r) => splitList(r.Batch).length > 0);
  const plan = buildPlan(withBatch);

  let leadCohorts = { plannedCohorts: [], scannedLeads: 0, truncated: false };
  if (deps.previewLeadCohorts) {
    try {
      leadCohorts = await deps.previewLeadCohorts({ maxPages, perPage }, deps);
    } catch (err) {
      leadCohorts = { plannedCohorts: [], scannedLeads: 0, error: err.message || String(err) };
    }
  }

  return {
    mode: 'dry-run',
    wroteToZoho: false,
    wroteToFirestore: false,
    method: ilUsersFetch.method,
    registrationMethod: registrationFetch.method,
    coqlError: ilUsersFetch.coqlError,
    registrationCoqlError: registrationFetch.coqlError,
    registrationSkipped: registrationFetch.skippedReason || null,
    pagesFetched: ilUsersFetch.pagesFetched,
    registrationPagesFetched: registrationFetch.pagesFetched,
    scannedRecords: ilUsersFetch.rows.length,
    registrationScannedRecords: registrationFetch.rows.length,
    recordsWithBatch: withBatch.length,
    scannedLeads: leadCohorts.scannedLeads || 0,
    leadCohortsError:
      leadCohorts.error ||
      (leadCohorts.coqlErrors?.length ? leadCohorts.coqlErrors.join('; ') : null),
    leadCohortQueries: leadCohorts.queries || [],
    leadCohortFields: leadCohorts.fieldsUsed || null,
    sources: {
      ilUsersWithBatch: ilUsersWithBatch.length,
      ilRegistrationWithBatch: regWithBatch.length,
      mergedUniqueEmails: withBatch.length,
      registrationPreferred: withBatch.filter((r) => r._source === 'il_registration').length,
    },
    truncated: ilUsersFetch.truncated || registrationFetch.truncated || leadCohorts.truncated,
    batchCount: plan.plannedBatches.length,
    leadCohortCount: leadCohorts.plannedCohorts?.length || 0,
    plannedBatches: plan.plannedBatches,
    plannedLeadCohorts: leadCohorts.plannedCohorts || [],
    review: plan.review,
    conflicts: plan.conflicts,
    invalidValues: plan.invalidValues,
    duplicateRecords: plan.duplicateRecords,
    byProgram: plan.byProgram,
  };
}

function getRegistrationBatchField() {
  return process.env.ZOHO_IL_REG_BATCH_FIELD?.trim() || 'Batch';
}

async function fetchIlUsersWithBatchInternal({ maxPages = 10, perPage = 200 } = {}, deps) {
  const rows = [];
  let method = 'coql';
  let coqlError = null;
  let more = true;
  let pages = 0;

  try {
    while (more && pages < maxPages) {
      const result = await fetchViaCoql({ offset: pages * perPage, limit: perPage }, deps);
      rows.push(...result.rows);
      more = result.more;
      pages += 1;
    }
  } catch (err) {
    coqlError = err.message || String(err);
    method = 'unfiltered-scan';
    rows.length = 0;
    more = true;
    pages = 0;

    while (more && pages < maxPages) {
      const result = await fetchViaList({ page: pages + 1, perPage }, deps);
      rows.push(...result.rows);
      more = result.more;
      pages += 1;
    }
  }

  const withBatch = rows.filter((r) => splitList(r.Batch).length > 0);
  return {
    rows: withBatch,
    method,
    coqlError,
    pagesFetched: pages,
    truncated: more,
  };
}

async function fetchMergedBatchRecords({ maxPages = 10, perPage = 200 } = {}, deps) {
  const ilUsersFetch = await fetchIlUsersWithBatchInternal({ maxPages, perPage }, deps);
  let registrationFetch = { rows: [], method: 'skipped', coqlError: null, truncated: false };

  if (deps.fetchIlRegistrationWithBatch) {
    try {
      registrationFetch = await deps.fetchIlRegistrationWithBatch({ maxPages, perPage }, deps);
    } catch (err) {
      registrationFetch = {
        rows: [],
        method: 'error',
        coqlError: err.message || String(err),
        truncated: false,
      };
    }
  }

  const merged = mergeBatchSources(ilUsersFetch.rows, registrationFetch.rows);
  return {
    rows: merged.filter((r) => splitList(r.Batch).length > 0),
    method: ilUsersFetch.method,
    registrationMethod: registrationFetch.method,
    coqlError: ilUsersFetch.coqlError,
    registrationCoqlError: registrationFetch.coqlError,
    registrationSkipped: registrationFetch.skippedReason || null,
    truncated: ilUsersFetch.truncated || registrationFetch.truncated,
    sources: {
      ilUsersWithBatch: ilUsersFetch.rows.length,
      ilRegistrationRaw: registrationFetch.rows.length,
      mergedUniqueEmails: merged.filter((r) => splitList(r.Batch).length > 0).length,
    },
  };
}

module.exports = {
  IL_USERS_BATCH_FIELDS,
  splitList,
  slug,
  batchDocId,
  classifyBatchValue,
  batchDisplayName,
  resolvePairing,
  buildPlan,
  fetchViaCoql,
  fetchViaList,
  fetchMergedBatchRecords,
  previewBatchSync,
};
