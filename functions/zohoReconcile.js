/**
 * The reconciler.
 *
 * Everything that reaches the LMS today arrives because Zoho decided to push
 * it — the conversion functions post on payment, the status rule posts on a
 * Lead Status edit. Both are the same mechanism, so when Zoho does not fire,
 * both fail together: a workflow switched off, a timeout, a deploy window, or
 * the Moodle half of `registartion1` aborting before it reaches the LMS call.
 * A learner in that gap has no account and nothing ever tries again.
 *
 * This asks the opposite question on a timer: what changed in IL Users since I
 * last looked, and have I handled it? It does not care why a message was lost.
 *
 * IL Users is the right module to watch because it is the identity hub — one
 * record per person, holding the credentials, the batch, and the two programme
 * lists that state what somebody is entitled to. Leads would be the wrong
 * choice: IL Registration, Contacts and Master Class each auto-create another
 * Lead, so one learner has several and none of them is authoritative.
 */

const WATERMARK_DOC = 'sync_state/zoho';

/** A learner who registered five seconds ago should not wait for the next run. */
const DEFAULT_BATCH = 200;

/*
 * Query slightly before the last watermark rather than exactly from it.
 *
 * Zoho's Modified_Time is written by Zoho's clock, indexing is not instant, and
 * a record saved in the same second the previous run finished can surface just
 * after it. Without an overlap that record falls in the seam between two runs
 * and is never seen. Re-reading a minute of history costs nothing because every
 * action here is idempotent.
 */
const OVERLAP_MS = 60 * 1000;

/** How far back a first-ever run reaches. Deliberately short: the backfill tools cover history. */
const COLD_START_MS = 24 * 60 * 60 * 1000;

const IL_USERS_FIELDS = [
  'id',
  'Email',
  'Username',
  'Program_Registration_Details',
  'Program_Enrollment_Details',
  'Batch',
  'LMS_User_Id',
  'User_Id',
  'Modified_Time',
];

/**
 * Where the next query should start reading from.
 *
 * Returns an ISO string. A missing or unparseable watermark falls back to the
 * cold-start window rather than to the beginning of time — a first run that
 * tried to sweep every record would exhaust Zoho's API credits before it
 * finished, and leave the watermark unset so the next run did it again.
 */
function queryFloor(previousIso, now = new Date()) {
  const previous = previousIso ? new Date(previousIso) : null;
  const valid = previous && !Number.isNaN(previous.getTime());
  const from = valid
    ? new Date(previous.getTime() - OVERLAP_MS)
    : new Date(now.getTime() - COLD_START_MS);
  // Never read into the future, whatever a bad stored value said.
  return (from.getTime() > now.getTime() ? now : from).toISOString();
}

/** Zoho's COQL wants `yyyy-MM-ddTHH:mm:ss+00:00`, not a Z suffix. */
function toCoqlTime(iso) {
  return `${new Date(iso).toISOString().slice(0, 19)}+00:00`;
}

function buildQuery(sinceIso, module, limit, offset = 0) {
  return (
    `select ${IL_USERS_FIELDS.join(',')} from ${module} ` +
    `where Modified_Time > '${toCoqlTime(sinceIso)}' ` +
    `order by Modified_Time asc limit ${limit} offset ${offset}`
  );
}

const splitList = (v) =>
  String(v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * What, if anything, this record needs.
 *
 * `skip` is the common answer and must stay cheap: IL Users is touched by name
 * and phone edits that have nothing to do with access, and acting on those
 * would spend two Zoho lookups a head for no reason.
 */
function decideAction(row, hasAccount) {
  const email = String(row?.Email || '').trim();
  if (!email) return { action: 'skip', reason: 'no-email' };

  const programmes = [
    ...splitList(row?.Program_Registration_Details),
    ...splitList(row?.Program_Enrollment_Details),
  ];
  if (!programmes.length) return { action: 'skip', reason: 'no-programme' };

  // No account and a programme on file: this is the gap the reconciler exists
  // for — somebody registered and the push never arrived.
  if (!hasAccount) return { action: 'provision', reason: 'missing-account', email };

  // Account exists: re-apply what Zoho currently says. Idempotent, and the
  // only way a tier change that was never pushed reaches the LMS.
  return { action: 'entitlements', reason: 'refresh', email };
}

/**
 * One pass.
 *
 * Every dependency is injected so the whole loop is testable without Zoho or
 * Firestore. `dryRun` reports what it would do and writes nothing — including
 * leaving the watermark where it was, so a dry run never hides real work from
 * the next live one.
 */
async function runReconcile(deps, options = {}) {
  const { dryRun = false, limit = DEFAULT_BATCH, now = new Date() } = options;

  const previous = await deps.readWatermark();
  const since = queryFloor(previous, now);

  const rows = await deps.queryIlUsers(since, limit);

  const results = [];
  let highWater = previous || null;

  for (const row of rows) {
    const email = String(row?.Email || '').trim();
    let hasAccount = false;
    if (email) {
      hasAccount = await deps.hasAccount(email).catch(() => false);
    }

    const decision = decideAction(row, hasAccount);

    if (decision.action !== 'skip' && !dryRun) {
      try {
        const outcome =
          decision.action === 'provision'
            ? await deps.provision(decision.email)
            : await deps.applyEntitlements(decision.email, row);
        decision.ok = outcome?.ok !== false;
        if (!decision.ok) decision.error = outcome?.reason || 'failed';
      } catch (err) {
        decision.ok = false;
        decision.error = err?.message || 'threw';
      }

      if (!decision.ok) {
        await deps.recordFailure(decision.email, decision.error).catch(() => {});
      }
    }

    results.push(decision);

    /*
     * The watermark only ever advances past a record that did not fail. A
     * failure leaves it behind that record so the next run sees it again —
     * which is the whole point of a reconciler, and the reason a failed run
     * must not look like a successful one.
     */
    if (row?.Modified_Time && decision.ok !== false) {
      if (!highWater || new Date(row.Modified_Time) > new Date(highWater)) {
        highWater = row.Modified_Time;
      }
    } else if (decision.ok === false) {
      break;
    }
  }

  const failed = results.filter((r) => r.ok === false).length;

  if (!dryRun && highWater && highWater !== previous) {
    await deps.writeWatermark(highWater);
  }

  return {
    ok: true,
    dryRun,
    since,
    scanned: rows.length,
    provisioned: results.filter((r) => r.action === 'provision' && r.ok !== false).length,
    refreshed: results.filter((r) => r.action === 'entitlements' && r.ok !== false).length,
    skipped: results.filter((r) => r.action === 'skip').length,
    failed,
    watermark: dryRun ? previous : highWater,
    // Enough to eyeball a dry run without dumping a cohort into a log line.
    sample: results.filter((r) => r.action !== 'skip').slice(0, 20),
  };
}

module.exports = {
  WATERMARK_DOC,
  IL_USERS_FIELDS,
  OVERLAP_MS,
  COLD_START_MS,
  DEFAULT_BATCH,
  queryFloor,
  toCoqlTime,
  buildQuery,
  decideAction,
  runReconcile,
};
