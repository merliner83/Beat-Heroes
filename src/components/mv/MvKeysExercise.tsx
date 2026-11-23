'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Info, Lightbulb, Play, RotateCcw, Volume2, Zap } from 'lucide-react';
import { useUser } from '@/firebase';
import { submitResult } from '@/lib/credits';
import { mvSynth } from '@/lib/mv/synth';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Panel, Tag } from '@/components/ds';
import { cn } from '@/lib/utils';
import { KeyMark, PianoKeyboard, isBlack, noteName } from './PianoKeyboard';

export type KeysExerciseId = 'notennamen' | 'intervalle' | 'dur-moll';

const ROUNDS: Record<KeysExerciseId, number> = { notennamen: 10, intervalle: 8, 'dur-moll': 8 };

const INTERVALS = [
  { semis: 2, name: 'Grosse Sekunde', song: '«Alle meine Entchen» (die ersten zwei Töne)' },
  { semis: 3, name: 'Kleine Terz', song: '«Smoke on the Water» (Riff-Beginn) oder der Kuckucksruf (abwärts)' },
  { semis: 4, name: 'Grosse Terz', song: '«Oh When the Saints» (die ersten zwei Töne)' },
  { semis: 5, name: 'Quarte', song: '«O Tannenbaum» (die ersten zwei Töne)' },
  { semis: 7, name: 'Quinte', song: '«Morgen kommt der Weihnachtsmann» (2. → 3. Ton)' },
  { semis: 12, name: 'Oktave', song: '«Somewhere over the Rainbow» (die ersten zwei Töne)' },
];

const INFO: Record<KeysExerciseId, { title: string; text: string[]; tip: string }> = {
  notennamen: {
    title: 'Notennamen',
    text: ['Die weissen Tasten heissen C D E F G A H.', 'Das C liegt immer links neben den zwei schwarzen Tasten.', 'In englischen DAWs heisst das H «B».'],
    tip: 'Orientiere dich an den Gruppen der schwarzen Tasten: links von der Zweiergruppe liegt C, links von der Dreiergruppe F.',
  },
  intervalle: {
    title: 'Intervalle',
    text: ['Ein Intervall ist der Abstand zwischen zwei Tönen.', 'Man zählt ihn in Halbtönen (jede Taste, auch die schwarzen).', 'Merksongs helfen beim Hören.'],
    tip: 'Sing den Anfang des Merksongs innerlich mit – passt er, hast du das Intervall.',
  },
  'dur-moll': {
    title: 'Dur und Moll',
    text: ['Ein Dreiklang besteht aus drei Tönen: Grundton, Terz und Quinte.', 'Dur: grosse Terz (4 Halbtöne) + kleine Terz (3) – klingt hell, fröhlich.', 'Moll: kleine Terz (3) + grosse Terz (4) – klingt dunkler, traurig.'],
    tip: 'Achte auf den mittleren Ton: Er entscheidet, ob es Dur oder Moll ist.',
  },
};

type Question =
  | { kind: 'note'; target: number }
  | { kind: 'interval'; root: number; semis: number }
  | { kind: 'chord'; root: number; minor: boolean };

const rand = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

function makeQuestion(id: KeysExerciseId, prev?: Question): Question {
  for (let tries = 0; tries < 10; tries++) {
    let q: Question;
    if (id === 'notennamen') {
      const whites = Array.from({ length: 12 }, (_, i) => 60 + i).filter((m) => !isBlack(m));
      q = { kind: 'note', target: rand(whites) };
    } else if (id === 'intervalle') {
      q = { kind: 'interval', root: 60 + Math.floor(Math.random() * 8), semis: rand(INTERVALS).semis };
    } else {
      q = { kind: 'chord', root: 60 + Math.floor(Math.random() * 7), minor: Math.random() < 0.5 };
    }
    if (JSON.stringify(q) !== JSON.stringify(prev)) return q;
  }
  return makeQuestion(id);
}

function chordNotes(root: number, minor: boolean) {
  return [root, root + (minor ? 3 : 4), root + 7];
}

