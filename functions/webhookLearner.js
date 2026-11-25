/**
 * Who a Zoho webhook call is about. Learners sign in to the app with their mobile number,
 * so Zoho may send `phone` (Leads.Mobile) as well as, or instead of, `email`.
 *
 *   1. email in the call                         → that email
 *   2. phone → a Zoho Lead on that number with an email (the same lookup phone sign-in uses)
 *   3. phone → an LMS profile with that number   → its email
 */
function digits10(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

async function resolveWebhookEmail(db, body = {}, deps = {}) {
  const email = String(body.email || body.Email || '').trim().toLowerCase();
  if (email.includes('@')) return { email, via: 'email' };

  const raw = body.phone || body.Phone || body.mobile || body.Mobile || '';
  const ten = digits10(raw);
  if (ten.length !== 10) return { email: null, reason: 'email or phone is required' };

  if (deps.searchLeadsByPhone) {
    const leads = await deps.searchLeadsByPhone(`+91${ten}`).catch(() => []);
    const hit = (leads || []).find((l) => String(l.email || '').includes('@'));
    if (hit) return { email: hit.email.trim().toLowerCase(), via: 'zoho-phone' };
  }

  for (const value of [`+91${ten}`, ten, `91${ten}`]) {
    for (const field of ['phoneNumber', 'phone']) {
      const snap = await db.collection('users').where(field, '==', value).limit(1).get();
      const found = snap.docs[0]?.data()?.email;
      if (String(found || '').includes('@')) return { email: found.trim().toLowerCase(), via: 'lms-phone' };
    }
  }
  return { email: null, reason: `no learner with an email found for ${ten.slice(0, 2)}xxxxxx${ten.slice(-2)}` };
}

module.exports = { resolveWebhookEmail, digits10 };
