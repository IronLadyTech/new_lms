/**
 * CMS "Check against Zoho" for one LEP batch: does the app have the same learners as Zoho?
 *
 * Zoho side: active Leads whose LEP Start Date is the batch's Day 1, or whose LEP Batch text
 * starts with it (either style: "14/11/2026 - …" or "14 Nov 2026 – …"). One COQL read.
 * App side: the batch's learners (cmsBatchLearners.learnersForBatch).
 * Matched by Zoho Lead id, then email, then mobile. Every name that differs comes with the
 * reason and what to do, in plain words for the CEM team.
 */
const { isActiveLeadStatus } = require('./zohoBatchApply');
const { lepDay1FromBatchText } = require('./lepBatchText');

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ten(p) {
  return String(p || '').replace(/\D/g, '').slice(-10);
}
function mail(e) {
  return String(e || '').trim().toLowerCase();
}

function coqlForDay1(day1) {
  const [y, m, d] = day1.split('-');
  const dmy = `${d}/${m}/${y}`;
  const named = `${d} ${MON[Number(m) - 1]} ${y}`;
  return (
    'select id, Full_Name, Email, Mobile, Phone, Lead_Status, LEP_Batch, LEP_Reg_Date from Leads ' +
    `where ((LEP_Reg_Date = '${day1}' or LEP_Batch like '${dmy}%') or LEP_Batch like '${named}%') limit 0, 200`
  );
}

async function fetchZohoBatchLeads(day1, deps) {
  const token = await deps.getAccessToken();
  const query = coqlForDay1(day1);
  let lastError = null;
  for (const version of ['v7', 'v6', 'v2']) {
    const res = await deps.fetch(`${deps.getApiDomain()}/crm/${version}/coql`, {
      method: 'POST',
      headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ select_query: query }),
    });
    if (res.status === 204) return [];
    if (res.ok) return (await res.json())?.data || [];
    const body = await res.json().catch(() => ({}));
    lastError = `${version}: ${body?.message || `HTTP ${res.status}`}`;
  }
  throw new Error(`Zoho could not be read (${lastError})`);
}

/**
 * Compare. Pure.
 * @param leads Zoho rows; @param learners [{ uid, data }]; @param elsewhere(email) → her Day 1
 *   in the app if she has an account but is not in this batch, '' if none.
 */
/**
 * Which app learner is which Zoho lead. Pure; used by the check and by "Split into groups".
 * @returns {{ active, matched: Map<uid, lead>, unmatchedLeads: lead[] }}
 */
function matchRoster(leads, learners, { day1 } = {}) {
  const active = leads.filter((l) => isActiveLeadStatus(l.Lead_Status));
  const byLead = new Map();
  const byMail = new Map();
  const byPhone = new Map();
  learners.forEach((l) => {
    const d = l.data || {};
    const lead = d.zohoLeadId || d.zohoLead?.id;
    if (lead) byLead.set(String(lead), l);
    if (mail(d.email)) byMail.set(mail(d.email), l);
    const p = ten(d.phoneNumber || d.phone);
    if (p.length === 10) byPhone.set(p, l);
  });
  const matched = new Map();
  const unmatchedLeads = [];
  for (const lead of active) {
    const hit =
      byLead.get(String(lead.id)) ||
      byMail.get(mail(lead.Email)) ||
      byPhone.get(ten(lead.Mobile)) ||
      byPhone.get(ten(lead.Phone));
    if (hit && !matched.has(hit.uid)) matched.set(hit.uid, lead);
    else if (!hit) unmatchedLeads.push(lead);
  }
  /*
   * Some learners have this batch only on their Zoho registration record (IL Registration /
   * IL Users), with LEP Batch on the Lead left empty. The hourly batch sync copied that value
   * onto her account (zohoRawBatch), so she is on this batch in Zoho too — and must not lose
   * her group. Her Lead status still has to be active.
   */
  const viaRegistration = [];
  if (day1) {
    for (const l of learners) {
      if (matched.has(l.uid)) continue;
      const d = l.data || {};
      const raw = String(d.programAccess?.lep?.zohoRawBatch || '').trim();
      if (!raw || lepDay1FromBatchText(raw) !== day1) continue;
      if (!isActiveLeadStatus(d.zohoLeadStatus)) continue;
      matched.set(l.uid, { id: d.zohoLeadId || null, LEP_Batch: raw, fromRegistration: true });
      viaRegistration.push(l);
    }
  }
  return { active, matched, unmatchedLeads, viaRegistration };
}

function compareRoster(leads, learners, { day1, elsewhere = {} } = {}) {
  const { active, matched, unmatchedLeads, viaRegistration } = matchRoster(leads, learners, { day1 });
  const seen = new Set(matched.keys());
  const onlyZoho = [];
  for (const lead of unmatchedLeads) {
    const other = elsewhere[mail(lead.Email)];
    onlyZoho.push({
      name: lead.Full_Name || lead.Email || 'Unnamed lead',
      status: lead.Lead_Status || '',
      why:
        other === undefined || other === null
          ? 'Has not signed in to the app yet. Ask her to sign in with her mobile number.'
          : other && other !== day1
            ? `The app has her in the ${other} batch. Check her LEP Batch and LEP Start Date in Zoho.`
            : 'Has an app account but is not in this batch yet. It fixes itself within an hour; if not, tell tech.',
    });
  }
  const onlyApp = learners
    .filter((l) => !seen.has(l.uid))
    .map((l) => {
      const d = l.data || {};
      const zb = d.programAccess?.lep?.zohoRawBatch;
      return {
        name: d.displayName || d.name || d.email || 'Learner',
        why: zb
          ? `Not in Zoho's list for this date. Her Zoho batch reads "${zb}". Check her Lead status and batch in Zoho.`
          : 'Not in Zoho for this date. Check that her Lead has this LEP Batch and an active status.',
      };
    });
  const registrationOnly = viaRegistration.map((l) => {
    const d = l.data || {};
    return {
      name: d.displayName || d.name || d.email || 'Learner',
      why: `On this batch in Zoho's registration record ("${d.programAccess.lep.zohoRawBatch}"), but LEP Batch on her Lead is empty. Counted as matched and gets a group; fill LEP Batch on her Lead when you can.`,
    };
  });
  return {
    zohoCount: active.length + viaRegistration.length,
    appCount: learners.length,
    matched: seen.size,
    onlyZoho: onlyZoho.slice(0, 100),
    onlyApp: onlyApp.slice(0, 100),
    registrationOnly: registrationOnly.slice(0, 100),
  };
}

module.exports = { compareRoster, matchRoster, fetchZohoBatchLeads, coqlForDay1 };
