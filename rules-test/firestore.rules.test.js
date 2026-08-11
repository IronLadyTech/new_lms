import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  getTestEnv,
  cleanup,
  clearData,
  seedProfile,
  seedDoc,
  seedAllRoles,
  dbFor,
  dbForEmail,
  read,
  write,
  patch,
  remove,
  ROLES,
} from './helpers.js';

/**
 * Security rules are the last line of defence: the interface can be bypassed by
 * anyone with a browser console, so these rules are what actually protects
 * learner data. A mistake here is invisible in the UI, which is why it was the
 * highest remaining risk before this suite existed.
 *
 * Tests are written from the attacker's side — what each role must NOT be able
 * to do — because a permissive rule fails silently while a strict one fails
 * loudly in the product.
 */

beforeAll(async () => {
  await getTestEnv();
});
afterAll(cleanup);

beforeEach(async () => {
  await clearData();
  await seedAllRoles();
});

describe('users', () => {
  it('lets a learner read their own profile', async () => {
    await assertSucceeds(read(await dbFor(ROLES.learner.uid), `users/${ROLES.learner.uid}`));
  });

  it('stops a learner reading another learner profile', async () => {
    await assertFails(read(await dbFor(ROLES.learner.uid), `users/${ROLES.otherLearner.uid}`));
  });

  it('stops a signed-out visitor reading any profile', async () => {
    await assertFails(read(await dbFor(null), `users/${ROLES.learner.uid}`));
  });

  it('lets staff read any profile', async () => {
    await assertSucceeds(read(await dbFor(ROLES.moderator.uid), `users/${ROLES.learner.uid}`));
    await assertSucceeds(read(await dbFor(ROLES.admin.uid), `users/${ROLES.learner.uid}`));
  });

  it('stops a learner promoting themselves to admin', async () => {
    // The single most valuable assertion in this file.
    await assertFails(
      patch(await dbFor(ROLES.learner.uid), `users/${ROLES.learner.uid}`, { role: 'admin' })
    );
    await assertFails(
      patch(await dbFor(ROLES.learner.uid), `users/${ROLES.learner.uid}`, { role: 'superadmin' })
    );
  });

  it('stops a learner unblocking themselves', async () => {
    await assertFails(
      patch(await dbFor(ROLES.blocked.uid), `users/${ROLES.blocked.uid}`, { blocked: false })
    );
  });

  it('stops a learner granting themselves paid access', async () => {
    for (const field of ['accessTier', 'paymentStatus', 'provisionedFromZoho']) {
      await assertFails(
        patch(await dbFor(ROLES.learner.uid), `users/${ROLES.learner.uid}`, { [field]: 'paid' })
      );
    }
  });

  it('lets a learner edit their own display name', async () => {
    await assertSucceeds(
      patch(await dbFor(ROLES.learner.uid), `users/${ROLES.learner.uid}`, {
        displayName: 'New Name',
      })
    );
  });

  it('stops a learner editing anyone else', async () => {
    await assertFails(
      patch(await dbFor(ROLES.learner.uid), `users/${ROLES.otherLearner.uid}`, {
        displayName: 'Hacked',
      })
    );
  });

  it('lets an admin change a role, and a superadmin delete an account', async () => {
    await assertSucceeds(
      write(await dbFor(ROLES.admin.uid), `users/${ROLES.learner.uid}`, {
        email: 'learner1@example.com',
        displayName: 'learner1',
        blocked: false,
        role: 'moderator',
      })
    );
    await assertSucceeds(remove(await dbFor(ROLES.superadmin.uid), `users/${ROLES.learner.uid}`));
  });

  it('stops an admin deleting an account — superadmin only', async () => {
    await assertFails(remove(await dbFor(ROLES.admin.uid), `users/${ROLES.learner.uid}`));
  });

  it('stops a moderator changing roles', async () => {
    await assertFails(
      patch(await dbFor(ROLES.moderator.uid), `users/${ROLES.learner.uid}`, { role: 'admin' })
    );
  });

  it('stops a new account seeding itself paid on creation', async () => {
    const db = await dbFor('brandnew');
    await assertFails(
      write(db, 'users/brandnew', { email: 'x@example.com', role: 'student', accessTier: 'paid' })
    );
  });
});

