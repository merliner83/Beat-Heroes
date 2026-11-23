'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { Instrument } from '@/lib/mv/synth';
import { PatternRow, RhythmPattern, countLabel, fullCountLabel } from '@/lib/mv/patterns';

export const INSTRUMENT_COLOR: Record<Instrument, string> = {
  kick: 'bg-brand', snare: 'bg-warning', clap: 'bg-warning', rim: 'bg-credit',
  hat: 'bg-info', openhat: 'bg-info', ride: 'bg-info', shaker: 'bg-info',
  clave: 'bg-credit', cowbell: 'bg-warning', click: 'bg-white', bass: 'bg-violet', chord: 'bg-success', piano: 'bg-success',
};

export type CellFeedback = 'hit' | 'miss';

type Props = {
  pattern: RhythmPattern;
  rows: PatternRow[];
  current: number | null;
  /** Zeile, die hervorgehoben wird (Mitklopfen/Nachbauen) */
  targetRow?: string;
  /** Nachbauen: Klick auf Zellen der Zielzeile schaltet um */
  editable?: boolean;
  onToggle?: (step: number) => void;
  /** Rückmeldung pro Schritt für die Zielzeile */
  feedback?: Record<number, CellFeedback>;
  /** Richtige Lösung zeigen (nach dem Prüfen) */
  solution?: number[];
};

export function RhythmGrid({ pattern, rows, current, targetRow, editable, onToggle, feedback, solution }: Props) {
  const perBar = pattern.beatsPerBar * pattern.stepsPerBeat;
  const bars = Array.from({ length: pattern.bars }, (_, b) => b);
  const cols = `minmax(0,1fr)`;

  return (
    <div className="space-y-4" role="group" aria-label={`Rhythmus-Raster ${pattern.title}`}>
      {bars.map((bar) => {
        const stepsInBar = Array.from({ length: perBar }, (_, i) => bar * perBar + i);
        return (
          <div key={bar} className="rounded-2xl border border-white/10 bg-black/40 p-3 md:p-4 overflow-x-auto">
            {pattern.bars > 1 && <p className="text-xs text-white/60 mb-2">Takt {bar + 1}</p>}
            <div className="grid gap-x-1 gap-y-2 min-w-[18rem]" style={{ gridTemplateColumns: `minmax(4.5rem,7rem) repeat(${perBar}, ${cols})` }}>
              {/* Zählzeiten */}
              <div />
              {stepsInBar.map((s) => {
                const isBeat = s % pattern.stepsPerBeat === 0;
                return (
                  <div key={`c${s}`} className={cn(
                    'text-center text-xs tabular-nums rounded-md py-1 transition-colors',
                    isBeat ? 'font-bold text-white' : 'text-white/50',
                    current === s && 'bg-white text-black',
                  )}>
                    {countLabel(pattern, s)}
                  </div>
                );
              })}

              {/* Instrument-Zeilen */}
              {rows.map((row) => {
                const isTarget = row.id === targetRow;
                return (
                  <React.Fragment key={row.id}>
                    <div className={cn('text-xs md:text-sm truncate self-center pr-2', isTarget ? 'font-bold text-white' : 'text-white/70')} title={row.label}>
                      {row.label}
                    </div>
                    {stepsInBar.map((s) => {
                      const on = row.steps.includes(s);
                      const isBeat = s % pattern.stepsPerBeat === 0;
                      const fb = isTarget ? feedback?.[s] : undefined;
                      const missingSolution = isTarget && solution?.includes(s) && !on;
                      const roll = row.rolls?.[s];
                      const cell = (
                        <div className={cn(
                          'relative aspect-square w-full rounded-md border transition-all',
                          isBeat ? 'border-white/20' : 'border-white/10',
                          on ? INSTRUMENT_COLOR[row.instrument] : isBeat ? 'bg-white/[0.08]' : 'bg-white/[0.03]',
                          on && current === s && 'scale-110 brightness-125 shadow-[0_0_12px_rgba(255,255,255,0.5)]',
                          !on && current === s && 'bg-white/25',
                          isTarget && !on && editable && 'hover:bg-white/20',
                          fb === 'hit' && 'ring-2 ring-success ring-offset-1 ring-offset-black',
                          fb === 'miss' && 'ring-2 ring-destructive ring-offset-1 ring-offset-black',
                          missingSolution && 'border-dashed border-2 border-success',
                        )}>
                          {roll && on && <span className="absolute inset-0 flex items-center justify-center text-[0.6rem] font-bold text-black">×{roll}</span>}
                        </div>
                      );
                      return isTarget && editable ? (
                        <button key={`${row.id}${s}`} type="button" onClick={() => onToggle?.(s)} aria-pressed={on}
                          aria-label={`${row.label} auf ${fullCountLabel(pattern, s)}${pattern.bars > 1 ? `, Takt ${Math.floor(s / perBar) + 1}` : ''}`}>
                          {cell}
                        </button>
                      ) : <div key={`${row.id}${s}`}>{cell}</div>;
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
