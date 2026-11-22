#!/usr/bin/env node
/**
 * Kopiert die Lerninhalte vom alten US-Projekt ins EU-Projekt.
 *
 *   node scripts/migrate-from-studio.mjs              (Probelauf, schreibt nichts)
 *   node scripts/migrate-from-studio.mjs --write      (schreibt ins Zielprojekt)
 *   node scripts/migrate-from-studio.mjs --write --rewrite-storage
 *        (ersetzt zusätzlich Storage-URLs alter Bucket → neuer Bucket;
 *         erst nach dem Kopieren der Dateien verwenden)
 *
 * Zugangsdaten: gcloud auth application-default login
 *
 * - Nutzer:innen werden NICHT kopiert (neues Auth-Projekt, neue UIDs).
 * - minRole: free → entfernt, pro/producer → teacher, admin → superAdmin.
 * - Quiz-Lösungen (correctOption) wandern nach learnQuizKeys/{id}.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const SOURCE = 'studio-7081808686-cc62f';
const TARGET = 'beat-heroes-ch';
const OLD_BUCKET = `${SOURCE}.firebasestorage.app`;
const NEW_BUCKET = `${TARGET}.firebasestorage.app`;

const COLLECTIONS = [
  'studios', 'tracks', 'games', 'learnApps', 'levels', 'patterns',
  'learnCategories', 'learnSubCats', 'articles', 'learnQuizzes',
];
const SUBCOLLECTIONS = { levels: ['sounds'] };
const ROLE_MAP = { pro: 'teacher', producer: 'teacher', admin: 'superAdmin' };

const write = process.argv.includes('--write');
const rewriteStorage = process.argv.includes('--rewrite-storage');

const src = getFirestore(initializeApp({ credential: applicationDefault(), projectId: SOURCE }, 'src'));
const dst = getFirestore(initializeApp({ credential: applicationDefault(), projectId: TARGET }, 'dst'));

function rewrite(value) {
  if (typeof value === 'string') {
    return rewriteStorage ? value.split(OLD_BUCKET).join(NEW_BUCKET) : value;
  }
  if (Array.isArray(value)) return value.map(rewrite);
  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v)]));
  }
  return value; // Timestamps, GeoPoints usw. unverändert
}

function transform(col, data) {
  const out = rewrite({ ...data });
  if ('minRole' in out) {
    const mapped = ROLE_MAP[out.minRole];
    if (mapped) out.minRole = mapped;
    else delete out.minRole;
  }
  let quizKey = null;
  if (col === 'learnQuizzes' && Array.isArray(out.questions)) {
    quizKey = { answers: out.questions.map((q) => q.correctOption ?? null) };
    out.questions = out.questions.map(({ correctOption, ...q }) => q);
  }
  return { out, quizKey };
}

let batch = dst.batch();
let pending = 0;
const stats = {};

async function put(ref, data) {
  stats[ref.parent.id] = (stats[ref.parent.id] ?? 0) + 1;
  if (!write) return;
  batch.set(ref, data);
  if (++pending >= 400) {
    await batch.commit();
    batch = dst.batch();
    pending = 0;
  }
}

async function copyCollection(srcCol, dstCol, name) {
  const snap = await srcCol.get();
  for (const doc of snap.docs) {
    const { out, quizKey } = transform(name, doc.data());
    await put(dstCol.doc(doc.id), out);
    if (quizKey) await put(dst.collection('learnQuizKeys').doc(doc.id), quizKey);
    for (const sub of SUBCOLLECTIONS[name] ?? []) {
      await copyCollection(doc.ref.collection(sub), dstCol.doc(doc.id).collection(sub), sub);
    }
  }
}

for (const name of COLLECTIONS) {
  await copyCollection(src.collection(name), dst.collection(name), name);
}
if (write && pending > 0) await batch.commit();

console.log(write ? 'Geschrieben:' : 'Probelauf (nichts geschrieben):');
console.table(stats);
if (!rewriteStorage) console.log(`Storage-URLs zeigen weiterhin auf ${OLD_BUCKET}.`);
