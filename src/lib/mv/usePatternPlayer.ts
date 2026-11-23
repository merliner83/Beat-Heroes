'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { mvSynth } from './synth';
import { PatternRow, RhythmPattern, rowNotes, totalSteps } from './patterns';

export type ScheduledHit = { time: number; step: number; loop: number };

type StartOptions = {
  rows: PatternRow[];
  /** Zeilen-IDs, die nicht klingen sollen */
  muted?: string[];
  /** Einzähl-Takte mit Klick */
  countInBars?: number;
  /** Anzahl Durchgänge (Infinity = Endlosschleife) */
  loops?: number;
  /** Klick auf allen Schlägen mitlaufen lassen */
  metronome?: boolean;
  /** Zeile, deren geplante Schläge für die Auswertung gesammelt werden */
  targetRow?: string;
  onEnd?: () => void;
};

const LOOKAHEAD = 0.12;
const TICK_MS = 25;

/**
 * Spielt ein Rhythmus-Pattern exakt im Takt (Web-Audio-Zeit) und liefert den
 * aktuell hörbaren Schritt fürs Lauflicht. step = -1 während des Einzählens.
 */
export function usePatternPlayer(pattern: RhythmPattern, bpm: number) {
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState<number | null>(null);
  const [countIn, setCountIn] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const raf = useRef<number | null>(null);
  const timeline = useRef<{ time: number; step: number; count: number | null }[]>([]);
  const targetHits = useRef<ScheduledHit[]>([]);
  const startTime = useRef(0);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (raf.current) cancelAnimationFrame(raf.current);
    timer.current = null;
    raf.current = null;
    setPlaying(false);
    setStep(null);
    setCountIn(null);
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(async (opts: StartOptions) => {
    stop();
    const ctx = await mvSynth.ensure();
    const stepDur = 60 / bpm / pattern.stepsPerBeat;
    const steps = totalSteps(pattern);
    const countInSteps = (opts.countInBars ?? 0) * pattern.beatsPerBar * pattern.stepsPerBeat;
    const loops = opts.loops ?? Infinity;
    const swingOffset = pattern.swing && pattern.stepsPerBeat % 2 === 0 ? ((pattern.swing - 50) / 50) * stepDur : 0;
    const muted = new Set(opts.muted ?? []);

    timeline.current = [];
    targetHits.current = [];
    let index = 0;
    let next = ctx.currentTime + 0.1;
    startTime.current = next;
    setPlaying(true);

    const schedule = () => {
      while (next < ctx.currentTime + LOOKAHEAD) {
        const rel = index - countInSteps;
        if (rel >= steps * loops) {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          const endAt = next;
          setTimeout(() => { stop(); opts.onEnd?.(); }, Math.max(0, (endAt - ctx.currentTime) * 1000) + 150);
          return;
        }
        const isCountIn = rel < 0;
        const s = isCountIn ? -1 : rel % steps;
        const loop = isCountIn ? -1 : Math.floor(rel / steps);
        const isBeat = (isCountIn ? index : s) % pattern.stepsPerBeat === 0;
        const off = !isCountIn && s % 2 === 1 ? swingOffset : 0;
        const t = next + off;

        if (isCountIn) {
          if (isBeat) mvSynth.play('click', t, { accent: index % (pattern.beatsPerBar * pattern.stepsPerBeat) === 0 });
          timeline.current.push({ time: t, step: -1, count: isBeat ? Math.floor(index / pattern.stepsPerBeat) % pattern.beatsPerBar + 1 : null });
        } else {
          if (opts.metronome && isBeat) mvSynth.play('click', t, { accent: s % (pattern.beatsPerBar * pattern.stepsPerBeat) === 0 });
          for (const row of opts.rows) {
            if (!row.steps.includes(s)) continue;
            if (row.id === opts.targetRow) targetHits.current.push({ time: t, step: s, loop });
            if (muted.has(row.id)) continue;
            const n = row.rolls?.[s] ?? 1;
            for (let r = 0; r < n; r++) {
              mvSynth.play(row.instrument, t + (r * stepDur) / n, { accent: row.accents?.includes(s), notes: rowNotes(row, s), dur: stepDur * 1.6 });
            }
          }
          timeline.current.push({ time: t, step: s, count: null });
        }
        index++;
        next += stepDur;
      }
    };

    schedule();
    timer.current = setInterval(schedule, TICK_MS);

    const draw = () => {
      const now = ctx.currentTime;
      const tl = timeline.current;
      let current: (typeof tl)[number] | undefined;
      for (let i = tl.length - 1; i >= 0; i--) {
        if (tl[i].time <= now) { current = tl[i]; break; }
      }
      if (current) {
        setStep(current.step);
        if (current.step === -1) {
          if (current.count) setCountIn(current.count);
        } else {
          setCountIn(null);
        }
      }
      if (tl.length > 400) timeline.current = tl.slice(-200);
      raf.current = requestAnimationFrame(draw);
    };
    raf.current = requestAnimationFrame(draw);
  }, [bpm, pattern, stop]);

  return { playing, step, countIn, start, stop, targetHits, stepDur: 60 / bpm / pattern.stepsPerBeat };
}
