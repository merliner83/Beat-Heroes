'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/** Deutsche Notennamen (H statt B; B = erniedrigtes H). */
const NAMES = ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'Ais', 'H'];
const FLAT = ['', 'Des', '', 'Es', '', '', 'Ges', '', 'As', '', 'B', ''];
const BLACK = new Set([1, 3, 6, 8, 10]);

export function noteName(midi: number, withOctave = false) {
  const n = NAMES[midi % 12];
  return withOctave ? `${n}${Math.floor(midi / 12) - 1}` : n;
}

export function noteNameBoth(midi: number) {
  const pc = midi % 12;
  return FLAT[pc] ? `${NAMES[pc]}/${FLAT[pc]}` : NAMES[pc];
}

export const isBlack = (midi: number) => BLACK.has(midi % 12);

export type KeyMark = 'brand' | 'success' | 'error' | 'info';

const MARK: Record<KeyMark, string> = {
  brand: 'bg-brand text-white',
  success: 'bg-success text-black',
  error: 'bg-destructive text-white',
  info: 'bg-info text-black',
};

type Props = {
  from: number;
  to: number;
  marks?: Record<number, KeyMark>;
  /** Beschriftung: alle weissen Tasten, nur markierte oder keine */
  labels?: 'white' | 'marked' | 'none';
  onPress?: (midi: number) => void;
  disabled?: boolean;
};

/** Klaviatur; Tasten sind Buttons (Tastatur- und Screenreader-tauglich). */
export function PianoKeyboard({ from, to, marks = {}, labels = 'white', onPress, disabled }: Props) {
  const keys = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const whites = keys.filter((k) => !isBlack(k));
  const whiteWidth = 100 / whites.length;

  return (
    <div className="relative w-full select-none" style={{ height: '11rem' }} role="group" aria-label="Klaviatur">
      {whites.map((k, i) => {
        const mark = marks[k];
        const showLabel = labels === 'white' || (labels === 'marked' && mark);
        return (
          <button key={k} type="button" disabled={disabled} onPointerDown={(e) => { e.preventDefault(); onPress?.(k); }}
            aria-label={noteName(k, true)}
            className={cn('absolute top-0 bottom-0 rounded-b-lg border border-black/40 flex items-end justify-center pb-2 text-sm font-bold transition-colors touch-manipulation',
              mark ? MARK[mark] : 'bg-white text-black/60 hover:bg-white/85', disabled && 'cursor-default')}
            style={{ left: `${i * whiteWidth}%`, width: `${whiteWidth}%` }}>
            {showLabel ? noteName(k) : ''}
          </button>
        );
      })}
      {keys.filter(isBlack).map((k) => {
        const leftWhite = whites.filter((w) => w < k).length;
        const mark = marks[k];
        return (
          <button key={k} type="button" disabled={disabled} onPointerDown={(e) => { e.preventDefault(); onPress?.(k); }}
            aria-label={noteNameBoth(k)}
            className={cn('absolute top-0 z-10 rounded-b-md border border-black flex items-end justify-center pb-1.5 text-[0.65rem] font-bold leading-tight transition-colors touch-manipulation',
              mark ? MARK[mark] : 'bg-neutral-900 text-white/60 hover:bg-neutral-700')}
            style={{ left: `${leftWhite * whiteWidth - whiteWidth * 0.32}%`, width: `${whiteWidth * 0.64}%`, height: '62%' }}>
            {labels === 'marked' && mark ? noteName(k) : ''}
          </button>
        );
      })}
    </div>
  );
}
