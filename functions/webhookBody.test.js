import { describe, it, expect } from 'vitest';
import { parseWebhookBody } from './webhookBody.js';

/** Zoho's webhook can send multipart, urlencoded or JSON; all must give the same fields. */
const b = '----zoho123';
const multipart = [
  `--${b}`,
  'Content-Disposition: form-data; name="email"',
  '',
  'a@x.com',
  `--${b}`,
  'Content-Disposition: form-data; name="phone"',
  'Content-Type: text/plain',
  '',
  '80502 77067',
  `--${b}--`,
  '',
].join('\r\n');

describe('webhook body', () => {
  it('multipart form data', () => {
    expect(parseWebhookBody({ body: {}, rawBody: Buffer.from(multipart) })).toEqual({
      email: 'a@x.com',
      phone: '80502 77067',
    });
  });
  it('urlencoded and JSON still work', () => {
    expect(parseWebhookBody({ rawBody: Buffer.from('email=a%40x.com') })).toEqual({ email: 'a@x.com' });
    expect(parseWebhookBody({ rawBody: Buffer.from('{"email":"a@x.com"}') })).toEqual({ email: 'a@x.com' });
  });
});
