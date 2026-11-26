'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Ear, Hand, Play, Square, Info, Lightbulb, RotateCcw, CheckCircle2, Zap } from 'lucide-react';
import { useUser } from '@/firebase';
import { submitResult } from '@/lib/credits';
import { mvSynth } from '@/lib/mv/synth';
import { RhythmPattern, totalSteps } from '@/lib/mv/patterns';
import { TEST_PASS_SCORE } from '@/lib/learn/tests';
import { usePatternPlayer } from '@/lib/mv/usePatternPlayer';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Panel, Tag } from '@/components/ds';
import { cn } from '@/lib/utils';
import { CellFeedback, INSTRUMENT_COLOR, RhythmGrid } from './RhythmGrid';

type Mode = 'listen' | 'tap';

function StyleCard({ pattern }: { pattern: RhythmPattern }) {
  const { info } = pattern;
  return (
    <Panel className="p-5 space-y-3">
      <h3 className="flex items-center gap-2 font-bold"><Info className="w-5 h-5 text-brand" /> Steckbrief: {pattern.style}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-white/60">Herkunft</dt><dd>{info.origin}</dd>
        <dt className="text-white/60">Tempo</dt><dd>{info.tempo}</dd>
        <dt className="text-white/60">Takt</dt><dd>{pattern.meter}</dd>
      </dl>
      <ul className="text-sm text-white/80 list-disc pl-5 space-y-1">{info.features.map((f) => <li key={f}>{f}</li>)}</ul>
      <p className="text-sm text-credit flex gap-2"><Lightbulb className="w-4 h-4 shrink-0 mt-0.5" /> {info.tip}</p>
    </Panel>
  );
}

function ResultCard({ score, awarded, counted, onAgain }: { score: number; awarded: number | null; counted: boolean; onAgain: () => void }) {
  const ok = score >= TEST_PASS_SCORE;
  const tone = score >= 85 ? 'text-success' : ok ? 'text-credit' : 'text-warning';
  const text = !counted
    ? 'Geübt im langsameren Tempo. Für die Wertung im Originaltempo spielen.'
    : score >= 85 ? 'Stark! Du sitzt im Groove.' : ok ? `Bestanden (ab ${TEST_PASS_SCORE} %). Geht's noch genauer?` : `Noch nicht bestanden (ab ${TEST_PASS_SCORE} %). Hör nochmals hin und zähl laut mit.`;
  return (
    <Panel className="p-5 flex flex-wrap items-center gap-4">
      <CheckCircle2 className={cn('w-10 h-10', tone)} />
      <div className="flex-1 min-w-[10rem]">
        <p className={cn('text-3xl font-black tabular-nums', tone)}>{score}%</p>
        <p className="text-sm text-white/70">{text}</p>
      </div>
      {awarded != null && awarded > 0 && <Tag tone="success"><Zap className="w-3 h-3" fill="currentColor" /> +{awarded} Credits</Tag>}
      <Button variant="outline" onClick={onAgain}><RotateCcw className="w-4 h-4 mr-1" /> Nochmals</Button>
    </Panel>
  );
}

/**
 * Rhythmus-Übung: zuerst anhören (mit Lauflicht), dann mitklopfen. Das
 * Mitklopfen ist die Prüfung (ab TEST_PASS_SCORE % bestanden). In einer
 * Lektion (embedded) ohne Steckbrief und Tempo-Regler.
 */
