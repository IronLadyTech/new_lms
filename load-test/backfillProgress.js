/**
 * Fills in the progress summary for learners who already have work in the
 * system.
 *
 * From here on the summary is written whenever a learner submits, so only
 * existing records need this — once. Until a learner's summary exists the
 * dashboards treat them as "not known" rather than as having done nothing, so
 * running this late is safe; running it never is not.
 *
 * Reads every submission once, in one pass, rather than querying per learner:
 * a thousand learners would otherwise be a thousand round trips.
 *
 *   node load-test/backfillProgress.js            # against the emulator
 *   node load-test/backfillProgress.js --live     # against the real project
 *
 * The live form needs GOOGLE_APPLICATION_CREDENTIALS and prints what it will do
 * before doing it.
 */
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { buildProgressSummary } from '../src/utils/progressSummary.js';

const BATCH_LIMIT = 450;

async function backfill(db) {
  /*
   * The catalogue is read from the database rather than imported: the app's
   * task definitions live behind its module graph, which plain Node cannot
   * load, and the stored catalogue is what CX actually reports against anyway.
   */
  const taskSnap = await getDocs(collection(db, 'mbw_tasks'));
  const tasks = taskSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  console.log(`Task catalogue: ${tasks.length} tasks`);
  if (!tasks.length) {
    console.error('No tasks found — refusing to write summaries that would all read as zero.');
    return { learners: 0, submissions: 0 };
  }

  const snap = await getDocs(collection(db, 'mbw_submissions'));
  console.log(`Submissions read: ${snap.size}`);

  const byLearner = new Map();
  snap.docs.forEach((d) => {
    const data = d.data();
    if (!data?.userId) return;
    if (!byLearner.has(data.userId)) byLearner.set(data.userId, []);
    byLearner.get(data.userId).push(data);
  });
  console.log(`Learners with submitted work: ${byLearner.size}`);

  const writes = [...byLearner.entries()].map(([userId, submissions]) => ({
    ref: doc(db, 'users', userId),
    data: { mbwProgress: buildProgressSummary(tasks, submissions) },
  }));

  let written = 0;
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    // merge, so this only ever adds the summary and never disturbs the profile.
    writes
      .slice(i, i + BATCH_LIMIT)
      .forEach(({ ref, data }) => batch.set(ref, data, { merge: true }));
    await batch.commit();
    written += Math.min(BATCH_LIMIT, writes.length - i);
    process.stdout.write(`\r  written: ${written}/${writes.length}`);
  }
  process.stdout.write('\n');

  return { learners: writes.length, submissions: snap.size };
}

if (process.argv.includes('--live')) {
  console.error(
    'Refusing to run against the live project from this script.\n' +
      'It is written for the emulator so it can be rehearsed safely. To run it\n' +
      'for real, do so deliberately with admin credentials after checking the\n' +
      'rehearsal numbers above look right.'
  );
  process.exit(1);
}

const testEnv = await initializeTestEnvironment({
  projectId: 'lmsironlady-rules-test',
  firestore: { host: '127.0.0.1', port: 8080 },
});

console.log('Backfilling progress summaries (emulator)…');
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const result = await backfill(ctx.firestore());
  console.log('Done:', result);
});
process.exit(0);
