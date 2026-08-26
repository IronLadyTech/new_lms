/**
 * Seed staging Firestore with synthetic load data (Admin SDK).
 * Refuses production. Destructive to docs it writes under load-* ids.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=.secrets/staging-sa.json \
 *   LOADTEST_PROJECT_ID=lmsironlady-staging \
 *   node load-test/seed.staging.js [learners=200] [batches=20] [tasksPerLearner=8]
 */
import { readFileSync, existsSync } from 'node:fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { assertNotProduction, PRODUCTION_PROJECT_ID } from './refuseProduction.js';

const learners = Number(process.argv[2] || 200);
const batchCount = Number(process.argv[3] || 20);
const tasksPerLearner = Number(process.argv[4] || 8);

const projectId =
  process.env.LOADTEST_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  '';

assertNotProduction(projectId, 'seed.staging');

const saPath = process.env.LOADTEST_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!saPath || !existsSync(saPath)) {
  console.error(
    'Set GOOGLE_APPLICATION_CREDENTIALS or LOADTEST_SERVICE_ACCOUNT to a staging service-account JSON path.'
  );
  process.exit(1);
}

const sa = JSON.parse(readFileSync(saPath, 'utf8'));
assertNotProduction(sa.project_id || projectId, 'seed.staging');
if ((sa.project_id || projectId) === PRODUCTION_PROJECT_ID) process.exit(1);

if (!getApps().length) {
  initializeApp({
    credential: cert(sa),
    projectId: projectId || sa.project_id,
  });
}

const db = getFirestore();
const BATCH_LIMIT = 400;
const daysAgo = (n) => Timestamp.fromDate(new Date(Date.now() - n * 86400000));

async function commitInChunks(label, ops) {
  let written = 0;
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const { ref, data } of ops.slice(i, i + BATCH_LIMIT)) batch.set(ref, data, { merge: true });
    await batch.commit();
    written += Math.min(BATCH_LIMIT, ops.length - i);
    process.stdout.write(`\r  ${label}: ${written}/${ops.length}`);
  }
  process.stdout.write('\n');
}

const staffEmail = process.env.STAFF_EMAIL || 'load-admin@example.com';
const staffUid = process.env.STAFF_UID || 'load-staff-staging';

const ops = [];

for (let t = 0; t < tasksPerLearner; t++) {
  ops.push({
    ref: db.collection('mbw_tasks').doc(`task-${t}`),
    data: {
      title: `Task ${t + 1}`,
      phase: t % 2 === 0 ? 'pre-preparation' : 'quarter-1',
      module: 'pre-preparation',
      order: t,
      type: 'text',
    },
  });
}

ops.push({
  ref: db.collection('users').doc(staffUid),
  data: {
    email: staffEmail,
    displayName: 'Load Admin',
    role: 'superadmin',
    blocked: false,
    createdAt: daysAgo(400),
  },
});

for (let b = 0; b < batchCount; b++) {
  const memberIds = [];
  for (let i = 0; i < Math.ceil(learners / batchCount); i++) {
    const idx = b * Math.ceil(learners / batchCount) + i;
    if (idx >= learners) break;
    memberIds.push(`load-learner-${idx}`);
  }
  ops.push({
    ref: db.collection('groups').doc(`load-batch-${b}`),
    data: {
      name: `Load Batch ${b + 1}`,
      programType: 'mbw',
      memberIds,
      createdAt: daysAgo(90),
    },
  });
}

for (let i = 0; i < learners; i++) {
  const batchId = `load-batch-${i % batchCount}`;
  ops.push({
    ref: db.collection('users').doc(`load-learner-${i}`),
    data: {
      email: `load-learner-${i}@example.com`,
      displayName: `Load Learner ${i}`,
      role: 'student',
      batchId,
      blocked: false,
      createdAt: daysAgo(30 + (i % 60)),
    },
  });
  for (let t = 0; t < Math.min(3, tasksPerLearner); t++) {
    ops.push({
      ref: db.collection('mbw_submissions').doc(`load-learner-${i}_task-${t}`),
      data: {
        userId: `load-learner-${i}`,
        taskId: `task-${t}`,
        batchId,
        status: t === 0 ? 'approved' : 'submitted',
        textValue: 'Seed submission',
        submittedAt: new Date().toISOString(),
        updatedAt: daysAgo(2),
      },
    });
  }
}

console.log(
  `Seeding staging ${projectId || sa.project_id}: ${learners} learners, ${batchCount} batches, ${tasksPerLearner} tasks…`
);
await commitInChunks('docs', ops);
console.log('Done. Create Auth user for staff separately if sign-in is required.');
process.exit(0);
