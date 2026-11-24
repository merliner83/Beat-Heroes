#!/usr/bin/env node
/**
 * Ergänzt schoolIds[] (Mehrfach-Schulen) aus dem alten Einzelfeld schoolId
 * in users, standings, profiles, profileDrafts, achievements, creditEvents.
 * Idempotent; Dokumente mit schoolIds bleiben unverändert.
 *
 *   node scripts/migrate-school-ids.mjs [--dry]
 *
 * Zugangsdaten: gcloud auth application-default login
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const dry = process.argv.includes('--dry');
const app = initializeApp({ credential: applicationDefault(), projectId: process.env.PROJECT ?? 'beat-heroes-ch' });
const db = getFirestore(app);

const users = new Map((await db.collection('users').get()).docs.map((d) => [d.id, d.data()]));
const schoolsOfUser = (uid, fallback) => {
  const u = users.get(uid);
  if (Array.isArray(u?.schoolIds)) return u.schoolIds;
  const s = u?.schoolId ?? fallback ?? null;
  return s ? [s] : [];
};

for (const col of ['users', 'standings', 'profiles', 'profileDrafts', 'achievements', 'creditEvents']) {
  const snap = await db.collection(col).get();
  let changed = 0;
  let batch = db.batch();
  let inBatch = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (Array.isArray(data.schoolIds)) continue;
    const uid = col === 'users' || col === 'standings' || col === 'profiles' || col === 'profileDrafts' ? d.id : data.uid;
    const schoolIds = col === 'creditEvents'
      ? (data.schoolId ? [data.schoolId] : [])
      : schoolsOfUser(uid, data.schoolId);
    changed++;
    if (dry) continue;
    batch.update(d.ref, { schoolIds });
    if (++inBatch === 400) { await batch.commit(); batch = db.batch(); inBatch = 0; }
  }
  if (!dry && inBatch) await batch.commit();
  console.log(`${col}: ${changed} von ${snap.size} ${dry ? 'würden ergänzt' : 'ergänzt'}`);
}
