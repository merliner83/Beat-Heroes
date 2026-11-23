'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ear, Hand, Puzzle, Play, Square, Info, Lightbulb, RotateCcw, CheckCircle2, Zap } from 'lucide-react';
import { useUser } from '@/firebase';
import { submitResult } from '@/lib/credits';
import { mvSynth } from '@/lib/mv/synth';
import { PatternRow, RhythmPattern, fullCountLabel, totalSteps } from '@/lib/mv/patterns';
import { usePatternPlayer } from '@/lib/mv/usePatternPlayer';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Panel, Tag } from '@/components/ds';
import { cn } from '@/lib/utils';
import { CellFeedback, INSTRUMENT_COLOR, RhythmGrid } from './RhythmGrid';

type Mode = 'listen' | 'tap' | 'build';

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

function ResultCard({ score, awarded, onAgain }: { score: number; awarded: number | null; onAgain: () => void }) {
  const tone = score >= 85 ? 'text-success' : score >= 60 ? 'text-credit' : 'text-warning';
  const text = score >= 85 ? 'Stark! Du sitzt im Groove.' : score >= 60 ? 'Gut – noch etwas genauer.' : 'Weiter üben – zuerst langsamer probieren.';
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

export function MvRhythmExercise({ pattern, appId }: { pattern: RhythmPattern; appId?: string }) {
  const { user } = useUser();
  const [mode, setMode] = useState<Mode>('listen');
  const [tempo, setTempo] = useState(pattern.bpm);
  const [metronome, setMetronome] = useState(false);
  const [muted, setMuted] = useState<string[]>([]);
  const player = usePatternPlayer(pattern, tempo);
  const target = pattern.rows.find((r) => r.id === pattern.target)!;

  // Mitklopfen
  const taps = useRef<number[]>([]);
  const [tapFlash, setTapFlash] = useState(false);
  const [feedback, setFeedback] = useState<Record<number, CellFeedback>>({});
  const [score, setScore] = useState<number | null>(null);
  const [awarded, setAwarded] = useState<number | null>(null);

  // Nachbauen
  const [built, setBuilt] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);

  const reset = useCallback(() => {
    player.stop();
    setFeedback({});
    setScore(null);
    setAwarded(null);
    setChecked(false);
  }, [player]);

  useEffect(() => { reset(); setBuilt([]); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const report = useCallback(async (value: number) => {
    setScore(value);
    if (!user || !appId) return;
    const res = await submitResult(user, { kind: 'learnApp', refId: appId, accuracy: value });
    setAwarded(res?.awarded ?? 0);
  }, [user, appId]);

  // --- Hören ---
  const toggleListen = () => {
    if (player.playing) return player.stop();
    player.start({ rows: pattern.rows, muted, metronome, loops: Infinity });
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
    report(value);
  }, [player, report]);

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
    if (mode !== 'tap') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.key.length === 1) { e.preventDefault(); tap(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, tap]);

  // --- Nachbauen ---
  const buildRows: PatternRow[] = useMemo(() => pattern.rows.map((r) => (r.id === target.id ? { ...r, steps: built, rolls: undefined } : r)), [pattern.rows, target.id, built]);
  const toggleBuilt = (s: number) => {
    if (checked) { setChecked(false); setFeedback({}); setScore(null); }
    setBuilt((b) => (b.includes(s) ? b.filter((x) => x !== s) : [...b, s]));
    mvSynth.ensure().then(() => mvSynth.play(target.instrument, mvSynth.now + 0.01, { notes: Array.isArray(target.notes) ? target.notes : undefined }));
  };
  const checkBuilt = () => {
    const sol = new Set(target.steps);
    const mine = new Set(built);
    const union = new Set([...sol, ...mine]);
    const correct = [...union].filter((s) => sol.has(s) && mine.has(s)).length;
    const fb: Record<number, CellFeedback> = {};
    mine.forEach((s) => { fb[s] = sol.has(s) ? 'hit' : 'miss'; });
    setFeedback(fb);
    setChecked(true);
    report(union.size ? Math.round((100 * correct) / union.size) : 0);
  };
  const playBuilt = (which: 'mine' | 'solution') => {
    if (player.playing) return player.stop();
    player.start({ rows: which === 'mine' ? buildRows : pattern.rows, metronome: true, loops: 2 });
  };

  const modes: { id: Mode; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
    { id: 'listen', label: 'Hören & Sehen', icon: Ear, hint: 'Hör dir den Groove an und verfolge das Lauflicht. Tipp auf eine Zeile, um sie stumm zu schalten.' },
    { id: 'tap', label: 'Mitklopfen', icon: Hand, hint: `Nach dem Einzählen spielst du die Zeile «${target.label}». Tipp auf das Pad oder drück die Leertaste.` },
    { id: 'build', label: 'Nachbauen', icon: Puzzle, hint: `Hör gut hin und setz die Schläge für «${target.label}» selbst. Dann prüfen.` },
  ];
  const activeMode = modes.find((m) => m.id === mode)!;

  return (
    <div className="space-y-6">
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

      {player.countIn != null && (
        <div className="text-center text-6xl font-black text-brand tabular-nums" aria-live="assertive">{player.countIn}</div>
      )}

      <RhythmGrid
        pattern={pattern}
        rows={mode === 'build' ? buildRows : mode === 'listen' ? pattern.rows.filter((r) => !muted.includes(r.id)).concat(pattern.rows.filter((r) => muted.includes(r.id)).map((r) => ({ ...r, label: `${r.label} (stumm)` }))) : pattern.rows}
        current={player.step != null && player.step >= 0 ? player.step : null}
        targetRow={mode === 'listen' ? undefined : target.id}
        editable={mode === 'build'}
        onToggle={toggleBuilt}
        feedback={feedback}
        solution={mode === 'build' && checked ? target.steps : undefined}
      />

      {mode === 'listen' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {pattern.rows.map((r) => {
              const on = !muted.includes(r.id);
              return (
                <button key={r.id} onClick={() => { player.stop(); setMuted((m) => (on ? [...m, r.id] : m.filter((x) => x !== r.id))); }}
                  className={cn('flex items-center gap-2 px-3 h-8 rounded-full text-sm border', on ? 'border-white/30 text-white' : 'border-white/10 text-white/40 line-through')}>
                  <span className={cn('w-2.5 h-2.5 rounded-full', INSTRUMENT_COLOR[r.instrument])} /> {r.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button onClick={toggleListen} className="h-12 px-6">{player.playing ? <><Square className="w-4 h-4 mr-2" /> Stopp</> : <><Play className="w-4 h-4 mr-2" /> Abspielen</>}</Button>
            <label className="flex items-center gap-2 text-sm"><Switch checked={metronome} onCheckedChange={(v) => { player.stop(); setMetronome(v); }} /> Metronom</label>
          </div>
        </div>
      )}

      {mode === 'tap' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button onClick={player.playing ? player.stop : startTap} className="h-12 px-6">
              {player.playing ? <><Square className="w-4 h-4 mr-2" /> Abbrechen</> : <><Play className="w-4 h-4 mr-2" /> Start mit Einzählen</>}
            </Button>
          </div>
          <button type="button" onPointerDown={(e) => { e.preventDefault(); tap(); }} disabled={!player.playing}
            className={cn('w-full h-32 md:h-40 rounded-3xl border-2 text-xl font-black transition-all select-none touch-manipulation',
              player.playing ? 'border-brand bg-brand/15 text-white active:scale-[0.98]' : 'border-white/10 bg-white/[0.03] text-white/40',
              tapFlash && 'bg-brand/50 scale-[0.98]')}>
            {player.playing ? `Tippen: ${target.label}` : 'Zuerst «Start» drücken'}
          </button>
          {score != null && !player.playing && <ResultCard score={score} awarded={awarded} onAgain={startTap} />}
        </div>
      )}

      {mode === 'build' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => playBuilt('solution')}><Ear className="w-4 h-4 mr-2" /> Original hören</Button>
            <Button variant="outline" onClick={() => playBuilt('mine')}><Play className="w-4 h-4 mr-2" /> Meine Version</Button>
            <Button onClick={checkBuilt} disabled={built.length === 0}><CheckCircle2 className="w-4 h-4 mr-2" /> Prüfen</Button>
            <Button variant="ghost" onClick={() => { setBuilt([]); reset(); }}>Leeren</Button>
          </div>
          {checked && (
            <p className="text-sm text-white/70">Grün umrandet = richtig, rot = falsch, gestrichelt = fehlt. Lösung: {target.steps.map((s) => `${fullCountLabel(pattern, s)}${pattern.bars > 1 ? ` (T${Math.floor(s / (pattern.beatsPerBar * pattern.stepsPerBeat)) + 1})` : ''}`).join(', ')}</p>
          )}
          {score != null && <ResultCard score={score} awarded={awarded} onAgain={() => { setBuilt([]); reset(); }} />}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm text-white/70">Tempo: <span className="font-bold tabular-nums">{tempo} BPM</span>{tempo !== pattern.bpm && <button className="ml-2 text-brand underline" onClick={() => { player.stop(); setTempo(pattern.bpm); }}>Original ({pattern.bpm})</button>}</p>
        <Slider value={[tempo]} min={Math.round(pattern.bpm * 0.5)} max={Math.round(pattern.bpm * 1.2)} step={1} onValueChange={([v]) => { player.stop(); setTempo(v); }} aria-label="Tempo" />
      </div>

      <StyleCard pattern={pattern} />
      {totalSteps(pattern) > 16 && <p className="text-xs text-white/50">Dieses Pattern dauert {pattern.bars} Takte.</p>}
      {!user && <p className="text-xs text-white/50">Melde dich an, damit dein Ergebnis und deine Credits gespeichert werden.</p>}
    </div>
  );
}
