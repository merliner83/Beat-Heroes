#!/usr/bin/env node
/**
 * Setzt Rolle (und optional Schulen) einer Person im EU-Projekt.
 *
 *   node scripts/set-role.mjs <email> <student|teacher|schoolAdmin|superAdmin> [schoolId,schoolId2]
 *
 * Schulen ersetzen die bisherigen; Profil/Entwurf/Abschlüsse gleicht
 * die Admin-Seite (Personen) ab, dieses Skript nur users + standings.
 *
 * Die Person muss sich vorher einmal in der App angemeldet haben.
 * Zugangsdaten: gcloud auth application-default login
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const ROLES = ['student', 'teacher', 'schoolAdmin', 'superAdmin'];
const [email, role, schoolArg] = process.argv.slice(2);
const schoolIds = schoolArg ? schoolArg.split(',').map((s) => s.trim()).filter(Boolean) : null;

if (!email || !ROLES.includes(role)) {
  console.error('Aufruf: node scripts/set-role.mjs <email> <' + ROLES.join('|') + '> [schoolId,schoolId2]');
  process.exit(1);
}

const app = initializeApp({ credential: applicationDefault(), projectId: 'beat-heroes-ch' });
const user = await getAuth(app).getUserByEmail(email);
const db = getFirestore(app);

const update = { role, updatedAt: FieldValue.serverTimestamp() };
if (schoolIds) Object.assign(update, { schoolIds, schoolId: schoolIds[0] ?? null });
await db.doc(`users/${user.uid}`).set(update, { merge: true });
if (schoolIds) {
  const profile = (await db.doc(`users/${user.uid}`).get()).data() ?? {};
  await db.doc(`standings/${user.uid}`).set({
    uid: user.uid,
    displayName: profile.displayName ?? 'Producer',
    schoolIds,
    schoolId: schoolIds[0] ?? null,
    streetCred: profile.streetCred ?? 0,
  }, { merge: true });
}
console.log(`${email} (${user.uid}) → ${role}${schoolIds ? `, Schulen ${schoolIds.join(', ')}` : ''}`);
