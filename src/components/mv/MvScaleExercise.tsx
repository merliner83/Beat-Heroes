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

export type ScaleExerciseId = 'tonleiter-dur' | 'tonleiter-moll';

/** Bauplan in Halbtönen: 2 = Ganzton, 1 = Halbton. */
const PLAN: Record<ScaleExerciseId, number[]> = {
  'tonleiter-dur': [2, 2, 1, 2, 2, 2, 1],
  'tonleiter-moll': [2, 1, 2, 2, 1, 2, 2],
};

/** Tonleitern mit richtig geschriebenen Namen (deutsch). Die erste ist die leichteste. */
const SCALES: Record<ScaleExerciseId, { name: string; root: number; notes: string[] }[]> = {
  'tonleiter-dur': [
    { name: 'C-Dur', root: 60, notes: ['C', 'D', 'E', 'F', 'G', 'A', 'H', 'C'] },
    { name: 'G-Dur', root: 67, notes: ['G', 'A', 'H', 'C', 'D', 'E', 'Fis', 'G'] },
    { name: 'F-Dur', root: 65, notes: ['F', 'G', 'A', 'B', 'C', 'D', 'E', 'F'] },
    { name: 'D-Dur', root: 62, notes: ['D', 'E', 'Fis', 'G', 'A', 'H', 'Cis', 'D'] },
    { name: 'A-Dur', root: 69, notes: ['A', 'H', 'Cis', 'D', 'E', 'Fis', 'Gis', 'A'] },
  ],
  'tonleiter-moll': [
    { name: 'A-Moll', root: 69, notes: ['A', 'H', 'C', 'D', 'E', 'F', 'G', 'A'] },
    { name: 'E-Moll', root: 64, notes: ['E', 'Fis', 'G', 'A', 'H', 'C', 'D', 'E'] },
    { name: 'D-Moll', root: 62, notes: ['D', 'E', 'F', 'G', 'A', 'B', 'C', 'D'] },
    { name: 'G-Moll', root: 67, notes: ['G', 'A', 'B', 'C', 'D', 'Es', 'F', 'G'] },
    { name: 'C-Moll', root: 60, notes: ['C', 'D', 'Es', 'F', 'G', 'As', 'B', 'C'] },
  ],
};

const ROUNDS = 4;
const STEPS = 7;

function scaleMidi(root: number, plan: number[]) {
  return plan.reduce((acc, s) => [...acc, acc[acc.length - 1] + s], [root]);
}

async function playScale(midis: number[]) {
  const ctx = await mvSynth.ensure();
  const t = ctx.currentTime + 0.05;
  midis.forEach((m, i) => mvSynth.play('piano', t + i * 0.32, { notes: [m], dur: 0.45 }));
}

/**
 * Tonleiter bauen: Der Grundton ist gegeben, die Schüler:innen tippen die
 * nächsten 7 Töne nach dem Bauplan (Ganzton/Halbton). Ein falscher Ton zählt
 * als Fehler; der richtige wird gezeigt und es geht weiter.
 */