describe('access_requests (public guest enquiry form)', () => {
  const valid = {
    name: 'Priya Sharma',
    email: 'priya@example.com',
    program: 'mbw',
    message: 'I would like to enrol.',
    status: 'new',
    source: 'lms_guest',
    createdAt: new Date(),
  };

  it('accepts a well-formed enquiry from a signed-out visitor', async () => {
    await assertSucceeds(write(await dbFor(null), 'access_requests/r1', valid));
  });

  it('never lets the public read enquiries back', async () => {
    await seedDoc('access_requests/r1', valid);
    await assertFails(read(await dbFor(null), 'access_requests/r1'));
    await assertFails(read(await dbFor(ROLES.learner.uid), 'access_requests/r1'));
  });

  it('lets staff read and work the queue', async () => {
    await seedDoc('access_requests/r1', valid);
    await assertSucceeds(read(await dbFor(ROLES.moderator.uid), 'access_requests/r1'));
    await assertSucceeds(
      patch(await dbFor(ROLES.moderator.uid), 'access_requests/r1', { status: 'contacted' })
    );
  });

  it('rejects a malformed email', async () => {
    await assertFails(
      write(await dbFor(null), 'access_requests/r2', { ...valid, email: 'not-an-email' })
    );
  });

  it('rejects oversized fields, so the form cannot be used as free storage', async () => {
    await assertFails(
      write(await dbFor(null), 'access_requests/r3', { ...valid, message: 'x'.repeat(2001) })
    );
    await assertFails(
      write(await dbFor(null), 'access_requests/r4', { ...valid, name: 'x'.repeat(121) })
    );
  });

  it('rejects extra fields, so the shape cannot be smuggled past', async () => {
    await assertFails(write(await dbFor(null), 'access_requests/r5', { ...valid, isAdmin: true }));
  });

  it('rejects an enquiry that arrives pre-marked as handled', async () => {
    await assertFails(
      write(await dbFor(null), 'access_requests/r6', { ...valid, status: 'closed' })
    );
  });

  it('stops the public deleting enquiries', async () => {
    await seedDoc('access_requests/r1', valid);
    await assertFails(remove(await dbFor(null), 'access_requests/r1'));
  });
});

describe('courses, events, announcements', () => {
  beforeEach(async () => {
    await seedDoc('courses/c1', { title: 'MBW', code: 'MBW' });
    await seedDoc('events/e1', { title: 'Live session', date: '2026-05-10' });
    await seedDoc('announcements/a1', { title: 'Notice' });
  });

  it('lets any signed-in learner read them', async () => {
    const db = await dbFor(ROLES.learner.uid);
    await assertSucceeds(read(db, 'courses/c1'));
    await assertSucceeds(read(db, 'events/e1'));
    await assertSucceeds(read(db, 'announcements/a1'));
  });

  it('stops a signed-out visitor reading them', async () => {
    await assertFails(read(await dbFor(null), 'courses/c1'));
  });

  it('stops a guest account reading them', async () => {
    await assertFails(read(await dbFor(ROLES.guest.uid), 'courses/c1'));
  });

  it('stops a learner or moderator writing them', async () => {
    await assertFails(write(await dbFor(ROLES.learner.uid), 'courses/c2', { title: 'Fake' }));
    await assertFails(write(await dbFor(ROLES.moderator.uid), 'courses/c2', { title: 'Fake' }));
  });

  it('lets an admin write them', async () => {
    await assertSucceeds(
      write(await dbFor(ROLES.admin.uid), 'courses/c2', { title: 'New course' })
    );
  });
});

