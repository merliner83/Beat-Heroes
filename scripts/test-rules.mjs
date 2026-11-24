/**
 * Prüft zentrale Firestore-Regeln im Emulator (Mehrfach-Schulen).
 *   firebase emulators:exec --only firestore --project demo-beat-heroes "node scripts/test-rules.mjs"
 */
import { initializeApp as initAdmin } from 'firebase-admin/app';
import { getFirestore as adminFs } from 'firebase-admin/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getFirestore, connectFirestoreEmulator, collection, query, where, orderBy, getDocs, getDoc, doc, setDoc, updateDoc,
} from 'firebase/firestore';

const PROJECT = 'demo-beat-heroes';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
initAdmin({ projectId: PROJECT });
const db = adminFs();

const A = 'schule-a', B = 'schule-b', C = 'schule-c';
await db.doc(`schools/${A}`).set({ name: 'A' });
await db.doc(`schools/${B}`).set({ name: 'B' });
await db.doc('users/t1').set({ uid: 't1', role: 'teacher', schoolIds: [A] });
await db.doc('users/t2').set({ uid: 't2', role: 'teacher', schoolIds: [C] });
await db.doc('users/sa').set({ uid: 'sa', role: 'schoolAdmin', schoolIds: [B] });
await db.doc('users/s1').set({ uid: 's1', role: 'student', schoolIds: [B, A], schoolId: B, classIds: ['k1'], email: 'x' });
await db.doc('users/s2').set({ uid: 's2', role: 'student', schoolId: A, classIds: [] });
await db.doc('standings/s1').set({ uid: 's1', schoolIds: [B, A], streetCred: 5 });
await db.doc('profileDrafts/s1').set({ uid: 's1', schoolIds: [B, A], status: 'submitted' });
await db.doc('achievements/s1_p').set({ uid: 's1', schoolIds: [B, A], classIds: ['k1'] });

let fails = 0;
let n = 0;
async function as(uid, label, fn, expectOk) {
  const app = initializeApp({ projectId: PROJECT }, `app${n++}`);
  const fs = getFirestore(app);
  connectFirestoreEmulator(fs, host, Number(port), { mockUserToken: { user_id: uid, sub: uid } });
  let ok = true;
  try { await fn(fs); } catch (e) { ok = false; if (expectOk) console.log('   ', e.code); }
  const pass = ok === expectOk;
  if (!pass) fails++;
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${label} (${ok ? 'erlaubt' : 'verweigert'})`);
  await deleteApp(app);
}

await as('t1', 'Lehrperson A listet Personen der Schule A', (fs) => getDocs(query(collection(fs, 'users'), where('schoolIds', 'array-contains', A))), true);
await as('t1', 'Lehrperson A listet Personen der Schule B', (fs) => getDocs(query(collection(fs, 'users'), where('schoolIds', 'array-contains', B))), false);
await as('t1', 'Lehrperson A liest s1 (A+B)', (fs) => getDoc(doc(fs, 'users/s1')), true);
await as('t1', 'Lehrperson A liest s2 (altes schoolId=A)', (fs) => getDoc(doc(fs, 'users/s2')), true);
await as('t2', 'Lehrperson C liest s1', (fs) => getDoc(doc(fs, 'users/s1')), false);
await as('t1', 'Lehrperson A liest Fortschritt von s1', (fs) => getDocs(collection(fs, 'users/s1/progress')), true);
await as('s2', 'Schüler:in A: Rangliste A', (fs) => getDocs(query(collection(fs, 'standings'), where('schoolIds', 'array-contains', A), orderBy('streetCred', 'desc'))), true);
await as('s2', 'Schüler:in A: Rangliste B', (fs) => getDocs(query(collection(fs, 'standings'), where('schoolIds', 'array-contains', B))), false);
await as('t1', 'Lehrperson A: eingereichte Profile A', (fs) => getDocs(query(collection(fs, 'profileDrafts'), where('schoolIds', 'array-contains', A), where('status', '==', 'submitted'))), true);
await as('t2', 'Lehrperson C: eingereichte Profile A', (fs) => getDocs(query(collection(fs, 'profileDrafts'), where('schoolIds', 'array-contains', A))), false);
await as('t1', 'Lehrperson A: Abschlüsse A', (fs) => getDocs(query(collection(fs, 'achievements'), where('schoolIds', 'array-contains', A))), true);
await as('s1', 'Schüler:in: eigene Abschlüsse', (fs) => getDocs(query(collection(fs, 'achievements'), where('uid', '==', 's1'))), true);
await as('s1', 'Schüler:in setzt eigene schoolIds', (fs) => updateDoc(doc(fs, 'users/s1'), { schoolIds: [A, B, C] }), false);
await as('s1', 'Entwurf mit korrekten schoolIds', (fs) => setDoc(doc(fs, 'profileDrafts/s1'), {
  uid: 's1', schoolIds: [B, A], status: 'draft', artistName: 'X', handle: 'xyz', bio: '', roles: [], genres: [],
  embeds: ['https://youtu.be/aaaaaaaaaaa'], links: [], accentColor: '#ff3399', featuredUrl: 'https://youtu.be/aaaaaaaaaaa',
}), true);
await as('s1', 'Entwurf mit fremder Schule', (fs) => setDoc(doc(fs, 'profileDrafts/s1'), {
  uid: 's1', schoolIds: [C], status: 'draft', artistName: 'X', handle: 'xyz', bio: '', roles: [], genres: [], embeds: [], links: [],
}), false);
await as('s1', 'Entwurf mit ungültiger Farbe', (fs) => setDoc(doc(fs, 'profileDrafts/s1'), {
  uid: 's1', schoolIds: [B, A], status: 'draft', artistName: 'X', handle: 'xyz', bio: '', roles: [], genres: [], embeds: [], links: [], accentColor: 'red',
}), false);
await as('nobody', 'Schulen öffentlich lesbar', (fs) => getDocs(collection(fs, 'schools')), true);
await as('sa', 'Schul-Admin B ändert Logo B', (fs) => updateDoc(doc(fs, `schools/${B}`), { logoUrl: 'https://x/y.png' }), true);
await as('sa', 'Schul-Admin B ändert Schule A', (fs) => updateDoc(doc(fs, `schools/${A}`), { logoUrl: 'https://x/y.png' }), false);
await as('t1', 'Lehrperson ändert Schule A', (fs) => updateDoc(doc(fs, `schools/${A}`), { name: 'Z' }), false);

console.log(fails ? `\n${fails} Fehler` : '\nAlle Regeln wie erwartet.');
process.exit(fails ? 1 : 0);
