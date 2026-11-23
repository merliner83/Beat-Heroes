'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { LearnApp } from '@/lib/game/types';
import { getPattern } from '@/lib/mv/patterns';
import { Tag } from '@/components/ds';
import { MvRhythmExercise } from './MvRhythmExercise';
import { KeysExerciseId, MvKeysExercise } from './MvKeysExercise';

/** Ganze Seite für eine MV-Übung (aus learnApps mit type mv-rhythm / mv-keys). */
export function MvExercisePage({ app }: { app: LearnApp }) {
  const router = useRouter();
  const pattern = app.type === 'mv-rhythm' && app.exerciseId ? getPattern(app.exerciseId) : undefined;

  const back = () => {
    if (window.history.length > 1) router.back();
    else router.push('/learn/mv');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="sticky top-0 z-40 bg-black/85 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto flex items-center gap-3 px-4 md:px-6 h-16">
          <button onClick={back} className="p-2 -ml-2 rounded-full hover:bg-white/5" aria-label="Zurück"><ArrowLeft className="w-5 h-5" /></button>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">MV-Übung</p>
            <h1 className="h-display text-lg md:text-2xl truncate">{app.name}</h1>
          </div>
          {pattern && <div className="hidden sm:flex gap-2"><Tag tone="brand">{pattern.style}</Tag><Tag>{pattern.meter}</Tag></div>}
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-10 pb-24">
        {app.description && <p className="text-white/70 mb-6 max-w-3xl">{app.description}</p>}
        {pattern && <MvRhythmExercise pattern={pattern} appId={app.id} />}
        {app.type === 'mv-keys' && app.exerciseId && <MvKeysExercise exercise={app.exerciseId as KeysExerciseId} appId={app.id} />}
        {!pattern && app.type === 'mv-rhythm' && <p className="text-white/60">Diese Übung gibt es nicht (mehr).</p>}
      </main>
    </div>
  );
}
