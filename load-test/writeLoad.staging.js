/**
 * Writing at scale against **staging** Firestore (Admin SDK).
 *
 * Refuses production project id `lmsironlady`. See docs/SCALE_TESTING.md.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=.secrets/staging-sa.json \
 *   LOADTEST_PROJECT_ID=lmsironlady-staging \
 *   npm run loadtest:writes:staging -- [concurrent=50] [each=3]
 */
import { readFileSync, existsSync } from 'node:fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { buildProgressSummary } from '../src/utils/progressSummary.js';
import { assertNotProduction, PRODUCTION_PROJECT_ID } from './refuseProduction.js';

const concurrent = Number(process.argv[2] || 50);
const each = Number(process.argv[3] || 3);

const projectId =
  process.env.LOADTEST_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  '';

assertNotProduction(projectId, 'loadtest:writes:staging');

const saPath = process.env.LOADTEST_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!saPath || !existsSync(saPath)) {
  console.error(
    'Set GOOGLE_APPLICATION_CREDENTIALS or LOADTEST_SERVICE_ACCOUNT to a staging service-account JSON path.'
  );
  process.exit(1);
}

const sa = JSON.parse(readFileSync(saPath, 'utf8'));
if (sa.project_id === PRODUCTION_PROJECT_ID) {
  assertNotProduction(sa.project_id, 'loadtest:writes:staging');
}
assertNotProduction(sa.project_id || projectId, 'loadtest:writes:staging');

if (!getApps().length) {
  initializeApp({
    credential: cert(sa),
    projectId: projectId || sa.project_id,
  });
}

const db = getFirestore();
const percentile = (sorted, p) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : null;

const tasksSnap = await db.collection('mbw_tasks').get();
const tasks = tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
if (!tasks.length) {
  console.error(
    'No mbw_tasks in staging — seed a catalogue first (see docs/SCALE_TESTING.md / load-test/seed.staging.js).'
  );
  process.exit(1);
}

console.log(
  `STAGING write load → project=${projectId || sa.project_id} · ${concurrent} learners × ${each} submissions`
);

const submit = async (learnerIndex) => {
  const userId = `load-learner-${learnerIndex}`;
  const timings = [];

  for (let n = 0; n < each; n++) {
    const task = tasks[n % tasks.length];
    const started = Date.now();
    const subRef = db.collection('mbw_submissions').doc(`${userId}_${task.id}`);
    await subRef.set(
      {
        userId,
        taskId: task.id,
        batchId: `load-batch-${learnerIndex % 20}`,
        status: 'submitted',
        textValue: `Write-load staging submission ${n}`,
        submittedAt: new Date().toISOString(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const mine = await db.collection('mbw_submissions').where('userId', '==', userId).get();
    await db
      .collection('users')
      .doc(userId)
      .set(
        {
          mbwProgress: buildProgressSummary(
            tasks,
            mine.docs.map((d) => d.data())
          ),
        },
        { merge: true }
      );

    timings.push(Date.now() - started);
  }
  return timings;
};

const wallStart = Date.now();
const settled = await Promise.allSettled(Array.from({ length: concurrent }, (_, i) => submit(i)));
const wallMs = Date.now() - wallStart;

const failures = settled.filter((r) => r.status === 'rejected');
const all = settled
  .filter((r) => r.status === 'fulfilled')
  .flatMap((r) => r.value)
  .sort((a, b) => a - b);

console.log(
  JSON.stringify(
    {
      target: 'staging',
      projectId: projectId || sa.project_id,
      learners: concurrent,
      submissionsEach: each,
      totalSubmissions: concurrent * each,
      failed: failures.length,
      wallClockSeconds: +(wallMs / 1000).toFixed(1),
      submissionsPerSecond: +((concurrent * each) / (wallMs / 1000)).toFixed(1),
      medianMs: percentile(all, 0.5),
      p95Ms: percentile(all, 0.95),
      slowestMs: all[all.length - 1] ?? null,
    },
    null,
    1
  )
);
if (failures.length) console.log('first failure:', String(failures[0].reason).slice(0, 200));

process.exit(failures.length ? 1 : 0);
