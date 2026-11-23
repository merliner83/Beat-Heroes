#!/usr/bin/env node
/**
 * Legt die Kurse an und ordnet bestehende Lektionen (articles) zu.
 *
 *   node scripts/setup-courses.mjs            (Probelauf)
 *   node scripts/setup-courses.mjs --write
 *
 * - Kurs «producing»: Kapitel = bisherige learnCategories (gleiche IDs),
 *   jede Lektion bekommt courseId 'producing' und chapterId = categoryId.
 * - Kurs «mv» (Musikverstehen): Vorschlag für Kapitel, noch ohne Lektionen.
 * Idempotent: bestehende Kapitel-Texte im Kurs-Dokument werden überschrieben,
 * Lektionen nur ergänzt (merge).
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const write = process.argv.includes('--write');
const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId: 'beat-heroes-ch' }));

// Lern-Apps den Kapiteln zuordnen
const PRODUCING_APPS = { effects: ['learn-ear-training'] };

const MV_CHAPTERS = [
  { id: 'mv-rhythmus', title: 'Rhythmus & Puls', description: 'Puls, Takt, Notenwerte, BPM, Grooves und Synkopen.', iconName: 'Target', colorClass: 'text-[#FFEA00]', appIds: ['learn-rhythm-trainer'] },
  { id: 'mv-toene', title: 'Töne & Noten', description: 'Tonhöhe, Notennamen, Klaviatur und Notenschrift lesen.', iconName: 'Music', colorClass: 'text-[#00E676]' },
  { id: 'mv-intervalle', title: 'Intervalle', description: 'Abstände zwischen Tönen erkennen, benennen und hören.', iconName: 'Headphones', colorClass: 'text-[#00FFFF]' },
  { id: 'mv-tonleitern', title: 'Tonleitern & Tonarten', description: 'Dur, Moll, Pentatonik, Quintenzirkel und Tonarten im Beat.', iconName: 'Sparkles', colorClass: 'text-[#3838FA]' },
  { id: 'mv-akkorde', title: 'Akkorde & Harmonie', description: 'Dreiklänge, Septakkorde, Kadenzen und typische Progressions.', iconName: 'Disc', colorClass: 'text-[#EB3D99]' },
  { id: 'mv-melodie', title: 'Melodie & Hooks', description: 'Motive, Melodiebau, Call & Response und eingängige Hooks.', iconName: 'Mic2', colorClass: 'text-[#FF3D00]' },
  { id: 'mv-form', title: 'Form & Arrangement', description: 'Intro, Verse, Hook, Bridge, Drops – Songs aufbauen.', iconName: 'Share2', colorClass: 'text-primary' },
  { id: 'mv-gehoer', title: 'Gehörbildung', description: 'Intervalle, Akkordtypen und Rhythmen nach Gehör erkennen.', iconName: 'Headphones', colorClass: 'text-[#00E676]' },
].map((c, i) => ({ ...c, order: (i + 1) * 10 }));

const cats = (await db.collection('learnCategories').get()).docs
  .map((d) => ({ id: d.id, ...d.data() }))
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

const producing = {
  title: 'Producing',
  subtitle: 'Vom ersten Beat bis zum Release',
  description: 'DAWs, Recording, Effekte, DJing, Release und Rechte – alles für deine eigenen Tracks.',
  order: 10,
  color: '#FF3399',
  iconName: 'Disc',
  chapters: cats.map((c) => ({
    id: c.id,
    title: c.title,
    order: c.order ?? 0,
    iconName: c.iconName ?? 'BookOpen',
    colorClass: c.colorClass ?? 'text-primary',
    appIds: PRODUCING_APPS[c.id] ?? [],
  })),
};

const mv = {
  title: 'MV – Musikverstehen',
  subtitle: 'Theorie, die du hörst und spielst',
  description: 'Rhythmus, Töne, Harmonie und Form – spielerisch mit Übungen und Minigames.',
  order: 20,
  color: '#00E676',
  iconName: 'Music',
  chapters: MV_CHAPTERS,
};

const articles = (await db.collection('articles').get()).docs;
const updates = articles.filter((d) => d.data().courseId !== 'producing' || d.data().chapterId !== d.data().categoryId);

console.log(`Producing: ${producing.chapters.length} Kapitel, MV: ${mv.chapters.length} Kapitel`);
console.log(`Lektionen zuzuordnen: ${updates.length} von ${articles.length}`);

if (write) {
  const batch = db.batch();
  batch.set(db.doc('courses/producing'), producing);
  batch.set(db.doc('courses/mv'), mv);
  for (const d of updates) {
    batch.set(d.ref, { courseId: 'producing', chapterId: d.data().categoryId }, { merge: true });
  }
  await batch.commit();
  console.log('Geschrieben.');
} else {
  console.log('Probelauf – mit --write ausführen.');
}
