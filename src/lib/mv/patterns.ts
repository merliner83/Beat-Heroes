import type { Instrument } from './synth';

/**
 * Rhythmus-Patterns für die MV-Übungen. Schritte (steps) sind 0-basiert über
 * alle Takte: bei 4/4 mit Sechzehnteln hat ein Takt 16 Schritte, die Schläge
 * liegen auf 0, 4, 8, 12.
 */
export interface PatternRow {
  id: string;
  label: string;
  instrument: Instrument;
  steps: number[];
  /** Tonhöhen (MIDI) für Bass/Akkord, pro Schritt oder für alle */
  notes?: number[] | Record<number, number[]>;
  /** Wirbel: Schritt → Anzahl Schläge (z.B. Trap-Hi-Hat-Rolls) */
  rolls?: Record<number, number>;
  /** Betonte Schritte */
  accents?: number[];
}

export interface StyleInfo {
  origin: string;
  tempo: string;
  features: string[];
  tip: string;
}

export interface RhythmPattern {
  id: string;
  title: string;
  style: string;
  meter: '4/4' | '3/4' | '2/4' | '12/8';
  beatsPerBar: number;
  stepsPerBeat: number;
  bars: number;
  bpm: number;
  /** 50 = gerade, ~58–66 = swingend (nur bei stepsPerBeat 4 oder 2) */
  swing?: number;
  rows: PatternRow[];
  /** Zeile zum Mitklopfen */
  target: string;
  info: StyleInfo;
}

const HATS_8 = [0, 2, 4, 6, 8, 10, 12, 14];
const two = (steps: number[], len = 16) => [...steps, ...steps.map((s) => s + len)];

