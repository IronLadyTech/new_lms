/**
 * How many learners could actually receive a WhatsApp reminder today.
 *
 * Read-only. It writes nothing and changes nothing — the point is to know the
 * real reach before anyone commits to templates, a gateway account, or a
 * promise about coverage.
 *
 * Against the emulator by default. To run it against the live project, set
 * GOOGLE_APPLICATION_CREDENTIALS and pass --live; it still only reads.
 *
 *   node load-test/reachabilityAudit.js
 */
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, getDocs } from 'firebase/firestore';
import { summariseReachability, toE164 } from '../src/utils/contactDetails.js';

if (process.argv.includes('--live')) {
  console.error(
    'Live auditing is not wired up here yet. Run it against a copy, or add\n' +
      'admin credentials deliberately — this script is kept read-only on purpose.'
  );
  process.exit(1);
}

const testEnv = await initializeTestEnvironment({
  projectId: 'lmsironlady-rules-test',
  firestore: { host: '127.0.0.1', port: 8080 },
});

await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  const snap = await getDocs(collection(db, 'users'));

  const learners = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => !u.role || u.role === 'student');

  const summary = summariseReachability(learners);
  const pct = (n) => (summary.total ? Math.round((n / summary.total) * 100) : 0);

  console.log(`\nLearners: ${summary.total}`);
  console.log(`Reachable on WhatsApp today: ${summary.reachable} (${pct(summary.reachable)}%)\n`);

  if (Object.keys(summary.byReason).length) {
    console.log('What is stopping the rest:');
    Object.entries(summary.byReason)
      .sort((a, b) => b[1] - a[1])
      .forEach(([reason, n]) => {
        console.log(`  ${String(n).padStart(5)}  ${reason}  (${pct(n)}%)`);
      });
  }

  /*
   * A number we could not parse is worth showing, not just counting: they are
   * usually a handful of typing habits, and seeing them tells whoever cleans
   * the data what they are actually dealing with.
   */
  const unusable = learners
    .filter((u) => u.phone && !toE164(u.phone).ok)
    .slice(0, 10)
    .map((u) => `${u.phone} → ${toE164(u.phone).reason}`);

  if (unusable.length) {
    console.log('\nExamples of numbers that need cleaning:');
    unusable.forEach((line) => console.log(`  ${line}`));
  }

  console.log(
    '\nNothing was written. Consent is the usual gap early on — it is a question\n' +
      'somebody has to ask, not a field anyone can populate.\n'
  );
});

process.exit(0);
