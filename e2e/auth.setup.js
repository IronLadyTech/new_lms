import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readStaffCredentials, signIn, STAFF_STATE_PATH } from './authFixture.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Signs in once and saves the session for the staff scans to reuse.
 *
 * Previously each of the 12 staff tests logged in itself. Twelve concurrent
 * logins against the real Firebase project made the suite fail unpredictably —
 * between 0 and 9 tests per run, with no code change. One login removes that
 * contention entirely.
 *
 * Firebase keeps its session in IndexedDB, so the saved state must include it.
 */
setup('authenticate staff session', async ({ page, context }) => {
  const credentials = readStaffCredentials();
  setup.skip(!credentials, 'No staff credentials — see e2e/.auth.local.example');

  await signIn(page, credentials);

  fs.mkdirSync(path.dirname(STAFF_STATE_PATH), { recursive: true });
  await context.storageState({ path: STAFF_STATE_PATH, indexedDB: true });

  expect(fs.existsSync(STAFF_STATE_PATH)).toBe(true);
});

// Referenced so the import is not flagged as unused by tooling.
export { here };
