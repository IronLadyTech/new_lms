import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../src/firebase/config.js';
import { saveSubmission, reviewSubmission, SUBMISSION_STATUS } from '../src/services/mbwService.js';
import { createGroup, getGroups, addMemberToGroup } from '../src/services/groupService.js';

/**
 * Write-path tests — the actions the accessibility scans deliberately never
 * perform, because they change data.
 *
 * These run the real service functions the product calls, against the Firestore
 * and Auth emulators with the production security rules loaded. So a write that
 * the rules would reject in production is rejected here too: this exercises the
 * code and the rules together, which neither the unit tests nor the rules tests
 * do on their own.
 *
 * Nothing here touches the live project — see VITE_FIRESTORE_EMULATOR in
 * src/firebase/config.js.
 */

const LEARNER = { uid: null, email: 'writepath-learner@example.com', password: 'test-password-1' };
const STAFF = { uid: null, email: 'writepath-staff@example.com', password: 'test-password-2' };

async function ensureUser(account) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, account.email, account.password);
    account.uid = cred.user.uid;
  } catch (err) {
    if (err.code !== 'auth/email-already-in-use') throw err;
    const cred = await signInWithEmailAndPassword(auth, account.email, account.password);
    account.uid = cred.user.uid;
  }
}

/** Profiles drive every role check in the rules, so they must exist first. */
async function seedProfile(uid, role) {
  await setDoc(doc(db, 'users', uid), {
    email: `${uid}@example.com`,
    displayName: uid,
    role,
    blocked: false,
  });
}

async function signInAs(account) {
  await signOut(auth).catch(() => {});
  await signInWithEmailAndPassword(auth, account.email, account.password);
}

beforeAll(async () => {
  // Create both accounts, then seed their profiles while signed in as each —
  // the rules only let a user create their own profile document.
  await ensureUser(LEARNER);
  await seedProfile(LEARNER.uid, 'student');
  await ensureUser(STAFF);
  await seedProfile(STAFF.uid, 'moderator');
}, 60_000);

afterAll(async () => {
  await signOut(auth).catch(() => {});
});

beforeEach(async () => {
  await signInAs(LEARNER);
});

describe('submitting a lesson', () => {
  const taskId = 'mbw-orientation';

  it('writes the submission and reads back with the status it was given', async () => {
    const result = await saveSubmission(
      LEARNER.uid,
      taskId,
      { type: 'text', status: SUBMISSION_STATUS.SUBMITTED, textValue: 'My answer' },
      { batchId: 'batch-1' }
    );

    expect(result.id).toContain(LEARNER.uid);

    const snap = await getDoc(doc(db, 'mbw_submissions', result.id));
    expect(snap.exists()).toBe(true);
    expect(snap.data().status).toBe(SUBMISSION_STATUS.SUBMITTED);
    expect(snap.data().textValue).toBe('My answer');
    expect(snap.data().userId).toBe(LEARNER.uid);
  });

  it('stamps createdAt on first write and keeps the same document on resubmit', async () => {
    const first = await saveSubmission(
      LEARNER.uid,
      'mbw-resubmit-task',
      { type: 'text', status: SUBMISSION_STATUS.SUBMITTED, textValue: 'v1' },
      { batchId: 'batch-1' }
    );
    const second = await saveSubmission(
      LEARNER.uid,
      'mbw-resubmit-task',
      { type: 'text', status: SUBMISSION_STATUS.SUBMITTED, textValue: 'v2' },
      { batchId: 'batch-1' }
    );

    // One document per learner+task — a resubmit must not fork a second row,
    // or the CX queue would show the same work twice.
    expect(second.id).toBe(first.id);
    const snap = await getDoc(doc(db, 'mbw_submissions', first.id));
    expect(snap.data().textValue).toBe('v2');
    expect(snap.data().createdAt).toBeTruthy();
  });

  it('cannot write a submission under another learner id', async () => {
    // saveSubmission swallows the rejection and falls back to local storage,
    // so the assertion is that nothing reached the database.
    const foreignId = `${STAFF.uid}_stolen-task`;
    await saveSubmission(
      STAFF.uid,
      'stolen-task',
      { type: 'text', status: SUBMISSION_STATUS.SUBMITTED, textValue: 'not mine' },
      { batchId: 'batch-1' }
    );

    await signInAs(STAFF);
    const snap = await getDoc(doc(db, 'mbw_submissions', foreignId));
    expect(snap.exists()).toBe(false);
  });
});