export function MvScaleExercise({ exercise, appId, onResult }: { exercise: ScaleExerciseId; appId?: string; onResult?: (score: number) => void }) {
  const { user } = useUser();
  const plan = PLAN[exercise];
  const [order, setOrder] = useState<number[]>([]);
  const [round, setRound] = useState(0);
  const [pos, setPos] = useState(1);
  const [results, setResults] = useState<boolean[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [finished, setFinished] = useState<null | { score: number; awarded: number | null }>(null);

  const scale = order.length ? SCALES[exercise][order[round - 1]] : undefined;
  const midis = scale ? scaleMidi(scale.root, plan) : [];
  const done = pos > STEPS;

  const begin = () => {
    const rest = [1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, ROUNDS - 1);
    setOrder([0, ...rest]);
    setRound(1); setPos(1); setResults([]); setTotal(0); setFinished(null); setWrong(null);
    mvSynth.ensure().then(() => mvSynth.play('piano', mvSynth.now + 0.02, { notes: [SCALES[exercise][0].root], dur: 0.6 }));
  };

  const press = async (midi: number) => {
    await mvSynth.ensure();
    mvSynth.play('piano', mvSynth.now + 0.01, { notes: [midi], dur: 0.5 });
    if (!scale || done || finished) return;
    const ok = midi === midis[pos];
    setResults((r) => [...r, ok]);
    if (ok) setTotal((t) => t + 1);
    setWrong(ok ? null : midi);
    setPos((p) => p + 1);
    if (pos === STEPS) setTimeout(() => playScale(midis), 400);
  };

  const next = async () => {
    if (round >= ROUNDS) {
      const score = Math.round((100 * total) / (ROUNDS * STEPS));
      setFinished({ score, awarded: null });
      onResult?.(score);
      if (user && appId) {
        const res = await submitResult(user, { kind: 'learnApp', refId: appId, accuracy: score });
        setFinished({ score, awarded: res?.awarded ?? 0 });
      }
      return;
    }
    const n = SCALES[exercise][order[round]];
    setRound((r) => r + 1); setPos(1); setResults([]); setWrong(null);
    mvSynth.play('piano', mvSynth.now + 0.02, { notes: [n.root], dur: 0.6 });
  };

  const marks: Record<number, KeyMark> = {};
  if (scale) {
    marks[midis[0]] = 'brand';
    for (let i = 1; i < pos && i <= STEPS; i++) marks[midis[i]] = results[i - 1] ? 'success' : 'info';
    if (wrong != null && !done) marks[wrong] = 'error';
  }
  const roundCorrect = results.filter(Boolean).length;

  return (
    <div className="space-y-5">
      {!scale && !finished && (
        <Panel className="p-6 space-y-4">
          <p className="text-white/80">{ROUNDS} Tonleitern. Der Grundton ist rosa markiert – tipp die nächsten 7 Töne nach dem Bauplan nach oben.</p>
          <Button onClick={begin} className="h-12 px-6"><Play className="w-4 h-4 mr-2" /> Start</Button>
        </Panel>
      )}

      {scale && !finished && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-white/70">
            <span>Tonleiter {round} von {ROUNDS}</span>
            <span className="tabular-nums">{total} von {(round - 1) * STEPS + Math.min(pos - 1, STEPS)} Tönen richtig</span>
          </div>
          <Panel className="p-5 space-y-4 text-center">
            <p className="text-2xl md:text-3xl font-black">Baue <span className="text-brand">{scale.name}</span></p>
            <div className="flex justify-center gap-1.5 flex-wrap" aria-label="Bauplan">
              {plan.map((s, i) => (
                <span key={i} className={cn('w-12 h-9 rounded-lg flex items-center justify-center text-sm font-bold border',
                  i === pos - 1 && !done ? 'bg-brand border-brand text-white' : i < pos - 1 ? (results[i] ? 'border-success/60 text-success' : 'border-info/60 text-info') : 'border-white/15 text-white/60')}>
                  {s === 2 ? 'Ganz' : 'Halb'}
                </span>
              ))}
            </div>
            <p className="text-sm text-white/70 min-h-5">
              {done ? `${scale.notes.join(' – ')}` : `Nächster Schritt: ${plan[pos - 1] === 2 ? 'Ganzton (2 Tasten weiter)' : 'Halbton (direkte Nachbartaste)'}`}
            </p>
          </Panel>

          <PianoKeyboard from={60} to={84} marks={marks} labels="white" onPress={press} />

          {wrong != null && !done && <p className="text-sm text-white/70">Nicht ganz – der richtige Ton ist blau. Weiter mit dem nächsten Schritt.</p>}
          {done && (
            <Panel className={cn('p-4 space-y-3 border', roundCorrect === STEPS ? 'border-success/40' : 'border-info/40')}>
              <p className={cn('font-bold', roundCorrect === STEPS ? 'text-success' : 'text-white')}>{roundCorrect === STEPS ? 'Perfekt!' : `${roundCorrect} von ${STEPS} Tönen richtig.`} {scale.name}: {scale.notes.join(' – ')}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => playScale(midis)}><Volume2 className="w-4 h-4 mr-2" /> Anhören</Button>
                <Button onClick={next}>{round >= ROUNDS ? 'Auswertung' : 'Nächste Tonleiter'}</Button>
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
            <p className="text-sm text-white/70">{total} von {ROUNDS * STEPS} Tönen richtig</p>
          </div>
          {finished.awarded != null && finished.awarded > 0 && <Tag tone="success"><Zap className="w-3 h-3" fill="currentColor" /> +{finished.awarded} Credits</Tag>}
          <Button variant="outline" onClick={begin}><RotateCcw className="w-4 h-4 mr-1" /> Nochmals</Button>
        </Panel>
      )}
      {!user && <p className="text-xs text-white/50">Melde dich an, damit dein Ergebnis gespeichert wird.</p>}
    </div>
  );
}
