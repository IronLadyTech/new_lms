/** Format Firestore createdAt for admin tables. */
export function formatUserCreatedAt(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

/**
 * Best-effort label for how a Firestore users/ profile was created.
 * Exact auth method (Google vs email) is not stored on the profile.
 */
export function inferUserOrigin(profile = {}) {
  if (profile.provisionedFromZoho) return 'Zoho provision / webhook';
  if (profile.zohoEntitlementsSyncedAt && profile.zohoLeadId) return 'LMS account, Zoho linked';
  if (profile.zohoLeadId || profile.zohoContactId) return 'LMS account, Zoho linked';
  if (/^test@|^demo@|@example\.com$/i.test(profile.email || '')) return 'Likely test / manual';
  return 'LMS signup or login';
}
