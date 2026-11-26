'use client';

import React, { useState } from 'react';
import { doc } from 'firebase/firestore';
import { CheckCircle2, ClipboardCheck } from 'lucide-react';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { LearnApp } from '@/lib/game/types';
import { getPattern } from '@/lib/mv/patterns';
import { TEST_PASS_SCORE } from '@/lib/learn/tests';
import { MvRhythmExercise } from '@/components/mv/MvRhythmExercise';
import { KeysExerciseId, MvKeysExercise } from '@/components/mv/MvKeysExercise';
import { cn } from '@/lib/utils';

/**
 * Prüfung direkt in der Lektion (`GAME: appId | Beschriftung | pruefung`).
 * Zählt zum Bestehen der Lektion: Bestwert ab TEST_PASS_SCORE %.
 */
export function LessonTest({ appId, label }: { appId: string; label?: string }) {
  const db = useFirestore();
  const { user } = useUser();
  const appRef = useMemoFirebase(() => (db ? doc(db, 'learnApps', appId) : null), [db, appId]);
  const { data: app, isLoading } = useDoc<LearnApp>(appRef);
  const progressRef = useMemoFirebase(() => (db && user ? doc(db, 'users', user.uid, 'progress', appId) : null), [db, user, appId]);
  const { data: progress } = useDoc<{ accuracy?: number }>(progressRef);
  const [local, setLocal] = useState(0);
  const best = Math.max(progress?.accuracy ?? 0, local);
  const passed = best >= TEST_PASS_SCORE;
  const onResult = (score: number) => setLocal((b) => Math.max(b, score));

  // Rhythmus-Übungen liegen im Code; die ID folgt dem Schema learn-mv-<pattern>.
  const pattern = app?.type === 'mv-keys' ? undefined : getPattern(app?.exerciseId ?? appId.replace(/^learn-mv-/, ''));

  return (
    <section id={`pruefung-${appId}`} className={cn('scroll-mt-20 mb-10 rounded-3xl border-2 p-5 md:p-7', passed ? 'border-success/50 bg-success/[0.05]' : 'border-brand/50 bg-brand/[0.05]')}>
      <div className="flex flex-wrap items-start gap-3 mb-4">
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', passed ? 'bg-success/20' : 'bg-brand/20')}>
          {passed ? <CheckCircle2 className="w-6 h-6 text-success" /> : <ClipboardCheck className="w-6 h-6 text-brand" />}
        </div>
        <div className="flex-1 min-w-[12rem]">
          <p className={cn('text-xs font-semibold uppercase tracking-wider', passed ? 'text-success' : 'text-brand')}>
            Prüfung {passed ? '· bestanden' : `· ab ${TEST_PASS_SCORE} %`}
          </p>
          <p className="font-black text-lg leading-snug">{label || app?.name || 'Übung'}</p>
        </div>
        {best > 0 && <p className={cn('text-sm font-bold tabular-nums', passed ? 'text-success' : 'text-white/70')}>Bestwert {best} %</p>}
      </div>
      {isLoading && !pattern && <p className="text-sm text-white/60">Lädt …</p>}
      {pattern && <MvRhythmExercise pattern={pattern} appId={appId} embedded onResult={onResult} />}
      {app?.type === 'mv-keys' && app.exerciseId && <MvKeysExercise exercise={app.exerciseId as KeysExerciseId} appId={appId} onResult={onResult} />}
      {!isLoading && !pattern && app?.type !== 'mv-keys' && <p className="text-sm text-white/60">Diese Übung gibt es nicht (mehr).</p>}
    </section>
  );
}
