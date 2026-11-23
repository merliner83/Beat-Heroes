#!/usr/bin/env node
/**
 * Legt Entwurfs-Lektionen für den MV-Kurs an (nur für Lehrpersonen sichtbar,
 * minRole 'teacher'). Bestehende Lektionen mit gleicher ID werden NICHT
 * überschrieben.
 *
 *   node scripts/seed-mv-drafts.mjs            (Probelauf)
 *   node scripts/seed-mv-drafts.mjs --write
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const write = process.argv.includes('--write');
const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId: 'beat-heroes-ch' }));

const LESSONS = [
  {
    id: 'art-mv-puls-takt-bpm',
    chapterId: 'mv-rhythmus',
    order: 10,
    title: 'Puls, Takt und BPM',
    content: `# Puls, Takt und BPM

Jeder Beat steht auf einem unsichtbaren Fundament: dem **Puls**. Das ist der gleichmässige Schlag, zu dem du automatisch mit dem Kopf nickst oder mit dem Fuss tippst.

## Tempo in BPM

Wie schnell der Puls ist, messen wir in **BPM** (Beats per Minute, Schläge pro Minute). 60 BPM heisst: ein Schlag pro Sekunde. Typische Tempi:

**Boom Bap:** etwa 85–95 BPM
**Trap:** etwa 130–150 BPM (fühlt sich oft halb so schnell an)
**House:** etwa 120–128 BPM

## Der 4/4-Takt

Die meisten Songs sind im **4/4-Takt**: Vier Schläge bilden einen Takt. Du zählst «1 – 2 – 3 – 4», dann beginnt der nächste Takt wieder bei 1. Die **1** ist der stärkste Schlag – hier landet oft die Kick.

### Typisches Muster

Kick auf **1** und **3**, Snare oder Clap auf **2** und **4**. Genau dieses Muster steckt in unzähligen Hip-Hop-Beats.

---

## Probier es aus

GAME: learn-rhythm-trainer | Rhythmus Master: Patterns nachklopfen

Zähl beim Üben laut mit. Wenn du den Puls spürst, wird jedes Pattern einfacher.`,
    quiz: [
      { question: 'Was bedeutet 90 BPM?', options: ['90 Takte pro Minute', '90 Schläge pro Minute', '90 Sekunden pro Takt', '90 Noten pro Takt'], correctOption: 1 },
      { question: 'Wie viele Schläge hat ein Takt im 4/4-Takt?', options: ['2', '3', '4', '8'], correctOption: 2 },
      { question: 'Wo liegt im typischen Hip-Hop-Beat die Snare?', options: ['Auf 1 und 3', 'Auf 2 und 4', 'Nur auf 1', 'Auf jedem Schlag'], correctOption: 1 },
    ],
  },
  {
    id: 'art-mv-notenwerte',
    chapterId: 'mv-rhythmus',
    order: 20,
    title: 'Notenwerte: von der Ganzen bis zur Sechzehntel',
    content: `# Notenwerte

Notenwerte sagen dir, **wie lange** ein Ton dauert. Sie sind immer Teilungen eines Takts.

## Die wichtigsten Werte im 4/4-Takt

**Ganze Note:** dauert den ganzen Takt (4 Schläge)
**Halbe Note:** 2 Schläge – zwei passen in einen Takt
**Viertelnote:** 1 Schlag – vier pro Takt, das ist der Puls
**Achtelnote:** ein halber Schlag – acht pro Takt («1 und 2 und …»)
**Sechzehntelnote:** ein Viertel-Schlag – sechzehn pro Takt («1 e und e 2 e und e …»)

## Notenwerte im Step-Sequencer

Ein Drum-Sequencer mit **16 Steps** zeigt genau einen Takt in Sechzehnteln. Step 1, 5, 9 und 13 sind die vier Viertel – also der Puls. Hi-Hats auf jedem zweiten Step sind Achtel, Hi-Hats auf jedem Step sind Sechzehntel.

### Tipp

Schnelle Trap-Hi-Hats arbeiten oft mit Sechzehnteln und noch kleineren Werten (Zweiunddreissigstel, Triolen) – das sind die typischen «Rolls».`,
    quiz: [
      { question: 'Wie viele Achtelnoten passen in einen 4/4-Takt?', options: ['4', '6', '8', '16'], correctOption: 2 },
      { question: 'Ein 16-Step-Sequencer zeigt einen Takt in …', options: ['Vierteln', 'Achteln', 'Sechzehnteln', 'Halben'], correctOption: 2 },
      { question: 'Welche Steps sind im 16-Step-Raster die vier Viertel?', options: ['1, 2, 3, 4', '1, 5, 9, 13', '4, 8, 12, 16', '1, 3, 5, 7'], correctOption: 1 },
    ],
  },
  {
    id: 'art-mv-offbeat-synkopen',
    chapterId: 'mv-rhythmus',
    order: 30,
    title: 'Offbeats, Synkopen und Swing',
    content: `# Offbeats, Synkopen und Swing

Ein Beat wird erst spannend, wenn nicht alles auf den Hauptschlägen passiert.

## Offbeat

Der **Offbeat** liegt genau zwischen zwei Schlägen – auf dem «und». Offbeat-Hi-Hats («1 **und** 2 **und** …») sind typisch für House und Reggae.

## Synkope

Eine **Synkope** betont eine Stelle, die normalerweise schwach ist – zum Beispiel eine Kick kurz vor der 3 statt auf der 3. Dadurch entsteht Groove und Vorwärtsdrang. Viele Hip-Hop-Kicks sind synkopiert.

## Swing

Beim **Swing** werden die Achtel oder Sechzehntel nicht exakt gleich lang gespielt: die erste etwas länger, die zweite etwas kürzer. In der DAW heisst das oft «Swing» oder «Groove» (z.B. MPC-Swing). Schon 55–60 % Swing machen einen steifen Beat lebendiger.

---

### Hör-Aufgabe

Nimm einen Lieblingssong und klopf mit: Wo landen Kick und Snare genau auf dem Schlag, wo knapp daneben?`,
    quiz: [
      { question: 'Wo liegt der Offbeat?', options: ['Auf der 1', 'Zwischen zwei Schlägen («und»)', 'Auf der 4', 'Am Ende des Songs'], correctOption: 1 },
      { question: 'Was ist eine Synkope?', options: ['Eine sehr laute Note', 'Eine Betonung auf einer normalerweise schwachen Stelle', 'Ein Taktwechsel', 'Eine Pause von einem Takt'], correctOption: 1 },
      { question: 'Was bewirkt Swing?', options: ['Alles wird schneller', 'Gleich lange Noten werden ungleich lang gespielt', 'Die Tonhöhe ändert sich', 'Der Beat wird leiser'], correctOption: 1 },
    ],
  },
  {
    id: 'art-mv-klaviatur-notennamen',
    chapterId: 'mv-toene',
    order: 10,
    title: 'Die Klaviatur und die Notennamen',
    content: `# Die Klaviatur und die Notennamen

Ob Keyboard, Piano-Roll in der DAW oder MIDI-Controller: Fast alles Melodische baut auf der **Klaviatur** auf.

## Weisse Tasten

Die weissen Tasten heissen **C – D – E – F – G – A – H**, dann beginnt es wieder bei C. Den Ton C findest du immer links von einer Zweiergruppe schwarzer Tasten.

### Achtung: H oder B?

Im deutschsprachigen Raum heisst die Taste vor dem C **H**. In englischen Programmen (Ableton, Logic, FL Studio) heisst sie **B**. Gleiche Taste, anderer Name.

## Schwarze Tasten

Die schwarzen Tasten liegen dazwischen. Sie heissen nach der Nachbartaste mit **#** (Kreuz, eine Taste höher, z.B. C#) oder **b** (eine Taste tiefer, z.B. Db). C# und Db sind dieselbe Taste.

## Oktave

Von einem C bis zum nächsten C sind es **12 Tasten** (weisse und schwarze zusammen) – das ist eine **Oktave**. In der DAW siehst du das als C3, C4, C5 usw.`,
    quiz: [
      { question: 'Wo liegt das C auf der Klaviatur?', options: ['Rechts von drei schwarzen Tasten', 'Links von zwei schwarzen Tasten', 'Zwischen zwei schwarzen Tasten', 'Ganz rechts'], correctOption: 1 },
      { question: 'Wie heisst das deutsche H in englischen DAWs?', options: ['A', 'Bb', 'B', 'C'], correctOption: 2 },
      { question: 'Wie viele Tasten umfasst eine Oktave (weisse und schwarze)?', options: ['7', '8', '10', '12'], correctOption: 3 },
    ],
  },
];

let created = 0;
for (const l of LESSONS) {
  const ref = db.doc(`articles/${l.id}`);
  if ((await ref.get()).exists) {
    console.log('existiert schon, übersprungen:', l.id);
    continue;
  }
  console.log(write ? 'anlegen:' : 'würde anlegen:', l.id, '–', l.title);
  if (!write) continue;
  await ref.set({
    title: l.title, courseId: 'mv', chapterId: l.chapterId, categoryId: l.chapterId, subCategoryId: null,
    order: l.order, maxPoints: 250, content: l.content, youtubeUrls: [], minRole: 'teacher',
  });
  await db.doc(`learnQuizzes/${l.id}`).set({ articleId: l.id, questions: l.quiz.map(({ correctOption, ...q }) => q) });
  await db.doc(`learnQuizKeys/${l.id}`).set({ answers: l.quiz.map((q) => q.correctOption) });
  created++;
}
console.log(write ? `${created} Entwürfe angelegt.` : 'Probelauf – mit --write ausführen.');
