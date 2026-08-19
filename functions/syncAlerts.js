/**
 * Alerting for Zoho sync failures.
 *
 * Failures went to the Cloud Function log and nowhere else, so the outbound
 * sync could fail for every learner for weeks without anybody noticing. The log
 * is where you look once you already suspect something.
 *
 * One alert per failure would be worse than none: a bulk sync of five hundred
 * learners fails five hundred times for the same reason, and an inbox with five
 * hundred identical mails gets filtered. Failures are recorded as they happen
 * and a scheduled job mails one digest, grouped by cause.
 */

const FAILURES = 'sync_failures';

/** Where the digest goes. */
const ALERT_TO = 'ironladytech@gmail.com';

/**
 * Group failures by the thing that actually needs fixing.
 *
 * Zoho names the offending field in its error, so identical causes collapse to
 * one line with a count and a couple of examples — which is the difference
 * between "something is wrong" and "LMS_Password_Updated_At wants a different
 * date format".
 */
function groupFailures(failures) {
  const groups = new Map();
  for (const f of failures) {
    const key = (f?.message || 'Unknown error').trim();
    if (!groups.has(key)) groups.set(key, { message: key, count: 0, examples: [] });
    const g = groups.get(key);
    g.count += 1;
    if (g.examples.length < 3 && f?.email) g.examples.push(f.email);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

const escape = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/**
 * The digest itself. Returns null when there is nothing to report, so the
 * caller sends no mail at all rather than a cheerful "0 failures" every hour.
 */
function buildFailureDigest(failures, now = new Date()) {
  const list = Array.isArray(failures) ? failures.filter(Boolean) : [];
  if (!list.length) return null;

  const groups = groupFailures(list);
  const causes = groups.length === 1 ? '1 cause' : `${groups.length} causes`;
  const subject = `Iron Lady LMS — ${list.length} Zoho sync ${
    list.length === 1 ? 'failure' : 'failures'
  } (${causes})`;

  const rows = groups
    .map(
      (g) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:700;">${g.count}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">
          <code>${escape(g.message)}</code>
          ${
            g.examples.length
              ? `<br><span style="color:#666;font-size:13px;">e.g. ${escape(
                  g.examples.join(', ')
                )}</span>`
              : ''
          }
        </td>
      </tr>`
    )
    .join('');

  const html = `
    <p>${list.length} learner ${
      list.length === 1 ? 'record' : 'records'
    } failed to sync to Zoho since the last digest.</p>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
      <tr>
        <th style="text-align:left;padding:8px 12px;border-bottom:2px solid #C8102E;">Count</th>
        <th style="text-align:left;padding:8px 12px;border-bottom:2px solid #C8102E;">Cause</th>
      </tr>
      ${rows}
    </table>
    <p style="color:#666;font-size:13px;">
      Generated ${escape(now.toISOString())}. A cause naming a field usually means that field is
      missing from the Zoho Leads layout, or is a different type than the value being sent.
    </p>`;

  const text = [
    `${list.length} Zoho sync failures since the last digest.`,
    '',
    ...groups.map(
      (g) => `${g.count}x  ${g.message}${g.examples.length ? `  (e.g. ${g.examples.join(', ')})` : ''}`
    ),
  ].join('\n');

  return { to: ALERT_TO, subject, html, text, total: list.length, groups };
}

module.exports = { FAILURES, ALERT_TO, groupFailures, buildFailureDigest };
