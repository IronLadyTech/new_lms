/**
 * A learner's LEP batch written back to her Zoho Lead when she changes it in the app.
 *
 *   LEP_Batch      "14 Nov 2026 – 14 Dec 2026"  (the style CX use; the cohort groups follow it)
 *   LEP_Reg_Date   2026-11-14                   (LEP Start Date = Day 1)
 *   LEP_End_Date   2026-12-14                   (one calendar month later)
 *
 * The Zoho workflow "Batch changed → LMS" then fires the batch webhook, which moves her LMS
 * group too — the same path as when CX change it by hand.
 */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').slice(0, 10));
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIso(d) {
  return d.toISOString().slice(0, 10);
}

/** Same day next month; the 31st becomes the month's last day. */
function addOneMonth(iso) {
  const d = parseIso(iso);
  if (!d) return '';
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + 1);
  if (d.getUTCDate() !== day) d.setUTCDate(0);
  return toIso(d);
}

function label(iso) {
  const d = parseIso(iso);
  if (!d) return '';
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** The three Lead fields for a Day 1 (YYYY-MM-DD), or {} when the date is not valid. */
function lepBatchLeadFields(day1Iso) {
  const start = String(day1Iso || '').slice(0, 10);
  if (!parseIso(start)) return {};
  const end = addOneMonth(start);
  return {
    LEP_Batch: `${label(start)} – ${label(end)}`,
    LEP_Reg_Date: start,
    LEP_End_Date: end,
  };
}

module.exports = { lepBatchLeadFields, addOneMonth };
