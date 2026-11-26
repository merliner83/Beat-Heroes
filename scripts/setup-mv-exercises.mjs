#!/usr/bin/env node
/**
 * Legt die MV-Übungen als learnApps an (learn-mv-<id>) und ordnet sie den
 * Kapiteln der Kurse zu. Idempotent.
 *
 *   node scripts/setup-mv-exercises.mjs            (Probelauf)
 *   node scripts/setup-mv-exercises.mjs --write
 *
 * Die Übungen selbst (Patterns, Steckbriefe) liegen im Code: src/lib/mv/.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const write = process.argv.includes('--write');
const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId: 'beat-heroes-ch' }));

const R = (id, name, description) => ({ id: `learn-mv-${id}`, type: 'mv-rhythm', exerciseId: id, name, description });
const K = (id, name, description) => ({ id: `learn-mv-${id}`, type: 'mv-keys', exerciseId: id, name, description });

const APPS = [
  R('puls-viertel', 'Der Puls: Viertel', 'Spür den Puls und zähl mit – die Grundlage jedes Beats.'),
  R('achtel', 'Achtel', 'Zwei Schläge pro Puls: «1 und 2 und …».'),
  R('offbeat', 'Offbeat', 'Genau zwischen den Schlägen – auf dem «und».'),
  R('backbeat', 'Backbeat', 'Snare auf 2 und 4: der Groove von Rock und Pop.'),
  R('four-on-the-floor', 'Four on the Floor', 'House-Kick auf jedem Schlag und die Hi-Hat auf dem Offbeat.'),
  R('boom-bap', 'Boom Bap', 'Der klassische Hip-Hop-Beat aus New York – mit Swing.'),
  R('trap', 'Trap', 'Halftime-Clap und schnelle Hi-Hat-Rolls.'),
  R('dembow', 'Dembow', 'Der Reggaeton-Groove mit Tresillo-Gefühl.'),
  R('one-drop', 'One Drop', 'Reggae: Die 1 bleibt leer, alles fällt auf die 3.'),
  R('son-clave', 'Son-Clave 3-2', 'Die Clave aus Kuba – das Herz der Salsa.'),
  R('rumba-clave', 'Rumba-Clave 3-2', 'Die drängendere Schwester der Son-Clave.'),
  R('bossa-nova', 'Bossa Nova', 'Sanfter Groove aus Rio mit Clave-Figur.'),
  R('swing', 'Swing', 'Jazz-Ride «ding, ding-ga ding» in Triolen.'),
  R('walzer', 'Walzer', 'Dreiertakt «Um – pa – pa».'),
  R('laendler', 'Ländler', 'Schweizer Volksmusik im flotten Dreiertakt.'),
  R('marsch', 'Marsch', 'Zweiertakt der Blasmusik: links – rechts.'),
  K('notennamen', 'Notennamen finden', 'Finde C, D, E … auf der Klaviatur.'),
  K('intervalle', 'Intervalle hören', 'Erkenne Sekunde, Terz, Quarte, Quinte und Oktave – mit Merksongs.'),
  K('tonleiter-dur', 'Dur-Tonleitern bauen', 'Bau Dur-Tonleitern nach dem Bauplan Ganz – Ganz – Halb – Ganz – Ganz – Ganz – Halb.'),
  K('tonleiter-moll', 'Moll-Tonleitern bauen', 'Bau Moll-Tonleitern nach dem Bauplan Ganz – Halb – Ganz – Ganz – Halb – Ganz – Ganz.'),
  K('dur-moll', 'Dur oder Moll?', 'Hör den Dreiklang und entscheide: hell oder dunkel?'),
];

// Kapitel-Zuordnung: courseId → chapterId → App-IDs (zusätzlich zu bestehenden)
const MAP = {
  mv: {
    'mv-rhythmus': ['learn-mv-puls-viertel', 'learn-mv-achtel', 'learn-mv-offbeat', 'learn-mv-backbeat', 'learn-mv-four-on-the-floor'],
    'mv-grooves': ['learn-mv-boom-bap', 'learn-mv-trap', 'learn-mv-dembow', 'learn-mv-one-drop', 'learn-mv-son-clave', 'learn-mv-rumba-clave', 'learn-mv-bossa-nova', 'learn-mv-swing', 'learn-mv-walzer', 'learn-mv-laendler', 'learn-mv-marsch'],
    'mv-toene': ['learn-mv-notennamen'],
    'mv-intervalle': ['learn-mv-intervalle'],
    'mv-tonleitern': ['learn-mv-tonleiter-dur', 'learn-mv-tonleiter-moll'],
    'mv-akkorde': ['learn-mv-dur-moll'],
    'mv-gehoer': ['learn-mv-intervalle', 'learn-mv-dur-moll'],
  },
  producing: {
    composing: ['learn-mv-boom-bap', 'learn-mv-trap', 'learn-mv-four-on-the-floor'],
  },
};

const GROOVES_CHAPTER = {
  id: 'mv-grooves', title: 'Grooves der Welt', order: 15, iconName: 'Disc', colorClass: 'text-brand',
  description: 'Von Boom Bap und Trap über Clave und Bossa Nova bis Walzer, Ländler und Marsch – anhören und mitklopfen.',
  appIds: [],
};

for (const a of APPS) {
  console.log(write ? 'App:' : 'würde App anlegen:', a.id);
  if (write) await db.doc(`learnApps/${a.id}`).set({ name: a.name, type: a.type, exerciseId: a.exerciseId, description: a.description, maxPoints: 150 }, { merge: true });
}

for (const [courseId, chapters] of Object.entries(MAP)) {
  const ref = db.doc(`courses/${courseId}`);
  const course = (await ref.get()).data();
  if (!course) { console.log('Kurs fehlt:', courseId); continue; }
  let list = course.chapters ?? [];
  if (courseId === 'mv' && !list.some((c) => c.id === 'mv-grooves')) list = [...list, GROOVES_CHAPTER];
  if (courseId === 'mv') list = list.map((ch) => (ch.id === 'mv-grooves' ? { ...ch, description: GROOVES_CHAPTER.description } : ch));
  list = list.map((ch) => chapters[ch.id] ? { ...ch, appIds: [...new Set([...(ch.appIds ?? []), ...chapters[ch.id]])] } : ch);
  console.log(write ? 'Kurs aktualisiert:' : 'würde Kurs aktualisieren:', courseId);
  if (write) await ref.set({ chapters: list }, { merge: true });
}
console.log(write ? 'Fertig.' : 'Probelauf – mit --write ausführen.');
