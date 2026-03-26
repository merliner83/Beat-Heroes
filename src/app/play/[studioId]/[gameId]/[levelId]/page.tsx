
"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import { doc, collection, query } from 'firebase/firestore';
import { Game, Level, Sound, TriggerPattern } from '@/lib/game/types';
import { GameView } from '@/components/game/GameView';
import { SampleHunterView } from '@/components/game/SampleHunterView';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function GamePlayPage() {
  const { studioId, gameId, levelId } = useParams();
  const db = useFirestore();

  const gameRef = useMemoFirebase(() => gameId ? doc(db, 'games', gameId as string) : null, [db, gameId]);
  const { data: game, isLoading: isLoadingGame } = useDoc<Game>(gameRef);

  const levelRef = useMemoFirebase(() => levelId ? doc(db, 'levels', levelId as string) : null, [db, levelId]);
  const { data: level, isLoading: isLoadingLevel } = useDoc<Level>(levelRef);

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

  const isLoading = isLoadingGame || isLoadingLevel || isLoadingSounds || isLoadingPatterns;

  if (isLoading) {
    return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-center text-white gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#FFEA00]" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Loading Game Assets...</p>
      </div>
    );
  }

  if (!game || !level) {
    return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-center text-white p-6 text-center">
        <AlertCircle className="w-16 h-16 text-destructive mb-6" />
        <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-2">Session Not Found</h2>
        <p className="text-sm opacity-50 mb-8 max-w-xs">Data sync error. Please return to studio.</p>
        <Link href="/">
          <Button className="bg-white text-black font-black uppercase italic">Back to Map</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#050505]">
      {game.type === 'rhythm-producer' && sounds && patterns && (
        <GameView game={game} level={level} sounds={sounds} patterns={patterns} />
      )}
      {game.type === 'sample-hunter' && sounds && patterns && (
        <SampleHunterView game={game} level={level} sounds={sounds} patterns={patterns} />
      )}
      {(!sounds || sounds.length === 0) && (
        <div className="h-full flex flex-col items-center justify-center text-white gap-4">
          <AlertCircle className="w-12 h-12 text-[#FF3D00] opacity-50" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Missing triggers for this level.</p>
        </div>
      )}
    </div>
  );
}