async function playQuestion(q: Question) {
  const ctx = await mvSynth.ensure();
  const t = ctx.currentTime + 0.05;
  if (q.kind === 'note') mvSynth.play('piano', t, { notes: [q.target] });
  if (q.kind === 'interval') {
    mvSynth.play('piano', t, { notes: [q.root], dur: 0.7 });
    mvSynth.play('piano', t + 0.75, { notes: [q.root + q.semis], dur: 0.7 });
    mvSynth.play('piano', t + 1.6, { notes: [q.root, q.root + q.semis], dur: 1.1 });
  }
  if (q.kind === 'chord') {
    const n = chordNotes(q.root, q.minor);
    n.forEach((m, i) => mvSynth.play('piano', t + i * 0.35, { notes: [m], dur: 0.6 }));
    mvSynth.play('piano', t + 1.2, { notes: n, dur: 1.4 });
  }
}

export function MvKeysExercise({ exercise, appId }: { exercise: KeysExerciseId; appId?: string }) {
  const { user } = useUser();
  const total = ROUNDS[exercise];
  const [round, setRound] = useState(0);
  const [q, setQ] = useState<Question | null>(null);
  const [answered, setAnswered] = useState<null | { correct: boolean; picked?: number | string }>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showNames, setShowNames] = useState(exercise !== 'notennamen');
  const [finished, setFinished] = useState<null | { score: number; awarded: number | null }>(null);
  const info = INFO[exercise];

  const begin = useCallback(() => {
    const first = makeQuestion(exercise);
    setRound(1); setQ(first); setAnswered(null); setCorrectCount(0); setFinished(null);
    if (first.kind !== 'note') playQuestion(first);
  }, [exercise]);

  useEffect(() => { setQ(null); setRound(0); setFinished(null); }, [exercise]);

  const next = async () => {
    if (round >= total) {
      const score = Math.round((100 * correctCount) / total);
      setFinished({ score, awarded: null });
      if (user && appId) {
        const res = await submitResult(user, { kind: 'learnApp', refId: appId, accuracy: score });
        setFinished({ score, awarded: res?.awarded ?? 0 });
      }
      return;
    }
    const n = makeQuestion(exercise, q ?? undefined);
    setRound((r) => r + 1); setQ(n); setAnswered(null);
    if (n.kind !== 'note') playQuestion(n);
  };

  const answer = (correct: boolean, picked?: number | string) => {
    if (answered) return;
    setAnswered({ correct, picked });
    if (correct) setCorrectCount((c) => c + 1);
  };

  const pressKey = async (midi: number) => {
    await mvSynth.ensure();
    mvSynth.play('piano', mvSynth.now + 0.01, { notes: [midi], dur: 0.6 });
    if (q?.kind === 'note' && !answered) answer(midi % 12 === q.target % 12, midi);
  };

  // Markierungen auf der Klaviatur
  const marks: Record<number, KeyMark> = {};
  if (q && answered) {
    if (q.kind === 'note') {
      marks[q.target] = 'success';
      if (!answered.correct && typeof answered.picked === 'number') marks[answered.picked] = 'error';
    }
    if (q.kind === 'interval') { marks[q.root] = 'brand'; marks[q.root + q.semis] = 'success'; }
    if (q.kind === 'chord') chordNotes(q.root, q.minor).forEach((m, i) => { marks[m] = i === 1 ? 'success' : 'brand'; });
  }

  const intervalInfo = q?.kind === 'interval' ? INTERVALS.find((i) => i.semis === q.semis) : undefined;

  return (
    <div className="space-y-6">
      {!q && !finished && (
        <Panel className="p-6 space-y-4">
          <p className="text-white/80">{total} Runden. {exercise === 'notennamen' ? 'Finde die gesuchte Taste.' : 'Hör gut hin und wähle die richtige Antwort.'}</p>
          <Button onClick={begin} className="h-12 px-6"><Play className="w-4 h-4 mr-2" /> Start</Button>
        </Panel>
      )}

      {q && !finished && (
        <div className="space-y-5">
          <div className="flex items-center justify-between text-sm text-white/70">
            <span>Runde {round} von {total}</span>
            <span className="tabular-nums">{correctCount} richtig</span>
          </div>

          <Panel className="p-5 text-center space-y-3">
            {q.kind === 'note' && <p className="text-2xl md:text-3xl font-black">Finde das <span className="text-brand">{noteName(q.target)}</span></p>}
            {q.kind === 'interval' && <p className="text-xl md:text-2xl font-black">Welches Intervall hörst du?</p>}
            {q.kind === 'chord' && <p className="text-xl md:text-2xl font-black">Dur oder Moll?</p>}
            {q.kind !== 'note' && (
              <Button variant="outline" onClick={() => playQuestion(q)}><Volume2 className="w-4 h-4 mr-2" /> Nochmals hören</Button>
            )}
          </Panel>

          <PianoKeyboard from={60} to={exercise === 'notennamen' ? 71 : 79} marks={marks}
            labels={showNames ? 'white' : answered ? 'marked' : 'none'}
            onPress={pressKey} />
          {exercise !== 'notennamen' && (
            <label className="flex items-center gap-2 text-sm text-white/70"><Switch checked={showNames} onCheckedChange={setShowNames} /> Notennamen anzeigen</label>
          )}

          {q.kind === 'interval' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {INTERVALS.map((i) => (
                <Button key={i.semis} variant="outline" disabled={!!answered}
                  className={cn('h-12', answered && i.semis === q.semis && 'bg-success text-black border-success', answered && answered.picked === i.semis && i.semis !== q.semis && 'bg-destructive border-destructive')}
                  onClick={() => answer(i.semis === q.semis, i.semis)}>{i.name}</Button>
              ))}
            </div>
          )}
          {q.kind === 'chord' && (
            <div className="grid grid-cols-2 gap-2">
              {[{ label: 'Dur', minor: false }, { label: 'Moll', minor: true }].map((o) => (
                <Button key={o.label} variant="outline" disabled={!!answered}
                  className={cn('h-14 text-lg', answered && o.minor === q.minor && 'bg-success text-black border-success', answered && answered.picked === o.label && o.minor !== q.minor && 'bg-destructive border-destructive')}
                  onClick={() => answer(o.minor === q.minor, o.label)}>{o.label}</Button>
              ))}
            </div>
          )}

          {answered && (
            <Panel className={cn('p-4 space-y-2 border', answered.correct ? 'border-success/40' : 'border-destructive/40')}>
              <p className={cn('font-bold', answered.correct ? 'text-success' : 'text-destructive')}>{answered.correct ? 'Richtig!' : 'Nicht ganz.'}</p>
              {q.kind === 'note' && <p className="text-sm text-white/80">Das {noteName(q.target)} ist grün markiert.</p>}
              {q.kind === 'interval' && intervalInfo && (
                <p className="text-sm text-white/80">{intervalInfo.name}: {noteName(q.root)} → {noteName(q.root + q.semis)} = {q.semis} Halbtöne. Merksong: {intervalInfo.song}</p>
              )}
              {q.kind === 'chord' && (
                <p className="text-sm text-white/80">
                  {noteName(q.root)}-{q.minor ? 'Moll' : 'Dur'}: {chordNotes(q.root, q.minor).map((m) => noteName(m)).join(' – ')}
                  {' '}({q.minor ? '3 + 4' : '4 + 3'} Halbtöne). Die Terz ist grün.
                </p>
              )}
              <Button onClick={next}>{round >= total ? 'Auswertung' : 'Weiter'}</Button>
            </Panel>
          )}
        </div>
      )}

      {finished && (
        <Panel className="p-5 flex flex-wrap items-center gap-4">
          <CheckCircle2 className={cn('w-10 h-10', finished.score >= 80 ? 'text-success' : 'text-credit')} />
          <div className="flex-1 min-w-[10rem]">
            <p className="text-3xl font-black tabular-nums">{finished.score}%</p>
            <p className="text-sm text-white/70">{correctCount} von {total} richtig</p>
          </div>
          {finished.awarded != null && finished.awarded > 0 && <Tag tone="success"><Zap className="w-3 h-3" fill="currentColor" /> +{finished.awarded} Credits</Tag>}
          <Button variant="outline" onClick={begin}><RotateCcw className="w-4 h-4 mr-1" /> Nochmals</Button>
        </Panel>
      )}

      <Panel className="p-5 space-y-3">
        <h3 className="flex items-center gap-2 font-bold"><Info className="w-5 h-5 text-brand" /> {info.title}</h3>
        <ul className="text-sm text-white/80 list-disc pl-5 space-y-1">{info.text.map((t) => <li key={t}>{t}</li>)}</ul>
        <p className="text-sm text-credit flex gap-2"><Lightbulb className="w-4 h-4 shrink-0 mt-0.5" /> {info.tip}</p>
        {exercise === 'notennamen' && (
          <label className="flex items-center gap-2 text-sm text-white/70"><Switch checked={showNames} onCheckedChange={setShowNames} /> Hilfe: Namen auf den Tasten zeigen</label>
        )}
      </Panel>
      {!user && <p className="text-xs text-white/50">Melde dich an, damit dein Ergebnis und deine Credits gespeichert werden.</p>}
    </div>
  );
}