export function MvRhythmExercise({ pattern, appId, embedded = false, onResult }: {
  pattern: RhythmPattern;
  appId?: string;
  embedded?: boolean;
  onResult?: (score: number) => void;
}) {
  const { user } = useUser();
  const [mode, setMode] = useState<Mode>('listen');
  const [tempo, setTempo] = useState(pattern.bpm);
  const [metronome, setMetronome] = useState(true);
  const player = usePatternPlayer(pattern, tempo);
  const target = pattern.rows.find((r) => r.id === pattern.target)!;
  const others = pattern.rows.filter((r) => r.id !== target.id);

  // Mitklopfen
  const taps = useRef<number[]>([]);
  const [tapFlash, setTapFlash] = useState(false);
  const [feedback, setFeedback] = useState<Record<number, CellFeedback>>({});
  const [score, setScore] = useState<number | null>(null);
  const [counted, setCounted] = useState(true);
  const [awarded, setAwarded] = useState<number | null>(null);

  const reset = useCallback(() => {
    player.stop();
    setFeedback({});
    setScore(null);
    setAwarded(null);
  }, [player]);

  useEffect(() => { reset(); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const report = useCallback(async (value: number, valid: boolean) => {
    setScore(value);
    setCounted(valid);
    if (!valid) return;
    onResult?.(value);
    if (!user || !appId) return;
    const res = await submitResult(user, { kind: 'learnApp', refId: appId, accuracy: value });
    setAwarded(res?.awarded ?? 0);
  }, [user, appId, onResult]);

  // --- Hören ---
  const toggleListen = () => {
    if (player.playing) return player.stop();
    player.start({ rows: pattern.rows, metronome, loops: Infinity });
  };

  // --- Mitklopfen ---
  const evaluateTaps = useCallback(() => {
    const hits = player.targetHits.current;
    const window = Math.min(0.13, player.stepDur * 0.45);
    const used = new Set<number>();
    const fb: Record<number, CellFeedback> = {};
    let matched = 0;
    for (const h of hits) {
      let best = -1;
      let bestDiff = Infinity;
      taps.current.forEach((t, i) => {
        const d = Math.abs(t - h.time);
        if (!used.has(i) && d < bestDiff) { best = i; bestDiff = d; }
      });
      const ok = best >= 0 && bestDiff <= window;
      if (ok) { used.add(best); matched++; }
      fb[h.step] = ok ? (fb[h.step] === 'miss' ? 'miss' : 'hit') : 'miss';
    }
    const extras = taps.current.length - used.size;
    const value = hits.length ? Math.max(0, Math.round((100 * matched) / (hits.length + extras * 0.5))) : 0;
    setFeedback(fb);
    report(value, tempo >= pattern.bpm);
  }, [player, report, tempo, pattern.bpm]);

  const startTap = () => {
    reset();
    taps.current = [];
    const loops = Math.max(2, Math.round(4 / pattern.bars));
    player.start({ rows: pattern.rows, muted: [target.id], metronome: true, countInBars: 1, loops, targetRow: target.id, onEnd: evaluateTaps });
  };

  const tap = useCallback(() => {
    if (!player.playing) return;
    const t = mvSynth.now;
    taps.current.push(t);
    mvSynth.play(target.instrument, t, { notes: Array.isArray(target.notes) ? target.notes : undefined });
    setTapFlash(true);
    setTimeout(() => setTapFlash(false), 90);
  }, [player.playing, target]);

  useEffect(() => {
    if (mode !== 'tap' || !player.playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.key.length === 1) { e.preventDefault(); tap(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, tap, player.playing]);

  const withOthers = others.length ? ` Die ${others.map((r) => r.label).join(' und ')} spielt mit.` : '';
  const modes: { id: Mode; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
    { id: 'listen', label: '1. Anhören', icon: Ear, hint: `Hör zu und schau, wo «${target.label}» im Raster liegt. Zähl laut mit.` },
    { id: 'tap', label: '2. Mitklopfen', icon: Hand, hint: `Prüfung: Nach 4 Klicks zum Einzählen tippst du «${target.label}» – aufs Pad oder mit der Leertaste.${withOthers} Bestanden ab ${TEST_PASS_SCORE} %.` },
  ];
  const activeMode = modes.find((m) => m.id === mode)!;
  const counting = player.countIn != null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="tablist">
        {modes.map((m) => (
          <button key={m.id} role="tab" aria-selected={mode === m.id} onClick={() => setMode(m.id)}
            className={cn('flex items-center gap-2 px-4 h-10 rounded-full text-sm font-semibold border transition-colors',
              mode === m.id ? 'bg-brand border-brand text-white' : 'border-white/15 text-white/70 hover:text-white')}>
            <m.icon className="w-4 h-4" /> {m.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-white/70">{activeMode.hint}</p>

      <RhythmGrid
        pattern={pattern}
        rows={pattern.rows}
        current={player.step != null && player.step >= 0 ? player.step : null}
        targetRow={target.id}
        feedback={feedback}
      />

      {mode === 'listen' && (
        <div className="flex flex-wrap items-center gap-4">
          <Button onClick={toggleListen} className="h-12 px-6 min-w-[9rem]">{player.playing ? <><Square className="w-4 h-4 mr-2" /> Stopp</> : <><Play className="w-4 h-4 mr-2" /> Abspielen</>}</Button>
          <label className="flex items-center gap-2 text-sm"><Switch checked={metronome} onCheckedChange={(v) => { player.stop(); setMetronome(v); }} /> Klick (Puls)</label>
        </div>
      )}

      {mode === 'tap' && (
        <div className="space-y-4">
          <Button onClick={player.playing ? player.stop : startTap} className="h-12 px-6 min-w-[12rem]">
            {player.playing ? <><Square className="w-4 h-4 mr-2" /> Abbrechen</> : <><Play className="w-4 h-4 mr-2" /> Start mit Einzählen</>}
          </Button>
          <button type="button" onPointerDown={(e) => { e.preventDefault(); tap(); }} disabled={!player.playing}
            aria-live="polite"
            className={cn('w-full h-32 md:h-40 rounded-3xl border-2 font-black transition-colors select-none touch-manipulation flex items-center justify-center',
              player.playing ? 'border-brand bg-brand/15 text-white' : 'border-white/10 bg-white/[0.03] text-white/40',
              tapFlash && 'bg-brand/50')}>
            {counting
              ? <span className="text-6xl text-brand tabular-nums">{player.countIn}</span>
              : <span className="text-xl">{player.playing ? `Tippen: ${target.label}` : 'Zuerst «Start» drücken'}</span>}
          </button>
          {score != null && !player.playing && <ResultCard score={score} awarded={awarded} counted={counted} onAgain={startTap} />}
        </div>
      )}

      {!embedded && (
        <div className="space-y-2">
          <p className="text-sm text-white/70">Tempo: <span className="font-bold tabular-nums">{tempo} BPM</span>{tempo !== pattern.bpm && <button className="ml-2 text-brand underline" onClick={() => { player.stop(); setTempo(pattern.bpm); }}>Original ({pattern.bpm})</button>}</p>
          <Slider value={[tempo]} min={Math.round(pattern.bpm * 0.5)} max={Math.round(pattern.bpm * 1.2)} step={1} onValueChange={([v]) => { player.stop(); setTempo(v); }} aria-label="Tempo" />
          {tempo < pattern.bpm && <p className="text-xs text-white/50">Langsamer üben ist gut – gewertet wird erst ab {pattern.bpm} BPM.</p>}
        </div>
      )}

      {!embedded && <StyleCard pattern={pattern} />}
      {!embedded && totalSteps(pattern) > 16 && <p className="text-xs text-white/50">Dieses Pattern dauert {pattern.bars} Takte.</p>}
      {!user && <p className="text-xs text-white/50">Melde dich an, damit dein Ergebnis gespeichert wird.</p>}
    </div>
  );
}
