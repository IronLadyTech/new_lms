/**
 * Zoho Deluge invokeurl(..., parameters: map) posts application/x-www-form-urlencoded.
 * Firebase may not populate req.body unless we parse rawBody.
 */
/** Zoho webhook "Form-Data" bodies are multipart: name="email" parts. Null if it is not that. */
function parseMultipart(raw) {
  if (!/^--\S+\r?\n/.test(raw) || !raw.includes('Content-Disposition')) return null;
  const out = {};
  const part = /Content-Disposition:\s*form-data;\s*name="([^"]+)"[^\r\n]*\r?\n(?:[^\r\n]+\r?\n)*\r?\n([\s\S]*?)\r?\n--/gi;
  let m;
  while ((m = part.exec(raw))) out[m[1]] = m[2];
  return out;
}

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

  const multipart = parseMultipart(raw);
  if (multipart) return multipart;

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
