
"use client";

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, where, getDocs } from 'firebase/firestore';
import { Game, Level, Sound, TriggerPattern } from '@/lib/game/types';
import { GameView } from '@/components/game/GameView';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function GameSessionPage() {
  const { levelId } = useParams();
  const db = useFirestore();
  const router = useRouter();

  // 1. Fetch the level
  const levelRef = useMemoFirebase(() => levelId ? doc(db, 'levels', levelId as string) : null, [db, levelId]);
  const { data: level, isLoading: isLoadingLevel } = useDoc<Level>(levelRef);

  // 2. Fetch the associated game (once level is loaded)
  const gameRef = useMemoFirebase(() => level?.gameId ? doc(db, 'games', level.gameId) : null, [db, level?.gameId]);
  const { data: game, isLoading: isLoadingGame } = useDoc<Game>(gameRef);

  // 3. Fetch sounds for this level
  const soundsQuery = useMemoFirebase(() => {
    if (!db || !levelId) return null;
    return query(collection(db, 'levels', levelId as string, 'sounds'));
  }, [db, levelId]);
  const { data: sounds, isLoading: isLoadingSounds } = useCollection<Sound>(soundsQuery);

  // 4. Fetch patterns
  const patternsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'patterns'));
  }, [db]);
  const { data: patterns, isLoading: isLoadingPatterns } = useCollection<TriggerPattern>(patternsQuery);

  const isLoading = isLoadingLevel || isLoadingGame || isLoadingSounds || isLoadingPatterns;

  if (isLoading) {
    return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-center text-white gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#FFEA00]" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Syncing Beats...</p>
      </div>
    );
  }

  if (!level || !game) {
    return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-center text-white p-6 text-center">
        <AlertCircle className="w-16 h-16 text-destructive mb-6" />
        <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-2">Session Error</h2>
        <p className="text-sm opacity-50 mb-8 max-w-xs">The level or game configuration could not be found.</p>
        <Link href="/">
          <Button className="bg-white text-black font-black uppercase italic">Back to Map</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#050505] overflow-hidden">
      {sounds && patterns && (
        <GameView game={game} level={level} sounds={sounds} patterns={patterns} />
      )}
      {(!sounds || sounds.length === 0) && (
        <div className="h-full flex flex-col items-center justify-center text-white gap-4">
          <AlertCircle className="w-12 h-12 text-[#FF3D00] opacity-50" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">No instruments found for this level.</p>
          <Button variant="ghost" onClick={() => router.back()} className="text-xs uppercase font-bold tracking-widest opacity-60 hover:opacity-100">
            <ArrowLeft className="w-3 h-3 mr-2" /> Go Back
          </Button>
        </div>
      )}
    </div>
  );
}
