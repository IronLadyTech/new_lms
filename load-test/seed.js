/**
 * Fills the Firestore emulator with production-scale data.
 *
 * Runs against the emulator only — it writes with security rules disabled and
 * would be destructive against a real project. The connection is hardcoded to
 * 127.0.0.1 so it cannot reach one.
 */
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, writeBatch } from 'firebase/firestore';

/*
 * Seeds with security rules disabled — the same escape hatch the rules tests
 * use. Without it the seeder is (correctly) refused by the production rules it
 * is running against.
 */
const testEnv = await initializeTestEnvironment({
  projectId: 'lmsironlady-rules-test',
  firestore: { host: '127.0.0.1', port: 8080 },
});

/*
 * The rules-disabled context closes its client the moment the callback returns,
 * so all the writing has to happen inside it, not after.
 */
let db;

/** Firestore caps a batch at 500 writes. */
const BATCH_LIMIT = 450;

async function commitInChunks(label, items) {
  let written = 0;
  for (let i = 0; i < items.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const { ref, data } of items.slice(i, i + BATCH_LIMIT)) batch.set(ref, data);
    await batch.commit();
    written += Math.min(BATCH_LIMIT, items.length - i);
    process.stdout.write(`\r  ${label}: ${written}/${items.length}`);
  }
  process.stdout.write('\n');
}

const daysAgo = (n) => new Date(Date.now() - n * 86400000);

export async function seed({ learners, batches: batchCount, tasksPerLearner }) {
  const users = [];
  const groups = [];
  const submissions = [];

  // Staff the test signs in as.
  users.push({
    ref: doc(db, 'users', STAFF_UID),
    data: {
      email: 'load-admin@example.com',
      displayName: 'Load Admin',
      role: 'superadmin',
      blocked: false,
      createdAt: daysAgo(400),
    },
  });

  for (let b = 0; b < batchCount; b++) {
    groups.push({
      ref: doc(db, 'groups', `load-batch-${b}`),
      data: {
        name: `Load Batch ${b + 1}`,
        program: b % 2 === 0 ? 'mbw' : 'bm100',
        moderatorIds: [STAFF_UID],
        memberIds: [],
        courseIds: [],
        createdAt: daysAgo(300 - b),
      },
    });
  }

  for (let i = 0; i < learners; i++) {
    const uid = `load-learner-${i}`;
    const batchIndex = i % batchCount;
    groups[batchIndex].data.memberIds.push(uid);

    users.push({
      ref: doc(db, 'users', uid),
      data: {
        email: `learner${i}@example.com`,
        displayName: `Learner ${i}`,
        role: 'student',
        blocked: false,
        program: batchIndex % 2 === 0 ? 'mbw' : 'bm100',
        paymentStatus: i % 3 === 0 ? 'paid' : i % 3 === 1 ? 'register' : 'unpaid',
        batchId: `load-batch-${batchIndex}`,
        batchName: `Load Batch ${batchIndex + 1}`,
        streak: i % 12,
        // Spread across a year so month-based charts have real shape.
        createdAt: daysAgo(i % 365),
        lastActivityAt: daysAgo(i % 45),
      },
    });

    for (let t = 0; t < tasksPerLearner; t++) {
      const statuses = ['submitted', 'under_review', 'completed', 'needs_improvement'];
      submissions.push({
        ref: doc(db, 'mbw_submissions', `${uid}_task-${t}`),
        data: {
          userId: uid,
          taskId: `task-${t}`,
          batchId: `load-batch-${batchIndex}`,
          status: statuses[(i + t) % statuses.length],
          textValue: `Submission ${t} from learner ${i}`,
          submittedAt: daysAgo((i + t) % 90),
          updatedAt: daysAgo((i + t) % 90),
        },
      });
    }
  }

  await commitInChunks('users', users);
  await commitInChunks('batches', groups);
  await commitInChunks('submissions', submissions);

  return { users: users.length, batches: groups.length, submissions: submissions.length };
}

/** Created in the Auth emulator first; the profile must match its uid. */
const STAFF_UID = process.env.STAFF_UID || 'load-admin';

const learners = Number(process.argv[2] || 500);
const batchCount = Number(process.argv[3] || 20);
const tasksPerLearner = Number(process.argv[4] || 8);

console.log(`Seeding ${learners} learners, ${batchCount} batches, ${tasksPerLearner} tasks each…`);
const started = Date.now();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  db = ctx.firestore();
  const result = await seed({ learners, batches: batchCount, tasksPerLearner });
  console.log('Seeded:', result, `in ${((Date.now() - started) / 1000).toFixed(1)}s`);
});
process.exit(0);