describe('reviewing a submission', () => {
  const taskId = 'mbw-review-task';
  let subId;

  beforeEach(async () => {
    await signInAs(LEARNER);
    const result = await saveSubmission(
      LEARNER.uid,
      taskId,
      { type: 'text', status: SUBMISSION_STATUS.SUBMITTED, textValue: 'Please review' },
      { batchId: 'batch-1' }
    );
    subId = result.id;
  });

  it('marks the work complete when staff approve it', async () => {
    await signInAs(STAFF);
    await reviewSubmission(subId, {
      outcome: 'approved',
      feedback: 'Well argued.',
      reviewerId: STAFF.uid,
    });

    const snap = await getDoc(doc(db, 'mbw_submissions', subId));
    expect(snap.data().status).toBe(SUBMISSION_STATUS.COMPLETED);
    expect(snap.data().reviewOutcome).toBe('approved');
    expect(snap.data().feedback).toBe('Well argued.');
    expect(snap.data().completedAt).toBeTruthy();
  });

  it('sends the work back when staff ask for improvement', async () => {
    await signInAs(STAFF);
    await reviewSubmission(subId, {
      outcome: 'needs_improvement',
      feedback: 'Add the delta table.',
      reviewerId: STAFF.uid,
    });

    const snap = await getDoc(doc(db, 'mbw_submissions', subId));
    expect(snap.data().status).toBe(SUBMISSION_STATUS.NEEDS_IMPROVEMENT);
    expect(snap.data().completedAt).toBeNull();
  });

  it('keeps every round of feedback rather than overwriting it', async () => {
    // Its own task id: reviewHistory appends, so sharing a document with the
    // other tests in this block would carry their entries in.
    const ownTask = 'mbw-history-task';
    const own = await saveSubmission(
      LEARNER.uid,
      ownTask,
      { type: 'text', status: SUBMISSION_STATUS.SUBMITTED, textValue: 'For history' },
      { batchId: 'batch-1' }
    );

    await signInAs(STAFF);
    await reviewSubmission(own.id, {
      outcome: 'needs_improvement',
      feedback: 'Round 1',
      reviewerId: STAFF.uid,
    });
    await reviewSubmission(own.id, {
      outcome: 'approved',
      feedback: 'Round 2',
      reviewerId: STAFF.uid,
    });

    const history = (await getDoc(doc(db, 'mbw_submissions', own.id))).data().reviewHistory;
    expect(history).toHaveLength(2);
    expect(history.map((h) => h.feedback)).toEqual(['Round 1', 'Round 2']);
  });

  it('lets the learner resubmit after being asked to improve', async () => {
    await signInAs(STAFF);
    await reviewSubmission(subId, {
      outcome: 'needs_improvement',
      feedback: 'Revise',
      reviewerId: STAFF.uid,
    });

    await signInAs(LEARNER);
    await saveSubmission(
      LEARNER.uid,
      taskId,
      { type: 'text', status: SUBMISSION_STATUS.SUBMITTED, textValue: 'Revised answer' },
      { batchId: 'batch-1' }
    );

    const snap = await getDoc(doc(db, 'mbw_submissions', subId));
    expect(snap.data().status).toBe(SUBMISSION_STATUS.SUBMITTED);
    expect(snap.data().textValue).toBe('Revised answer');
  });

  it('does not let a learner approve their own work', async () => {
    await expect(
      reviewSubmission(subId, { outcome: 'approved', feedback: 'me', reviewerId: LEARNER.uid })
    ).rejects.toThrow();

    const snap = await getDoc(doc(db, 'mbw_submissions', subId));
    expect(snap.data().status).not.toBe(SUBMISSION_STATUS.COMPLETED);
  });
});

describe('creating a batch', () => {
  beforeEach(async () => {
    await signInAs(STAFF);
  });

  it('creates a batch staff can read back', async () => {
    const group = await createGroup({
      name: 'MBW March 2026',
      description: 'Test cohort',
      program: 'mbw',
      createdBy: STAFF.uid,
      moderatorIds: [STAFF.uid],
    });

    const snap = await getDoc(doc(db, 'groups', group.id));
    expect(snap.exists()).toBe(true);
    expect(snap.data().name).toBe('MBW March 2026');
    expect(snap.data().moderatorIds).toContain(STAFF.uid);
  });

  it('adds a learner to the batch', async () => {
    const group = await createGroup({
      name: 'Batch with members',
      program: 'mbw',
      createdBy: STAFF.uid,
      moderatorIds: [STAFF.uid],
    });
    await addMemberToGroup(group.id, LEARNER.uid);

    const snap = await getDoc(doc(db, 'groups', group.id));
    expect(snap.data().memberIds).toContain(LEARNER.uid);
  });

  it('lists the batches back', async () => {
    await createGroup({
      name: 'Listed batch',
      program: 'mbw',
      createdBy: STAFF.uid,
      moderatorIds: [STAFF.uid],
    });
    const groups = await getGroups();
    expect(groups.some((g) => g.name === 'Listed batch')).toBe(true);
  });

  it('does not let a learner create a batch', async () => {
    await signInAs(LEARNER);
    await expect(
      createGroup({ name: 'Learner batch', program: 'mbw', createdBy: LEARNER.uid })
    ).rejects.toThrow();
  });
});