export const PATTERNS: RhythmPattern[] = [
  {
    id: 'puls-viertel', title: 'Der Puls: Viertel', style: 'Grundlage', meter: '4/4', beatsPerBar: 4, stepsPerBeat: 4, bars: 1, bpm: 92,
    rows: [
      { id: 'kick', label: 'Viertel', instrument: 'kick', steps: [0, 4, 8, 12], accents: [0] },
    ],
    target: 'kick',
    info: { origin: 'Überall', tempo: '60–180 BPM', features: ['Vier gleichmässige Schläge pro Takt', 'Die 1 ist der stärkste Schlag', 'Der Puls läuft immer weiter – auch in Pausen'], tip: 'Nick mit dem Kopf und zähl laut «1 – 2 – 3 – 4».' },
  },
  {
    id: 'achtel', title: 'Achtel', style: 'Grundlage', meter: '4/4', beatsPerBar: 4, stepsPerBeat: 4, bars: 1, bpm: 80,
    rows: [
      { id: 'hat', label: 'Achtel', instrument: 'hat', steps: HATS_8, accents: [0, 4, 8, 12] },
    ],
    target: 'hat',
    info: { origin: 'Überall', tempo: '60–140 BPM', features: ['Acht gleichmässige Schläge pro Takt', 'Zwei Schläge pro Puls: «1 und 2 und …»', 'Typisch für Hi-Hats in Pop, Rock und Hip-Hop'], tip: 'Zähl laut «1 und 2 und 3 und 4 und» – jede Silbe ist ein Schlag.' },
  },
  {
    id: 'offbeat', title: 'Offbeat', style: 'Grundlage', meter: '4/4', beatsPerBar: 4, stepsPerBeat: 4, bars: 1, bpm: 100,
    rows: [
      { id: 'openhat', label: 'Offbeat', instrument: 'openhat', steps: [2, 6, 10, 14] },
    ],
    target: 'openhat',
    info: { origin: 'Überall', tempo: '80–130 BPM', features: ['Genau zwischen den Schlägen: auf dem «und»', 'Der Klick des Metronoms ist der Puls – du spielst dazwischen', 'Typisch für House-Hi-Hats und den Reggae-Skank'], tip: 'Nick auf den Klick und tipp, wenn dein Kopf oben ist.' },
  },
  {
    id: 'backbeat', title: 'Backbeat (Rock & Pop)', style: 'Rock / Pop', meter: '4/4', beatsPerBar: 4, stepsPerBeat: 4, bars: 1, bpm: 108,
    rows: [
      { id: 'kick', label: 'Kick', instrument: 'kick', steps: [0, 8] },
      { id: 'snare', label: 'Snare', instrument: 'snare', steps: [4, 12] },
    ],
    target: 'snare',
    info: { origin: 'USA, 1950er (Rock’n’Roll)', tempo: '90–140 BPM', features: ['Snare auf 2 und 4 – der «Backbeat»', 'Kick auf 1 und 3', 'Im Song kommt meist eine Hi-Hat in Achteln dazu'], tip: 'Klatsch auf 2 und 4 – genau so klatscht ein Konzertpublikum mit.' },
  },
  {
    id: 'four-on-the-floor', title: 'Four on the Floor (House)', style: 'House / Disco', meter: '4/4', beatsPerBar: 4, stepsPerBeat: 4, bars: 1, bpm: 124,
    rows: [
      { id: 'kick', label: 'Kick', instrument: 'kick', steps: [0, 4, 8, 12] },
      { id: 'clap', label: 'Clap', instrument: 'clap', steps: [4, 12] },
      { id: 'openhat', label: 'Open Hat', instrument: 'openhat', steps: [2, 6, 10, 14] },
    ],
    target: 'openhat',
    info: { origin: 'Disco (1970er) → Chicago House (1980er)', tempo: '118–128 BPM', features: ['Kick auf jedem Schlag', 'Offene Hi-Hat genau dazwischen: der Offbeat', 'Clap auf 2 und 4'], tip: 'Die Hi-Hat sitzt auf dem «und» – zähl «1 UND 2 UND».' },
  },
  {
    id: 'boom-bap', title: 'Boom Bap', style: 'Hip-Hop', meter: '4/4', beatsPerBar: 4, stepsPerBeat: 4, bars: 1, bpm: 90, swing: 60,
    rows: [
      { id: 'kick', label: 'Kick («Boom»)', instrument: 'kick', steps: [0, 7, 10] },
      { id: 'snare', label: 'Snare («Bap»)', instrument: 'snare', steps: [4, 12] },
      { id: 'hat', label: 'Hi-Hat', instrument: 'hat', steps: HATS_8 },
    ],
    target: 'kick',
    info: { origin: 'New York, späte 1980er–1990er', tempo: '84–96 BPM', features: ['Name aus dem Klang: Kick «Boom», Snare «Bap»', 'Leichter Swing – die Achtel schwingen', 'Samples von Soul- und Jazzplatten (MPC, SP-1200)'], tip: 'Die Kick vor der 3 (auf «a» von 2) macht den Groove – nicht zu exakt spielen.' },
  },
  {
    id: 'trap', title: 'Trap', style: 'Hip-Hop', meter: '4/4', beatsPerBar: 4, stepsPerBeat: 4, bars: 1, bpm: 140,
    rows: [
      { id: 'kick', label: '808 / Kick', instrument: 'kick', steps: [0, 3, 10] },
      { id: 'clap', label: 'Clap', instrument: 'clap', steps: [8] },
      { id: 'hat', label: 'Hi-Hat', instrument: 'hat', steps: [0, 2, 4, 6, 8, 10, 12, 13, 14, 15], rolls: { 6: 2, 14: 3 } },
    ],
    target: 'clap',
    info: { origin: 'Atlanta, 2000er', tempo: '130–150 BPM (fühlt sich halb so schnell an)', features: ['Halftime: Clap nur auf der 3', 'Schnelle Hi-Hat-Rolls (32tel, Triolen)', 'Lange 808-Bässe'], tip: 'Zähl in halbem Tempo: die Clap ist dann deine «2».' },
  },
  {
    id: 'dembow', title: 'Dembow (Reggaeton)', style: 'Reggaeton / Afro', meter: '4/4', beatsPerBar: 4, stepsPerBeat: 4, bars: 1, bpm: 94,
    rows: [
      { id: 'kick', label: 'Kick', instrument: 'kick', steps: [0, 4, 8, 12] },
      { id: 'snare', label: 'Snare', instrument: 'snare', steps: [3, 6, 11, 14] },
      { id: 'hat', label: 'Hi-Hat', instrument: 'shaker', steps: HATS_8 },
    ],
    target: 'snare',
    info: { origin: 'Jamaika (Dancehall) → Puerto Rico', tempo: '88–100 BPM', features: ['Kick auf jedem Schlag', 'Snare «hinkt» davor und danach: das Tresillo-Gefühl (3-3-2)', 'Verwandt mit Afrobeats und Dancehall'], tip: 'Sag dazu: «Boom – ts-ta – Boom – ta».' },
  },
  {
    id: 'one-drop', title: 'One Drop (Reggae)', style: 'Reggae', meter: '4/4', beatsPerBar: 4, stepsPerBeat: 4, bars: 1, bpm: 76, swing: 58,
    rows: [
      { id: 'kick', label: 'Kick', instrument: 'kick', steps: [8] },
      { id: 'rim', label: 'Rimshot', instrument: 'rim', steps: [8] },
      { id: 'hat', label: 'Hi-Hat', instrument: 'hat', steps: HATS_8 },
      { id: 'chord', label: 'Gitarre «Skank»', instrument: 'chord', steps: [4, 12], notes: [57, 60, 64] },
    ],
    target: 'kick',
    info: { origin: 'Jamaika, 1970er (Bob Marley & The Wailers)', tempo: '65–80 BPM', features: ['Die 1 bleibt leer – Kick und Rimshot nur auf der 3', 'Gitarre spielt kurz auf 2 und 4 (Skank)', 'Entspannt, leicht swingend'], tip: 'Lass die 1 bewusst frei – das ist der Trick des One Drop.' },
  },
  {
    id: 'son-clave', title: 'Son-Clave 3-2', style: 'Kuba / Salsa', meter: '4/4', beatsPerBar: 4, stepsPerBeat: 4, bars: 2, bpm: 100,
    rows: [
      { id: 'clave', label: 'Claves', instrument: 'clave', steps: [0, 6, 12, 20, 24] },
      { id: 'cowbell', label: 'Cowbell', instrument: 'cowbell', steps: two([0, 4, 8, 12]) },
      { id: 'shaker', label: 'Shaker', instrument: 'shaker', steps: two(HATS_8) },
    ],
    target: 'clave',
    info: { origin: 'Kuba (Son, später Salsa)', tempo: '90–200 BPM', features: ['Zwei Takte: 3 Schläge, dann 2 Schläge («3-2»)', 'Die Claves sind zwei Holzstäbe', 'Alle anderen Instrumente richten sich nach der Clave'], tip: 'Merksatz für die 3-Seite: «1 – 2+ – 4», dann «2 – 3».' },
  },
  {
    id: 'rumba-clave', title: 'Rumba-Clave 3-2', style: 'Kuba / Afro-Kuba', meter: '4/4', beatsPerBar: 4, stepsPerBeat: 4, bars: 2, bpm: 100,
    rows: [
      { id: 'clave', label: 'Claves', instrument: 'clave', steps: [0, 6, 14, 20, 24] },
      { id: 'shaker', label: 'Shaker', instrument: 'shaker', steps: two(HATS_8) },
    ],
    target: 'clave',
    info: { origin: 'Kuba (Rumba, afrokubanische Tradition)', tempo: '90–130 BPM', features: ['Wie die Son-Clave, aber der 3. Schlag kommt ein Achtel später', 'Wirkt drängender und spannender', 'Grundlage vieler afrokubanischer Rhythmen'], tip: 'Spiel zuerst die Son-Clave, dann verschieb nur den dritten Schlag.' },
  },
  {
    id: 'bossa-nova', title: 'Bossa-Nova-Clave', style: 'Brasilien', meter: '4/4', beatsPerBar: 4, stepsPerBeat: 4, bars: 2, bpm: 128,
    rows: [
      { id: 'clave', label: 'Rimshot (Clave)', instrument: 'rim', steps: [0, 6, 12, 20, 26] },
      { id: 'kick', label: 'Bass-Drum', instrument: 'kick', steps: two([0, 6, 8, 14]) },
      { id: 'shaker', label: 'Shaker', instrument: 'shaker', steps: two(HATS_8) },
    ],
    target: 'clave',
    info: { origin: 'Rio de Janeiro, Ende 1950er («The Girl from Ipanema»)', tempo: '110–140 BPM', features: ['Sanft, oft mit Gitarre und leiser Stimme', 'Rimshot spielt eine Clave-ähnliche Figur', 'Mischung aus Samba und Jazz'], tip: 'Leise und locker spielen – Bossa Nova flüstert.' },
  },
  {
    id: 'swing', title: 'Swing (Jazz)', style: 'Jazz', meter: '12/8', beatsPerBar: 4, stepsPerBeat: 3, bars: 1, bpm: 120,
    rows: [
      { id: 'ride', label: 'Ride-Becken', instrument: 'ride', steps: [0, 3, 5, 6, 9, 11], accents: [3, 9] },
      { id: 'hat', label: 'Hi-Hat (Fuss)', instrument: 'hat', steps: [3, 9] },
      { id: 'bass', label: 'Walking Bass', instrument: 'bass', steps: [0, 3, 6, 9], notes: { 0: [43], 3: [47], 6: [50], 9: [52] } },
    ],
    target: 'ride',
    info: { origin: 'USA, 1930er (Big Bands)', tempo: '100–250 BPM', features: ['Jeder Schlag ist in drei Teile geteilt (Triolen)', 'Ride-Muster «ding, ding-ga ding»', 'Hi-Hat mit dem Fuss auf 2 und 4'], tip: 'Sag mit: «ding – ding-ga – ding – ding-ga».' },
  },
  {
    id: 'walzer', title: 'Walzer', style: 'Klassik / Tanz', meter: '3/4', beatsPerBar: 3, stepsPerBeat: 2, bars: 1, bpm: 160,
    rows: [
      { id: 'bass', label: 'Bass («Um»)', instrument: 'bass', steps: [0], notes: [48] },
      { id: 'chord', label: 'Akkord («pa-pa»)', instrument: 'chord', steps: [2, 4], notes: [64, 67, 72] },
    ],
    target: 'chord',
    info: { origin: 'Österreich, 18./19. Jh. (Johann Strauss)', tempo: '150–190 BPM', features: ['Dreiertakt: «1 – 2 – 3»', 'Bass auf 1, Akkorde auf 2 und 3: «Um – pa – pa»', 'Paartanz, der sich dreht'], tip: 'Betone die 1 stark und spiel 2 und 3 leicht.' },
  },
  {
    id: 'laendler', title: 'Ländler (Schweizer Volksmusik)', style: 'Volksmusik CH', meter: '3/4', beatsPerBar: 3, stepsPerBeat: 2, bars: 2, bpm: 176,
    rows: [
      { id: 'bass', label: 'Kontrabass', instrument: 'bass', steps: [0, 6], notes: { 0: [48], 6: [43] } },
      { id: 'chord', label: 'Schwyzerörgeli / Klavier', instrument: 'chord', steps: [2, 4, 8, 10], notes: { 2: [64, 67, 72], 4: [64, 67, 72], 8: [62, 67, 71], 10: [62, 67, 71] } },
    ],
    target: 'bass',
    info: { origin: 'Alpenraum, Schweiz (Ländlerkapellen)', tempo: '160–200 BPM', features: ['Dreiertakt wie der Walzer, aber flotter', 'Kontrabass wechselt zwischen Grundton und Quinte', 'Typisch: Schwyzerörgeli, Klarinette, Klavier, Bass'], tip: 'Achte auf den Bass: Takt 1 tief «C», Takt 2 das «G» darunter.' },
  },
  {
    id: 'marsch', title: 'Marsch', style: 'Blasmusik', meter: '2/4', beatsPerBar: 2, stepsPerBeat: 2, bars: 2, bpm: 112,
    rows: [
      { id: 'kick', label: 'Grosse Trommel', instrument: 'kick', steps: [0, 4] },
      { id: 'snare', label: 'Kleine Trommel', instrument: 'snare', steps: [2, 6, 7] },
      { id: 'cymbal', label: 'Becken', instrument: 'openhat', steps: [2, 6] },
    ],
    target: 'kick',
    info: { origin: 'Militär- und Blasmusik, Europa', tempo: '110–120 BPM (Schritttempo)', features: ['Zweiertakt: «links – rechts»', 'Grosse Trommel auf 1, Becken auf 2', 'Typisch für Musikgesellschaften und Umzüge'], tip: 'Lauf beim Üben an Ort: jeder Schritt ein Schlag.' },
  },
];