describe('resources — locked content', () => {
  beforeEach(async () => {
    await seedDoc('resources/open1', { title: 'Open', locked: false });
    await seedDoc('resources/locked1', { title: 'Paid only', locked: true });
  });

  it('lets a learner read unlocked resources', async () => {
    await assertSucceeds(read(await dbFor(ROLES.learner.uid), 'resources/open1'));
  });

  it('stops a learner reading locked resources — the paywall is enforced here', async () => {
    await assertFails(read(await dbFor(ROLES.learner.uid), 'resources/locked1'));
  });

  it('lets staff read locked resources', async () => {
    await assertSucceeds(read(await dbFor(ROLES.moderator.uid), 'resources/locked1'));
  });
});

describe('activities', () => {
  it('lets a learner log their own activity', async () => {
    await assertSucceeds(
      write(await dbFor(ROLES.learner.uid), 'activities/a1', {
        userId: ROLES.learner.uid,
        type: 'resource_view',
      })
    );
  });

  it('stops a learner logging activity as someone else', async () => {
    await assertFails(
      write(await dbFor(ROLES.learner.uid), 'activities/a2', {
        userId: ROLES.otherLearner.uid,
        type: 'resource_view',
      })
    );
  });

  it('stops a learner reading another learner activity', async () => {
    await seedDoc('activities/a3', { userId: ROLES.otherLearner.uid, type: 'resource_view' });
    await assertFails(read(await dbFor(ROLES.learner.uid), 'activities/a3'));
    await assertSucceeds(read(await dbFor(ROLES.moderator.uid), 'activities/a3'));
  });

  it('stops anyone but a superadmin rewriting history', async () => {
    await seedDoc('activities/a4', { userId: ROLES.learner.uid, type: 'resource_view' });
    await assertFails(patch(await dbFor(ROLES.learner.uid), 'activities/a4', { type: 'forged' }));
    await assertFails(remove(await dbFor(ROLES.admin.uid), 'activities/a4'));
    await assertSucceeds(remove(await dbFor(ROLES.superadmin.uid), 'activities/a4'));
  });
});

describe('groups (batches)', () => {
  beforeEach(async () => {
    await seedDoc('groups/g1', {
      name: 'MBW Jan',
      memberIds: [ROLES.learner.uid],
      moderatorIds: [ROLES.moderator.uid],
    });
    await seedDoc('groups/g2', { name: 'Other batch', memberIds: [], moderatorIds: [] });
  });

  it('lets a member read their own batch', async () => {
    await assertSucceeds(read(await dbFor(ROLES.learner.uid), 'groups/g1'));
  });

  it('stops a learner reading a batch they are not in', async () => {
    await assertFails(read(await dbFor(ROLES.learner.uid), 'groups/g2'));
  });

  it('lets staff create and update batches', async () => {
    await assertSucceeds(
      write(await dbFor(ROLES.moderator.uid), 'groups/g3', { name: 'New batch' })
    );
  });

  it('stops a learner creating a batch', async () => {
    await assertFails(write(await dbFor(ROLES.learner.uid), 'groups/g4', { name: 'Mine' }));
  });

  it('stops a moderator deleting a cohort — admin only', async () => {
    await assertFails(remove(await dbFor(ROLES.moderator.uid), 'groups/g1'));
    await assertSucceeds(remove(await dbFor(ROLES.admin.uid), 'groups/g1'));
  });
});

describe('tickets', () => {
  beforeEach(async () => {
    await seedDoc('tickets/t1', { userId: ROLES.learner.uid, subject: 'Help', status: 'open' });
  });

  it('lets a learner read their own ticket but not another learner one', async () => {
    await assertSucceeds(read(await dbFor(ROLES.learner.uid), 'tickets/t1'));
    await assertFails(read(await dbFor(ROLES.otherLearner.uid), 'tickets/t1'));
  });

  it('lets staff read any ticket', async () => {
    await assertSucceeds(read(await dbFor(ROLES.moderator.uid), 'tickets/t1'));
  });

  it('stops a learner opening a ticket in someone else name', async () => {
    await assertFails(
      write(await dbFor(ROLES.learner.uid), 'tickets/t2', {
        userId: ROLES.otherLearner.uid,
        subject: 'Forged',
        status: 'open',
      })
    );
  });

  it('stops a learner marking their own ticket resolved', async () => {
    await assertFails(patch(await dbFor(ROLES.learner.uid), 'tickets/t1', { status: 'resolved' }));
  });
});

