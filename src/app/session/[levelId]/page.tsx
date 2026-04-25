
"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useMemoFirebase, useDoc, useCollection, useUser } from '@/firebase';
import { doc, collection, query } from 'firebase/firestore';
import { Game, Level, Sound, TriggerPattern, hasAccess, LearnApp } from '@/lib/game/types';
import { GameView } from '@/components/game/GameView';
import { SampleHunterView } from '@/components/game/SampleHunterView';
import { DiskDashView } from '@/components/game/DiskDashView';
import { EarTrainingView } from '@/components/game/EarTrainingView';
import { RhythmTrainerView } from '@/components/game/RhythmTrainerView';
import { Loader2, AlertCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function GameSessionPage() {
  const { levelId } = useParams();
  const db = useFirestore();
  const { profile, isUserLoading } = useUser();

  // Handle both game levels and learn apps
  const isLearnApp = (levelId as string)?.startsWith('learn-');

  const levelRef = useMemoFirebase(() => !isLearnApp && levelId ? doc(db, 'levels', levelId as string) : null, [db, levelId, isLearnApp]);
  const { data: level } = useDoc<Level>(levelRef);

  const gameRef = useMemoFirebase(() => !isLearnApp && level?.gameId ? doc(db, 'games', level.gameId) : null, [db, level?.gameId, isLearnApp]);
  const { data: game } = useDoc<Game>(gameRef);

  const learnAppRef = useMemoFirebase(() => isLearnApp ? doc(db, 'learnApps', levelId as string) : null, [db, levelId, isLearnApp]);
  const { data: learnApp, isLoading: isLoadingLearnApp } = useDoc<LearnApp>(learnAppRef);

  const soundsQuery = useMemoFirebase(() => {
    if (!db || !levelId || isLearnApp) return null;
    return query(collection(db, 'levels', levelId as string, 'sounds'));
  }, [db, levelId, isLearnApp]);
  const { data: sounds } = useCollection<Sound>(soundsQuery);

  const patternsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'patterns'));
  }, [db]);
  const { data: patterns } = useCollection<TriggerPattern>(patternsQuery);

  const activeModule = isLearnApp ? learnApp : game;
  const isLocked = activeModule && !hasAccess(profile?.role, activeModule.minRole || 'free');

  if (isUserLoading || (isLearnApp && isLoadingLearnApp)) {
    return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-center text-white gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#FFEA00]" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Connecting to Rack...</p>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-center text-white p-6 text-center">
        <Lock className="w-16 h-16 text-primary mb-6" />
        <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-2 text-gradient">Access Denied</h2>
        <p className="text-sm opacity-50 mb-8 max-w-xs font-medium uppercase tracking-widest">
          {activeModule?.minRole?.toUpperCase()} Authorization Required
        </p>
        <Link href="/">
          <Button className="bg-white text-black font-black uppercase italic rounded-full px-12 h-14">Back to Hub</Button>
        </Link>
      </div>
    );
  }

  if (isLearnApp && learnApp) {
    const dummyLevel = { id: learnApp.id, gameId: learnApp.id, difficulty: 1, name: learnApp.name };
    const dummyGame = { id: learnApp.id, studioId: 'learn', name: learnApp.name, type: learnApp.type };
    return (
      <div className="h-screen bg-[#050505] overflow-hidden">
        {learnApp.type === 'ear-training' ? (
          <EarTrainingView game={dummyGame as any} level={dummyLevel} />
        ) : (
          <RhythmTrainerView game={dummyGame as any} level={dummyLevel} />
        )}
      </div>
    );
  }

  if (!level || !game) {
    return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-center text-white p-6 text-center">
        <AlertCircle className="w-16 h-16 text-destructive mb-6" />
        <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-2">Sync Error</h2>
        <p className="text-sm opacity-50 mb-8 max-w-xs">Module not found in this studio session.</p>
        <Link href="/">
          <Button className="bg-white text-black font-black uppercase italic">Back to Hub</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#050505] overflow-hidden">
      {game.type === 'sample-hunter' ? (
        <SampleHunterView game={game} level={level} sounds={sounds || []} />
      ) : game.type === 'disk-dash' ? (
        <DiskDashView game={game} level={level} sounds={sounds || []} />
      ) : (
        <GameView game={game} level={level} sounds={sounds || []} patterns={patterns || []} />
      )}
    </div>
  );
}