export function getPattern(id: string) {
  return PATTERNS.find((p) => p.id === id);
}

export function totalSteps(p: RhythmPattern) {
  return p.beatsPerBar * p.stepsPerBeat * p.bars;
}

/** Zähl-Silbe für einen Schritt: «1 e + a», bei Triolen «1 + a», bei Achteln «1 +». */
export function countLabel(p: RhythmPattern, step: number): string {
  const inBar = step % (p.beatsPerBar * p.stepsPerBeat);
  const beat = Math.floor(inBar / p.stepsPerBeat) + 1;
  const sub = inBar % p.stepsPerBeat;
  if (sub === 0) return String(beat);
  if (p.stepsPerBeat === 4) return ['', 'e', '+', 'a'][sub];
  if (p.stepsPerBeat === 3) return ['', '+', 'a'][sub];
  return '+';
}

/** Eindeutige Zählzeit, z.B. «1», «2+», «3e», «4a». */
export function fullCountLabel(p: RhythmPattern, step: number): string {
  const inBar = step % (p.beatsPerBar * p.stepsPerBeat);
  const beat = Math.floor(inBar / p.stepsPerBeat) + 1;
  const sub = countLabel(p, step);
  return sub === String(beat) ? sub : `${beat}${sub}`;
}

export function rowNotes(row: PatternRow, step: number): number[] | undefined {
  if (!row.notes) return undefined;
  return Array.isArray(row.notes) ? row.notes : row.notes[step];
}
