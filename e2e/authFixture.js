import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Saved staff session. Contains auth tokens — gitignored via `*.local`. */
export const STAFF_STATE_PATH = path.join(here, '.auth-state.local.json');

/**
 * Credentials for authenticated scans.
 *
 * Read from e2e/.auth.local (gitignored) or the environment, so no secret ever
 * reaches the repository. Returns null when unset — callers skip rather than
 * fail, keeping CI green without secrets configured.
 */
export function readStaffCredentials() {
  const fromEnv = {
    email: process.env.STAFF_EMAIL,
    password: process.env.STAFF_PASSWORD,
  };
  if (fromEnv.email && fromEnv.password) return fromEnv;

  const file = path.join(here, '.auth.local');
  if (!fs.existsSync(file)) return null;

  const values = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const at = trimmed.indexOf('=');
    if (at === -1) continue;
    values[trimmed.slice(0, at).trim()] = trimmed.slice(at + 1).trim();
  }

  if (!values.STAFF_EMAIL || !values.STAFF_PASSWORD) return null;
  return { email: values.STAFF_EMAIL, password: values.STAFF_PASSWORD };
}

/**
 * Sign in through the real login form.
 *
 * Firebase keeps its session in IndexedDB rather than localStorage, so there is
 * no shortcut to seed here — the form is the supported path, and exercising it
 * also proves login still works.
 */
export async function signIn(page, { email, password }) {
  await page.goto('/auth/login');
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();

  // Any authenticated landing page ends the redirect chain.
  await page.waitForURL(/\/(app|cx|portal|admin|superadmin)/, { timeout: 30_000 });
}
