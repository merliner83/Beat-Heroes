'use client';

import React, { useState } from 'react';
import { CheckCircle2, Play, RotateCcw, Volume2, Zap } from 'lucide-react';
import { useUser } from '@/firebase';
import { submitResult } from '@/lib/credits';
import { mvSynth } from '@/lib/mv/synth';
import { Button } from '@/components/ui/button';
import { Panel, Tag } from '@/components/ds';
import { cn } from '@/lib/utils';
import { KeyMark, PianoKeyboard } from './PianoKeyboard';

export type ChordExerciseId = 'akkord-bauen' | 'stufen-akkorde';

type Task = {
  /** Aufgabe, z.B. «Baue D-Moll» */
  title: string;
  /** Kleine Zeile darunter */
  sub: string;
  /** Vorgegebene (markierte) Töne */
  given: number[];
  /** Zu tippende Töne in Reihenfolge, mit Hinweis pro Schritt */
  expected: { midi: number; hint: string }[];
  /** Ergebnis: Name und Noten */
  result: string;
};

/** Dreiklänge mit richtig geschriebenen Namen (deutsch). */
const CHORDS: { name: string; root: number; minor: boolean; notes: string[] }[] = [
  { name: 'C-Dur', root: 60, minor: false, notes: ['C', 'E', 'G'] },
  { name: 'C-Moll', root: 60, minor: true, notes: ['C', 'Es', 'G'] },
  { name: 'D-Dur', root: 62, minor: false, notes: ['D', 'Fis', 'A'] },
  { name: 'D-Moll', root: 62, minor: true, notes: ['D', 'F', 'A'] },
  { name: 'E-Dur', root: 64, minor: false, notes: ['E', 'Gis', 'H'] },
  { name: 'E-Moll', root: 64, minor: true, notes: ['E', 'G', 'H'] },
  { name: 'F-Dur', root: 65, minor: false, notes: ['F', 'A', 'C'] },
  { name: 'F-Moll', root: 65, minor: true, notes: ['F', 'As', 'C'] },
  { name: 'G-Dur', root: 67, minor: false, notes: ['G', 'H', 'D'] },
  { name: 'G-Moll', root: 67, minor: true, notes: ['G', 'B', 'D'] },
  { name: 'A-Dur', root: 69, minor: false, notes: ['A', 'Cis', 'E'] },
  { name: 'A-Moll', root: 69, minor: true, notes: ['A', 'C', 'E'] },
];

/** Stufen in C-Dur (ohne die 7., den verminderten Akkord). */
const STEPS = [
  { roman: 'I', root: 60, name: 'C-Dur', notes: ['C', 'E', 'G'] },
  { roman: 'ii', root: 62, name: 'D-Moll', notes: ['D', 'F', 'A'] },
  { roman: 'iii', root: 64, name: 'E-Moll', notes: ['E', 'G', 'H'] },
  { roman: 'IV', root: 65, name: 'F-Dur', notes: ['F', 'A', 'C'] },
  { roman: 'V', root: 67, name: 'G-Dur', notes: ['G', 'H', 'D'] },
  { roman: 'vi', root: 69, name: 'A-Moll', notes: ['A', 'C', 'E'] },
];
/** Tonleiter C-Dur über zwei Oktaven (für Stufen-Akkorde: jede zweite Taste). */
const C_MAJOR = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79];

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

function makeTasks(exercise: ChordExerciseId): Task[] {
  if (exercise === 'akkord-bauen') {
    const easy = CHORDS.find((c) => c.name === 'C-Dur')!;
    const rest = shuffle(CHORDS.filter((c) => c !== easy)).slice(0, 5);
    return [easy, ...rest].map((c) => ({
      title: c.name,
      sub: c.minor ? 'Moll: kleine Terz (3 Halbtöne), dann grosse Terz (4)' : 'Dur: grosse Terz (4 Halbtöne), dann kleine Terz (3)',
      given: [c.root],
      expected: [
        { midi: c.root + (c.minor ? 3 : 4), hint: `Terz: ${c.minor ? '3' : '4'} Halbtöne über dem Grundton` },
        { midi: c.root + 7, hint: `Quinte: ${c.minor ? '4' : '3'} Halbtöne über der Terz` },
      ],
      result: `${c.name}: ${c.notes.join(' – ')}`,
    }));
  }
  return shuffle(STEPS).map((s) => {
    const i = C_MAJOR.indexOf(s.root);
    return {
      title: `Stufe ${s.roman} in C-Dur`,
      sub: 'Nur weisse Tasten: Ton nehmen, einen auslassen, Ton nehmen …',
      given: [],
      expected: [
        { midi: C_MAJOR[i], hint: `Grundton: der ${i + 1}. Ton der C-Dur-Tonleiter` },
        { midi: C_MAJOR[i + 2], hint: 'Terz: eine weisse Taste auslassen' },
        { midi: C_MAJOR[i + 4], hint: 'Quinte: wieder eine weisse Taste auslassen' },
      ],
      result: `${s.roman} = ${s.name}: ${s.notes.join(' – ')}`,
    };
  });
}

async function playChord(midis: number[]) {
  const ctx = await mvSynth.ensure();
  const t = ctx.currentTime + 0.05;
  midis.forEach((m, i) => mvSynth.play('piano', t + i * 0.3, { notes: [m], dur: 0.5 }));
  mvSynth.play('piano', t + midis.length * 0.3 + 0.1, { notes: midis, dur: 1.4 });
}

/**
 * Akkorde bauen: Töne eines Dreiklangs der Reihe nach tippen. Ein falscher
 * Ton zählt als Fehler, der richtige wird gezeigt und es geht weiter.
 */
