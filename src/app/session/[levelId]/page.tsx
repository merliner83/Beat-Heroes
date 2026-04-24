
"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useMemoFirebase, useDoc, useCollection, useUser } from '@/firebase';
import { doc, collection, query } from 'firebase/firestore';
import { Game, Level, Sound, TriggerPattern } from '@/lib/game/types';
import { GameView } from '@/components/game/GameView';
import { SampleHunterView } from '@/components/game/SampleHunterView';
import { DiskDashView } from '@/components/game/DiskDashView';
import { EarTrainingView } from '@/components/game/EarTrainingView';
import { Loader2, AlertCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function GameSessionPage() {
  const { levelId } = useParams();
  const db = useFirestore();
  const { profile, isUserLoading } = useUser();

  const levelRef = useMemoFirebase(() => levelId ? doc(db, 'levels', levelId as string) : null, [db, levelId]);
  const { data: level, isLoading: isLoadingLevel } = useDoc<Level>(levelRef);

  const gameRef = useMemoFirebase(() => level?.gameId ? doc(db, 'games', level.gameId) : null, [db, level?.gameId]);
  const { data: game, isLoading: isLoadingGame } = useDoc<Game>(gameRef);

  const soundsQuery = useMemoFirebase(() => {
    if (!db || !levelId) return null;
    return query(collection(db, 'levels', levelId as string, 'sounds'));
  }, [db, levelId]);
  const { data: sounds, isLoading: isLoadingSounds } = useCollection<Sound>(soundsQuery);

  const patternsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'patterns'));
  }, [db]);
  const { data: patterns, isLoading: isLoadingPatterns } = useCollection<TriggerPattern>(patternsQuery);

  const isAdmin = profile?.role === 'admin';
  const isRestrictedGame = game?.id === 'global-rhythm-game' || game?.id === 'global-notation-pro';
  const isLocked = isRestrictedGame && !isAdmin;

  const isLoading = isUserLoading || isLoadingLevel || isLoadingGame || (game?.type !== 'ear-training' && (isLoadingSounds || isLoadingPatterns));

  if (isLoading) {
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
        <p className="text-sm opacity-50 mb-8 max-w-xs font-medium uppercase tracking-widest">Admin Authorization Required</p>
        <Link href="/">
          <Button className="bg-white text-black font-black uppercase italic rounded-full px-12 h-14">Back to Hub</Button>
        </Link>
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
      {game.type === 'ear-training' ? (
        <EarTrainingView game={game} level={level} />
      ) : sounds ? (
        game.type === 'sample-hunter' ? (
          <SampleHunterView game={game} level={level} sounds={sounds} />
        ) : game.type === 'disk-dash' ? (
          <DiskDashView game={game} level={level} sounds={sounds} />
        ) : (
          <GameView game={game} level={level} sounds={sounds} patterns={patterns || []} />
        )
      ) : null}
    </div>
  );
}
