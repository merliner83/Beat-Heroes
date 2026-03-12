
"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import { doc, collection, query } from 'firebase/firestore';
import { Project, Level, Sound, TriggerPattern } from '@/lib/game/types';
import { GameView } from '@/components/game/GameView';
import { Loader2 } from 'lucide-react';

export default function PlayPage() {
  const { studioId, projectId, levelId } = useParams();
  const db = useFirestore();

  const projectRef = useMemoFirebase(() => projectId ? doc(db, 'projects', projectId as string) : null, [db, projectId]);
  const { data: project } = useDoc<Project>(projectRef);

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

  if (!project || !level || !sounds || !patterns) {
    return (
      <div className="h-screen bg-[#050505] flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFEA00]" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#050505]">
      <GameView project={project} level={level} sounds={sounds} patterns={patterns} />
    </div>
  );
}
