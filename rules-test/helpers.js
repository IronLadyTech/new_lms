import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import fs from 'node:fs';

export { assertFails, assertSucceeds };

export const PROJECT_ID = 'lmsironlady-rules-test';

let testEnv;

export async function getTestEnv() {
  if (testEnv) return testEnv;
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
  return testEnv;
}

export async function cleanup() {
  if (testEnv) {
    await testEnv.cleanup();
    testEnv = null;
  }
}

export async function clearData() {
  const env = await getTestEnv();
  await env.clearFirestore();
}

/**
 * Seed a users/ profile with security rules bypassed.
 *
 * Almost every rule reads the caller's role from their profile document, so the
 * profiles have to exist before any assertion is meaningful.
 */
export async function seedProfile(uid, data) {
  const env = await getTestEnv();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', uid), {
      email: `${uid}@example.com`,
      displayName: uid,
      blocked: false,
      ...data,
    });
  });
}

/** Seed an arbitrary document with rules bypassed, to test reads against it. */
export async function seedDoc(path, data) {
  const env = await getTestEnv();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), ...path.split('/')), data);
  });
}

export async function dbFor(uid) {
  const env = await getTestEnv();
  return uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();
}

/** Signed in with an email claim — used for the bootstrap superadmin path. */
export async function dbForEmail(uid, email) {
  const env = await getTestEnv();
  return env.authenticatedContext(uid, { email }).firestore();
}

export const read = (db, path) => getDoc(doc(db, ...path.split('/')));
export const write = (db, path, data) => setDoc(doc(db, ...path.split('/')), data);
export const patch = (db, path, data) => updateDoc(doc(db, ...path.split('/')), data);
export const remove = (db, path) => deleteDoc(doc(db, ...path.split('/')));

/** The four roles every collection is tested against. */
export const ROLES = {
  learner: { uid: 'learner1', role: 'student' },
  otherLearner: { uid: 'learner2', role: 'student' },
  moderator: { uid: 'mod1', role: 'moderator' },
  admin: { uid: 'admin1', role: 'admin' },
  superadmin: { uid: 'super1', role: 'superadmin' },
  guest: { uid: 'guest1', role: 'guest' },
  blocked: { uid: 'blocked1', role: 'student', blocked: true },
};

export async function seedAllRoles() {
  for (const { uid, ...data } of Object.values(ROLES)) {
    await seedProfile(uid, data);
  }
}
