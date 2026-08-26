/**
 * Runs inside `firebase emulators:exec` — seed, write sample, performance screens.
 */
import { spawnSync } from 'node:child_process';

function run(cmd, args, extraEnv = {}) {
  console.log(`\n>>> ${cmd} ${args.join(' ')}\n`);
  const r = spawnSync(cmd, args, {
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
    shell: true,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const signUp = await fetch(
  'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-key',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'load-admin@example.com',
      password: 'load-test-pw-1',
      returnSecureToken: true,
    }),
  }
).then((r) => r.json());

let staffUid = signUp.localId;
if (!staffUid) {
  const signIn = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'load-admin@example.com',
        password: 'load-test-pw-1',
        returnSecureToken: true,
      }),
    }
  ).then((r) => r.json());
  staffUid = signIn.localId;
}
if (!staffUid) {
  console.error('Could not create staff auth user', signUp);
  process.exit(1);
}
console.log('Staff uid:', staffUid);

run('node', ['load-test/seed.js', '200', '20', '8'], { STAFF_UID: staffUid });
run('node', ['load-test/seedLearners.js', '12', '8', '10', '10']);
run('node', ['load-test/writeLoad.js', '10', '2']);

run('npm', ['run', 'build'], {
  VITE_FIRESTORE_EMULATOR: 'true',
  VITE_FIREBASE_PROJECT_ID: 'lmsironlady-rules-test',
  VITE_FIREBASE_AUTH_DOMAIN: 'lmsironlady-rules-test.firebaseapp.com',
  VITE_FIREBASE_API_KEY: 'emulator-key',
  VITE_FIREBASE_APP_ID: '1:0:web:loadtest',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '0',
  VITE_FIREBASE_STORAGE_BUCKET: 'lmsironlady-rules-test.appspot.com',
});

run('npx', ['playwright', 'test', '--config', 'playwright.load.config.js', 'performance'], {
  PERF_ITERATIONS: '2',
});

console.log('\nLocal emulator suite finished.');
