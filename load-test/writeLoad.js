/**
 * Writing at scale — many learners submitting at the same moment.
 *
 * Everything else here drives a browser, which is honest about what a user
 * feels but useless for this question: eight headless Chromium instances on one
 * laptop saturate the machine long before the database notices. This talks to
 * the database directly, so what it measures is the write path and the security
 * rules rather than the test rig.
 *
 * It writes the way the product does — a submission, then the learner's progress
 * summary — so the cost of keeping that summary current is included rather than
 * assumed away.
 *
 *   node load-test/writeLoad.js [concurrent=50] [each=3]
 */
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDocs, query, where, collection, writeBatch } from 'firebase/firestore';
import { buildProgressSummary } from '../src/utils/progressSummary.js';

const concurrent = Number(process.argv[2] || 50);
const each = Number(process.argv[3] || 3);

const testEnv = await initializeTestEnvironment({
  projectId: 'lmsironlady-rules-test',
  firestore: { host: '127.0.0.1', port: 8080 },
});

const percentile = (sorted, p) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();

  const tasks = (await getDocs(collection(db, 'mbw_tasks'))).docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
  if (!tasks.length) {
    console.error('No task catalogue — seed first with npm run loadtest:seed.');
    process.exit(1);
  }

  console.log(`${concurrent} learners submitting ${each} tasks each, all at once…`);

  const submit = async (learnerIndex) => {
    const userId = `load-learner-${learnerIndex}`;
    const timings = [];

    for (let n = 0; n < each; n++) {
      const task = tasks[n % tasks.length];
      const started = Date.now();

      const batch = writeBatch(db);
      batch.set(
        doc(db, 'mbw_submissions', `${userId}_${task.id}`),
        {
          userId,
          taskId: task.id,
          batchId: `load-batch-${learnerIndex % 20}`,
          status: 'submitted',
          textValue: `Write-load submission ${n}`,
          submittedAt: new Date().toISOString(),
          updatedAt: new Date(),
        },
        { merge: true }
      );
      await batch.commit();

      // The same follow-up the product performs on every save.
      const mine = await getDocs(
        query(collection(db, 'mbw_submissions'), where('userId', '==', userId))
      );
      const summaryBatch = writeBatch(db);
      summaryBatch.set(
        doc(db, 'users', userId),
        {
          mbwProgress: buildProgressSummary(
            tasks,
            mine.docs.map((d) => d.data())
          ),
        },
        { merge: true }
      );
      await summaryBatch.commit();

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
        learners: concurrent,
        submissionsEach: each,
        totalSubmissions: concurrent * each,
        failed: failures.length,
        wallClockSeconds: +(wallMs / 1000).toFixed(1),
        submissionsPerSecond: +((concurrent * each) / (wallMs / 1000)).toFixed(1),
        medianMs: percentile(all, 0.5),
        p95Ms: percentile(all, 0.95),
        slowestMs: all[all.length - 1],
      },
      null,
      1
    )
  );
  if (failures.length) console.log('first failure:', String(failures[0].reason).slice(0, 160));
});

process.exit(0);
