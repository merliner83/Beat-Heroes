#!/usr/bin/env node
/**
 * Setzt Rolle (und optional Schule) einer Person im EU-Projekt.
 *
 *   node scripts/set-role.mjs <email> <student|teacher|schoolAdmin|superAdmin> [schoolId]
 *
 * Die Person muss sich vorher einmal in der App angemeldet haben.
 * Zugangsdaten: gcloud auth application-default login
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const ROLES = ['student', 'teacher', 'schoolAdmin', 'superAdmin'];
const [email, role, schoolId] = process.argv.slice(2);

if (!email || !ROLES.includes(role)) {
  console.error('Aufruf: node scripts/set-role.mjs <email> <' + ROLES.join('|') + '> [schoolId]');
  process.exit(1);
}

const app = initializeApp({ credential: applicationDefault(), projectId: 'beat-heroes-ch' });
const user = await getAuth(app).getUserByEmail(email);
const db = getFirestore(app);

const update = { role, updatedAt: FieldValue.serverTimestamp() };
if (schoolId) update.schoolId = schoolId;
await db.doc(`users/${user.uid}`).set(update, { merge: true });
if (schoolId) {
  const profile = (await db.doc(`users/${user.uid}`).get()).data() ?? {};
  await db.doc(`standings/${user.uid}`).set({
    uid: user.uid,
    displayName: profile.displayName ?? 'Producer',
    schoolId,
    streetCred: profile.streetCred ?? 0,
  }, { merge: true });
}
console.log(`${email} (${user.uid}) → ${role}${schoolId ? `, Schule ${schoolId}` : ''}`);
