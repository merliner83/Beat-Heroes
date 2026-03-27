"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useMemoFirebase, useCollection, useDoc, useUser } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Studio, Game, Level, LevelProgress } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, LayoutGrid, ChevronRight, Trophy, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const DIFFICULTY_MAP: Record<number, { label: string, color: string }> = {
  1: { label: 'BEGINNER', color: '#00E676' },
  2: { label: 'SKILLED', color: '#FFEA00' },
  3: { label: 'PRO', color: '#EB3D99' },
  4: { label: 'HERO', color: '#FF3D00' },
};

export default function StudioPage() {
  const { studioId } = useParams();
  const db = useFirestore();
  const { user } = useUser();

  const studioRef = useMemoFirebase(() => studioId ? doc(db, 'studios', studioId as string) : null, [db, studioId]);
  const { data: studio } = useDoc<Studio>(studioRef);

  const gamesQuery = useMemoFirebase(() => {
    if (!db || !studioId) return null;
    return query(collection(db, 'games'), where('studioId', '==', studioId));
  }, [db, studioId]);
  const { data: games } = useCollection<Game>(gamesQuery);

  const [selectedGameId, setSelectedGameId] = React.useState<string | null>(null);

  const allLevelsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'levels'));
  }, [db]);
  const { data: allLevels, isLoading: isLoadingLevels } = useCollection<Level>(allLevelsQuery);

  const progressQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'users', user.uid, 'progress'));
  }, [db, user]);
  const { data: userProgress } = useCollection<LevelProgress>(progressQuery);

  const getLevelProgress = (levelId: string) => {
    return userProgress?.find(p => p.levelId === levelId);
  };

  const calculateGameProgress = (gameId: string) => {
    if (!allLevels || !userProgress) return 0;
    const gameLevels = allLevels.filter(l => l.gameId === gameId);
    if (gameLevels.length === 0) return 0;
    const completedCount = gameLevels.filter(l => getLevelProgress(l.id)).length;
    return Math.round((completedCount / gameLevels.length) * 100);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 font-body">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-xs opacity-50 hover:opacity-100 mb-12 transition-opacity uppercase font-bold tracking-widest">
          <ArrowLeft className="w-4 h-4" /> Back to Hub
        </Link>

        {studio && (
          <div className="mb-16">
            <h1 className="text-4xl md:text-7xl font-black mb-3 uppercase italic tracking-tighter leading-none">{studio.name}</h1>
            <p className="text-base md:text-xl opacity-50 font-medium max-w-2xl">{studio.description}</p>
          </div>
        )}

        <div className="space-y-10">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Studio Projects</h2>
            {isLoadingLevels && <Loader2 className="w-4 h-4 animate-spin opacity-20" />}
          </div>
          
          <div className="space-y-8">
            {games?.map((game) => {
              const isSelected = selectedGameId === game.id;
              const progressPercent = calculateGameProgress(game.id);
              const gameLevels = allLevels?.filter(l => l.gameId === game.id) || [];
              const diffInfo = DIFFICULTY_MAP[game.difficulty || 1];

              return (
                <div key={game.id} className="space-y-6">
                  <div 
                    onClick={() => setSelectedGameId(isSelected ? null : game.id)}
                    className="cursor-pointer group"
                  >
                    <div className={cn(
                      "gemini-border p-6 md:p-10 transition-all",
                      isSelected ? "bg-white/5" : "hover:bg-white/2"
                    )}>
                      <div className="flex justify-between items-start mb-8">
                        <div>
                          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                            <h3 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter leading-none">{game.name}</h3>
                            <div 
                              className="px-3 py-1 rounded-lg border-2 text-[8px] md:text-[10px] font-black tracking-widest italic"
                              style={{ borderColor: diffInfo.color, color: diffInfo.color }}
                            >
                              {diffInfo.label}
                            </div>
                          </div>
                          <div className="flex gap-4">
                            <p className="text-[10px] font-black tracking-[0.2em] uppercase text-[#FFEA00]">{game.bpm} BPM</p>
                            <p className="text-[10px] font-black tracking-[0.2em] uppercase text-white/30">{game.type.replace('-', ' ')}</p>
                          </div>
                        </div>
                        <LayoutGrid className={cn("w-8 h-8 transition-all", isSelected ? "text-[#FFEA00]" : "opacity-10")} />
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-end">
                          <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30">Completion</span>
                          <span className="text-xs font-black italic text-[#FFEA00]">{progressPercent}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className="h-full transition-all duration-1000 ease-out"
                            style={{ 
                              width: `${progressPercent}%`,
                              background: 'linear-gradient(90deg, #993DEB 0%, #FF3D00 100%)'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in slide-in-from-top-4 duration-300">
                      {gameLevels.sort((a,b) => a.difficulty - b.difficulty).map((level) => {
                        const progress = getLevelProgress(level.id);
                        return (
                          <Link 
                            key={level.id}
                            href={`/session/${level.id}`}
                            className="block"
                          >
                            <Button
                              variant="ghost"
                              className={cn(
                                "w-full h-24 md:h-32 border-2 hover:bg-white/5 flex flex-col items-center justify-center gap-1 group transition-all rounded-2xl",
                                progress ? "border-[#00E676]/30 bg-[#00E676]/5" : "border-white/5"
                              )}
                            >
                              <span className="text-[8px] opacity-40 font-black uppercase tracking-[0.2em]">LVL {level.difficulty}</span>
                              <div className="text-xs md:text-sm flex items-center gap-1 uppercase italic font-black group-hover:text-[#FFEA00]">
                                {level.name}
                                <ChevronRight className="w-3 h-3" />
                              </div>
                              {progress && (
                                <div className="mt-2 flex items-center gap-1.5 bg-[#00E676]/20 px-2 py-0.5 rounded-full">
                                  <Trophy className="w-2.5 h-2.5 text-[#00E676]" />
                                  <span className="text-[8px] font-black text-[#00E676]">{progress.accuracy}%</span>
                                </div>
                              )}
                            </Button>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
