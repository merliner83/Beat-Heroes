"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import { doc, collection, query } from 'firebase/firestore';
import { Game, Level, Sound, TriggerPattern } from '@/lib/game/types';
import { GameView } from '@/components/game/GameView';
import { Loader2 } from 'lucide-react';

export default function PlayPage() {
  const { studioId, gameId, levelId } = useParams();
  const db = useFirestore();

  const gameRef = useMemoFirebase(() => gameId ? doc(db, 'games', gameId as string) : null, [db, gameId]);
  const { data: game } = useDoc<Game>(gameRef);

  const levelRef = useMemoFirebase(() => levelId ? doc(db, 'levels', levelId as string) : null, [db, levelId]);
  const { data: level } = useDoc<Level>(levelRef);

  const soundsQuery = useMemoFirebase(() => {
    if (!db || !levelId) return null;
    return query(collection(db, 'levels', levelId as string, 'sounds'));
  }, [db, levelId]);
  const { data: sounds } = useCollection<Sound>(soundsQuery);

  const patternsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'patterns'));
  }, [db]);
  const { data: patterns } = useCollection<TriggerPattern>(patternsQuery);

  if (!game || !level || !sounds || !patterns) {
    return (
      <div className="h-screen bg-[#050505] flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFEA00]" />
      </div>
    );
  }

  // Hier können später verschiedene Game-Views basierend auf game.type geladen werden
  if (game.type === 'rhythm-producer') {
    return (
      <div className="h-screen bg-[#050505]">
        <GameView game={game} level={level} sounds={sounds} patterns={patterns} />
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#050505] flex items-center justify-center text-white">
      <p className="uppercase font-black tracking-widest opacity-40">Unsupported Game Type: {game.type}</p>
    </div>
  );
}