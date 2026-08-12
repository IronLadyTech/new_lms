/**
 * Creates sign-in-able learners in the emulator, plus the content their
 * dashboard reads.
 *
 * The staff load test only needed learner *records*. Measuring the learner site
 * needs learner *accounts*, because the app keeps its session in Firebase Auth
 * and there is no way to fake being signed in from the outside.
 *
 * Emulator only — the Auth and Firestore hosts are hardcoded to 127.0.0.1.
 */
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, writeBatch } from 'firebase/firestore';

const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const KEY = 'emulator-key';
const PROJECT = 'lmsironlady-rules-test';

export const LEARNER_PASSWORD = 'load-learner-pw-1';
export const learnerEmail = (i) => `loadlearner${i}@example.com`;

/** Creates the account, or returns the existing uid if it is already there. */
async function ensureAccount(email) {
  const body = JSON.stringify({ email, password: LEARNER_PASSWORD, returnSecureToken: true });
  const headers = { 'Content-Type': 'application/json' };

  const signUp = await fetch(`${AUTH}/accounts:signUp?key=${KEY}`, {
    method: 'POST',
    headers,
    body,
  }).then((r) => r.json());
  if (signUp.localId) return signUp.localId;

  const signIn = await fetch(`${AUTH}/accounts:signInWithPassword?key=${KEY}`, {
    method: 'POST',
    headers,
    body,
  }).then((r) => r.json());
  return signIn.localId || null;
}

const COURSES = [
  { id: 'course-lep', code: 'LEP', title: 'Leadership Essentials Program' },
  { id: 'course-100bm', code: '100BM', title: '100 Board Members' },
  { id: 'course-mbw', code: 'MBW', title: 'Master of Business Warfare' },
];

const daysAgo = (n) => new Date(Date.now() - n * 86400000);

async function seed(db, count, concurrentAccounts, annCount, eventCount) {
  const batchWrite = [];

  COURSES.forEach((c, i) => {
    batchWrite.push({
      ref: doc(db, 'courses', c.id),
      data: {
        code: c.code,
        title: c.title,
        description: `${c.title} — seeded for load measurement.`,
        order: i,
        createdAt: daysAgo(400),
      },
    });
  });

  // Content the dashboard reads whole. It grows with time, not with headcount.
  for (let i = 0; i < annCount; i++) {
    batchWrite.push({
      ref: doc(db, 'announcements', `load-ann-${i}`),
      data: {
        title: `Announcement ${i + 1}`,
        body: 'Seeded announcement for load measurement.',
        audience: 'all',
        createdAt: daysAgo(i * 3),
        active: true,
      },
    });
  }
  for (let i = 0; i < eventCount; i++) {
    batchWrite.push({
      ref: doc(db, 'events', `load-event-${i}`),
      data: {
        title: `Session ${i + 1}`,
        date: new Date(Date.now() + (i - 10) * 86400000).toLocaleDateString('en-CA'),
        program: i % 2 === 0 ? 'mbw' : '100bm',
        createdAt: daysAgo(30),
      },
    });
  }

  /*
   * Only the learners that actually sign in need Auth accounts; the rest exist
   * purely to make the cohort the right size. Creating thousands of accounts
   * would add minutes to the run for no measurement value.
   */
  const uids = [];
  for (let i = 0; i < concurrentAccounts; i++) {
    const uid = await ensureAccount(learnerEmail(i));
    if (uid) uids.push(uid);
  }

  const profileFor = (i) => ({
    email: learnerEmail(i),
    displayName: `Load Learner ${i}`,
    role: 'student',
    blocked: false,
    program: 'mbw',
    programs: ['mbw', '100bm', 'lep'],
    enrolledCourses: COURSES.map((c) => c.id),
    paymentStatus: 'paid',
    batchId: `load-batch-${i % 20}`,
    batchName: `Load Batch ${(i % 20) + 1}`,
    streak: i % 12,
    createdAt: daysAgo(i % 365),
    lastActivityAt: daysAgo(i % 30),
  });

  uids.forEach((uid, i) => {
    batchWrite.push({ ref: doc(db, 'users', uid), data: profileFor(i) });
    // A few activities each, so the dashboard's activity list is not empty.
    for (let a = 0; a < 3; a++) {
      batchWrite.push({
        ref: doc(db, 'activities', `${uid}-act-${a}`),
        data: {
          userId: uid,
          courseId: COURSES[a % COURSES.length].id,
          type: 'lesson_complete',
          detail: `Completed lesson ${a + 1}`,
          createdAt: daysAgo(a),
        },
      });
    }
  });

  // Padding learners, so the cohort is the stated size without extra accounts.
  for (let i = uids.length; i < count; i++) {
    batchWrite.push({ ref: doc(db, 'users', `load-pad-${i}`), data: profileFor(i) });
  }

  const LIMIT = 450;
  for (let i = 0; i < batchWrite.length; i += LIMIT) {
    const b = writeBatch(db);
    batchWrite.slice(i, i + LIMIT).forEach(({ ref, data }) => b.set(ref, data, { merge: true }));
    await b.commit();
    process.stdout.write(
      `\r  writing: ${Math.min(i + LIMIT, batchWrite.length)}/${batchWrite.length}`
    );
  }
  process.stdout.write('\n');

  return {
    accounts: uids.length,
    cohort: count,
    announcements: annCount,
    events: eventCount,
    docs: batchWrite.length,
  };
}

const cohort = Number(process.argv[2] || 1000);
const accounts = Number(process.argv[3] || 10);
/* Announcements and events grow with how long the LMS has been running, not
 * with headcount, so they are varied independently of the cohort. */
const annCount = Number(process.argv[4] || 25);
const eventCount = Number(process.argv[5] || 40);

const testEnv = await initializeTestEnvironment({
  projectId: PROJECT,
  firestore: { host: '127.0.0.1', port: 8080 },
});

console.log(
  `Seeding learner site: cohort ${cohort}, ${accounts} accounts, ${annCount} announcements, ${eventCount} events…`
);
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const result = await seed(ctx.firestore(), cohort, accounts, annCount, eventCount);
  console.log('Seeded:', result);
});
process.exit(0);
