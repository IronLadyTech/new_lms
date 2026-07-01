/**
 * Zoho Deluge invokeurl(..., parameters: map) posts application/x-www-form-urlencoded.
 * Firebase may not populate req.body unless we parse rawBody.
 */
function parseWebhookBody(req) {
  const existing = req?.body;
  if (existing && typeof existing === 'object' && !Buffer.isBuffer(existing)) {
    const keys = Object.keys(existing);
    if (keys.length > 0) return existing;
  }

  const raw =
    req?.rawBody != null
      ? Buffer.isBuffer(req.rawBody)
        ? req.rawBody.toString('utf8')
        : String(req.rawBody)
      : typeof existing === 'string'
        ? existing
        : '';

  if (!raw.trim()) return {};

  try {
    return JSON.parse(raw);
  } catch {
    /* fall through */
  }

  try {
    return Object.fromEntries(new URLSearchParams(raw));
  } catch {
    return {};
  }
}

function hasWebhookCredentials(body) {
  const email = (body?.email || body?.Email || '').trim();
  const password = (body?.password || body?.Password || '').trim();
  return Boolean(email && password.length >= 6);
}

module.exports = { parseWebhookBody, hasWebhookCredentials };