export function MvChordExercise({ exercise, appId, onResult }: { exercise: ChordExerciseId; appId?: string; onResult?: (score: number) => void }) {
  const { user } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [round, setRound] = useState(0);
  const [pos, setPos] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [finished, setFinished] = useState<null | { score: number; awarded: number | null }>(null);

  const task = tasks[round - 1];
  const done = !!task && pos >= task.expected.length;
  const maxPoints = tasks.reduce((s, t) => s + t.expected.length, 0);
  const allNotes = task ? [...task.given, ...task.expected.map((e) => e.midi)] : [];

  const begin = () => {
    const t = makeTasks(exercise);
    setTasks(t); setRound(1); setPos(0); setResults([]); setTotal(0); setFinished(null); setWrong(null);
    if (t[0].given.length) mvSynth.ensure().then(() => mvSynth.play('piano', mvSynth.now + 0.02, { notes: t[0].given, dur: 0.6 }));
  };

  const press = async (midi: number) => {
    await mvSynth.ensure();
    mvSynth.play('piano', mvSynth.now + 0.01, { notes: [midi], dur: 0.5 });
    if (!task || done || finished) return;
    const ok = midi === task.expected[pos].midi;
    setResults((r) => [...r, ok]);
    if (ok) setTotal((t) => t + 1);
    setWrong(ok ? null : midi);
    setPos((p) => p + 1);
    if (pos === task.expected.length - 1) setTimeout(() => playChord(allNotes), 350);
  };

  const next = async () => {
    if (round >= tasks.length) {
      const score = Math.round((100 * total) / maxPoints);
      setFinished({ score, awarded: null });
      onResult?.(score);
      if (user && appId) {
        const res = await submitResult(user, { kind: 'learnApp', refId: appId, accuracy: score });
        setFinished({ score, awarded: res?.awarded ?? 0 });
      }
      return;
    }
    const n = tasks[round];
    setRound((r) => r + 1); setPos(0); setResults([]); setWrong(null);
    if (n.given.length) mvSynth.play('piano', mvSynth.now + 0.02, { notes: n.given, dur: 0.6 });
  };

  const marks: Record<number, KeyMark> = {};
  if (task) {
    task.given.forEach((m) => { marks[m] = 'brand'; });
    task.expected.slice(0, pos).forEach((e, i) => { marks[e.midi] = results[i] ? 'success' : 'info'; });
    if (wrong != null && !done) marks[wrong] = 'error';
  }
  const roundCorrect = results.filter(Boolean).length;

  return (
    <div className="space-y-5">
      {!task && !finished && (
        <Panel className="p-6 space-y-4">
          <p className="text-white/80">
            {exercise === 'akkord-bauen'
              ? '6 Akkorde. Der Grundton ist rosa markiert – tipp Terz und Quinte darüber.'
              : '6 Akkorde in C-Dur. Tipp Grundton, Terz und Quinte – von unten nach oben.'}
          </p>
          <Button onClick={begin} className="h-12 px-6"><Play className="w-4 h-4 mr-2" /> Start</Button>
        </Panel>
      )}

      {task && !finished && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-white/70">
            <span>Akkord {round} von {tasks.length}</span>
            <span className="tabular-nums">{total} Töne richtig</span>
          </div>
          <Panel className="p-5 space-y-2 text-center">
            <p className="text-2xl md:text-3xl font-black">Baue <span className="text-brand">{task.title}</span></p>
            <p className="text-sm text-white/60">{task.sub}</p>
            <p className="text-sm font-semibold text-white min-h-5">{done ? task.result : `Jetzt: ${task.expected[pos].hint}`}</p>
          </Panel>

          <PianoKeyboard from={60} to={79} marks={marks} labels="white" onPress={press} />

          {wrong != null && !done && <p className="text-sm text-white/70">Nicht ganz – der richtige Ton ist blau. Weiter mit dem nächsten Ton.</p>}
          {done && (
            <Panel className={cn('p-4 space-y-3 border', roundCorrect === task.expected.length ? 'border-success/40' : 'border-info/40')}>
              <p className={cn('font-bold', roundCorrect === task.expected.length ? 'text-success' : 'text-white')}>
                {roundCorrect === task.expected.length ? 'Perfekt!' : `${roundCorrect} von ${task.expected.length} Tönen richtig.`} {task.result}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => playChord(allNotes)}><Volume2 className="w-4 h-4 mr-2" /> Anhören</Button>
                <Button onClick={next}>{round >= tasks.length ? 'Auswertung' : 'Nächster Akkord'}</Button>
              </div>
            </Panel>
          )}
        </div>
      )}

      {finished && (
        <Panel className="p-5 flex flex-wrap items-center gap-4">
          <CheckCircle2 className={cn('w-10 h-10', finished.score >= 80 ? 'text-success' : 'text-credit')} />
          <div className="flex-1 min-w-[10rem]">
            <p className="text-3xl font-black tabular-nums">{finished.score}%</p>
            <p className="text-sm text-white/70">{total} von {maxPoints} Tönen richtig</p>
          </div>
          {finished.awarded != null && finished.awarded > 0 && <Tag tone="success"><Zap className="w-3 h-3" fill="currentColor" /> +{finished.awarded} Credits</Tag>}
          <Button variant="outline" onClick={begin}><RotateCcw className="w-4 h-4 mr-1" /> Nochmals</Button>
        </Panel>
      )}
      {!user && <p className="text-xs text-white/50">Melde dich an, damit dein Ergebnis gespeichert wird.</p>}
    </div>
  );
}
