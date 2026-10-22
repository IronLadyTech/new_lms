import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, listAll, deleteObject } from 'firebase/storage';
import fs from 'node:fs';

const readEnv = (f) =>
  Object.fromEntries(
    fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
  );
const cfg = readEnv('.env');
const a = readEnv('e2e/.auth.local');
const app = initializeApp({
  apiKey: cfg.VITE_FIREBASE_API_KEY, authDomain: cfg.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: cfg.VITE_FIREBASE_PROJECT_ID, storageBucket: cfg.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: cfg.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: cfg.VITE_FIREBASE_APP_ID,
});
await signInWithEmailAndPassword(getAuth(app), a.STAFF_EMAIL, a.STAFF_PASSWORD);
const db = getFirestore(app);
const storage = getStorage(app);

/* Internal and test accounts only. The six real learners are named here so the
   list is explicit rather than implied by whatever is left over. */
const PURGE = new Set([
  'yaswanthgrandhi2580@gmail.com',
  'ironladytech@gmail.com',
  'yaswanthgrandhi47@gmail.com',
  'Gandhi@iamironlady.com',
  'sunitha.ironlady@gmail.com',
  'yaswanth@iamironlady.com',
  'yaswanth2@gmail.com',
  'yaswanth1@gmail.com',
  'suvarna@iamironlady.com',
].map((e) => e.toLowerCase()));

const KEEP = new Set([
  'suprajakattala@gmail.com', 'blessedlatha9@gmail.com', 'kumar21happysole@gmail.com',
  'sushmithasushmi1306@gmail.com', 'meghanasn363@gmail.com', 'kundu.meenakshi@gmail.com',
].map((e) => e.toLowerCase()));

const users = new Map();
(await getDocs(collection(db, 'users'))).docs.forEach((d) => users.set(d.id, (d.data().email || '').toLowerCase()));

const purgeUids = new Set([...users.entries()].filter(([, e]) => PURGE.has(e)).map(([uid]) => uid));
console.log('accounts to clear:', purgeUids.size, '| protected learners:', KEEP.size, '\n');

let removed = 0;
let kept = 0;
for (const col of ['mbw_submissions', 'bm100_submissions', 'lep_submissions']) {
  const snap = await getDocs(collection(db, col));
  let r = 0;
  let k = 0;
  for (const d of snap.docs) {
    const email = users.get(d.data().userId) || '';
    if (purgeUids.has(d.data().userId)) {
      await deleteDoc(doc(db, col, d.id));
      r += 1;
    } else {
      if (KEEP.has(email)) k += 1;
      else console.log(`  kept (unlisted): ${col}/${d.id} -> ${email || d.data().userId}`);
      k += 0;
    }
  }
  removed += r;
  kept += snap.size - r;
  console.log(`${col}: removed ${r}, kept ${snap.size - r}`);
}

console.log('\nfiles:');
for (const prefix of ['mbw', 'bm100', 'lep']) {
  for (const uid of purgeUids) {
    const stack = [ref(storage, `${prefix}/${uid}`)];
    while (stack.length) {
      const cur = stack.pop();
      let res;
      try { res = await listAll(cur); } catch { continue; }
      stack.push(...res.prefixes);
      for (const item of res.items) {
        try { await deleteObject(item); console.log('  deleted', item.fullPath); }
        catch (e) { console.log('  COULD NOT delete', item.fullPath, '->', e.code || e.message); }
      }
    }
  }
}

console.log(`\ntotal submissions removed: ${removed}, kept: ${kept}`);
process.exit(0);