describe('learner_submissions', () => {
  it('lets a learner record their own submission', async () => {
    await assertSucceeds(
      write(await dbFor(ROLES.learner.uid), 'learner_submissions/s1', {
        learnerId: ROLES.learner.uid,
        courseId: 'c1',
        isCorrect: true,
      })
    );
  });

  it('stops a learner writing a submission for someone else', async () => {
    await assertFails(
      write(await dbFor(ROLES.learner.uid), 'learner_submissions/s2', {
        learnerId: ROLES.otherLearner.uid,
        courseId: 'c1',
        isCorrect: true,
      })
    );
  });

  it('stops a learner reading another learner submission', async () => {
    await seedDoc('learner_submissions/s3', {
      learnerId: ROLES.otherLearner.uid,
      courseId: 'c1',
      isCorrect: true,
    });
    await assertFails(read(await dbFor(ROLES.learner.uid), 'learner_submissions/s3'));
    await assertSucceeds(read(await dbFor(ROLES.moderator.uid), 'learner_submissions/s3'));
  });
});

describe('attendance', () => {
  it('lets a learner mark themselves present, but not absent', async () => {
    const db = await dbFor(ROLES.learner.uid);
    await assertSucceeds(
      write(db, 'attendance/at1', {
        learnerId: ROLES.learner.uid,
        courseId: 'c1',
        date: '2026-05-10',
        status: 'present',
      })
    );
    await assertFails(
      write(db, 'attendance/at2', {
        learnerId: ROLES.learner.uid,
        courseId: 'c1',
        date: '2026-05-10',
        status: 'absent',
      })
    );
  });

  it('stops a learner marking attendance for someone else', async () => {
    await assertFails(
      write(await dbFor(ROLES.learner.uid), 'attendance/at3', {
        learnerId: ROLES.otherLearner.uid,
        courseId: 'c1',
        date: '2026-05-10',
        status: 'present',
      })
    );
  });

  it('lets staff record and delete attendance', async () => {
    const db = await dbFor(ROLES.moderator.uid);
    await assertSucceeds(
      write(db, 'attendance/at4', {
        learnerId: ROLES.learner.uid,
        courseId: 'c1',
        date: '2026-05-10',
        status: 'absent',
      })
    );
    await assertSucceeds(remove(db, 'attendance/at4'));
  });
});

describe('blocked accounts and guests', () => {
  it('stops a blocked learner reading course content', async () => {
    await seedDoc('courses/c1', { title: 'MBW' });
    await assertFails(read(await dbFor(ROLES.blocked.uid), 'courses/c1'));
  });

  it('stops a blocked learner submitting work', async () => {
    await assertFails(
      write(await dbFor(ROLES.blocked.uid), 'learner_submissions/s9', {
        learnerId: ROLES.blocked.uid,
        courseId: 'c1',
        isCorrect: true,
      })
    );
  });

  it('stops a guest account writing anything', async () => {
    await assertFails(
      write(await dbFor(ROLES.guest.uid), 'activities/g1', {
        userId: ROLES.guest.uid,
        type: 'resource_view',
      })
    );
  });
});

describe('bootstrap superadmin', () => {
  it('grants superadmin from the owner email even without a profile role', async () => {
    const db = await dbForEmail('bootstrap', 'ironladytech@gmail.com');
    await seedDoc('activities/b1', { userId: ROLES.learner.uid, type: 'resource_view' });
    await assertSucceeds(remove(db, 'activities/b1'));
  });

  it('does not grant it to a look-alike address', async () => {
    const db = await dbForEmail('impostor', 'ironladytech@gmail.com.attacker.com');
    await seedDoc('activities/b2', { userId: ROLES.learner.uid, type: 'resource_view' });
    await assertFails(remove(db, 'activities/b2'));
  });
});
