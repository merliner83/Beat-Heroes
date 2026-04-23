"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useMemoFirebase, useCollection, useDoc, useUser } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Studio, Game, Level, LevelProgress } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronRight, Trophy, Loader2, Play, Pause, Music, Zap } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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

  // Audio state for track preview
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  const [audio] = useState(() => typeof Audio !== 'undefined' ? new Audio() : null);

  const toggleTrack = (url: string) => {
    if (!audio) return;
    if (playingTrack === url) {
      audio.pause();
      setPlayingTrack(null);
    } else {
      audio.src = `/api/proxy-audio?url=${encodeURIComponent(url)}`;
      audio.play();
      setPlayingTrack(url);
    }
  };

  useEffect(() => {
    if (!audio) return;
    const handleEnded = () => setPlayingTrack(null);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
    };
  }, [audio]);

  const uniqueTracks = useMemo(() => {
    if (!games) return [];
    const tracks = new Map();
    games.forEach(g => {
      if (g.backingTrackUrl) {
        tracks.set(g.backingTrackUrl, g.name);
      }
    });
    return Array.from(tracks.entries()).map(([url, name]) => ({ url, name }));
  }, [games]);

  const getLevelProgress = (levelId: string) => {
    return userProgress?.find(p => p.levelId === levelId);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-12 font-body selection:bg-primary selection:text-white">
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#FF3399 1.5px, transparent 1.5px)', backgroundSize: '40px 40px' }} />
      
      <div className="max-w-4xl mx-auto relative">
        <Link href="/" className="inline-flex items-center gap-2 text-[10px] opacity-40 hover:opacity-100 mb-6 md:mb-8 transition-all uppercase font-black tracking-[0.3em] group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back
        </Link>

        {studio && (
          <div className="mb-10 md:mb-14">
            <div className="flex items-center gap-3 mb-3">
               {studio.district && (
                 <Badge variant="outline" className="border-primary/30 text-primary text-[8px] font-black uppercase tracking-widest bg-primary/5 px-2 py-0.5">
                   {studio.district}
                 </Badge>
               )}
               <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
            </div>
            <h1 className="text-3xl md:text-6xl font-black mb-3 md:mb-4 uppercase italic tracking-tighter leading-none text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.05)]">
              {studio.name}
            </h1>
            <p className="text-xs md:text-sm opacity-40 font-medium max-w-xl leading-relaxed">
              {studio.description}
            </p>
          </div>
        )}

        {/* Tracks Section */}
        {uniqueTracks.length > 0 && (
          <div className="mb-12 md:mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-2 mb-6">
              <Music className="w-4 h-4 text-primary" />
              <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-white">TRACKS</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {uniqueTracks.map((track, idx) => (
                <div key={idx} className="p-3 bg-white/2 border border-white/5 hover:bg-white/5 transition-all flex items-center justify-between group rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[9px] font-black italic text-white/20">
                      {(idx + 1).toString().padStart(2, '0')}
                    </div>
                    <div>
                      <h4 className="text-xs font-black italic uppercase tracking-tight group-hover:text-primary transition-colors">{track.name}</h4>
                    </div>
                  </div>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => toggleTrack(track.url)}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all",
                      playingTrack === track.url ? "bg-primary text-white shadow-[0_0_15px_rgba(255,51,153,0.3)]" : "bg-white/5 hover:bg-white/10"
                    )}
                  >
                    {playingTrack === track.url ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Games Section */}
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#FFEA00]" />
              <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-white">GAMES</h2>
            </div>
            {isLoadingLevels && <Loader2 className="w-3 h-3 animate-spin opacity-20" />}
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            {games?.map((game) => {
              const gameLevels = allLevels?.filter(l => l.gameId === game.id) || [];
              const diffInfo = DIFFICULTY_MAP[game.difficulty || 1];

              return (
                <div key={game.id} className="relative group">
                  <div className="p-5 md:p-8 bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl md:rounded-[2.5rem]">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                          <h3 className="text-xl md:text-3xl font-black uppercase italic tracking-tighter leading-none group-hover:text-primary transition-colors">{game.name}</h3>
                          <Badge 
                            variant="outline" 
                            className="text-[8px] font-black tracking-widest py-1 px-3"
                            style={{ borderColor: diffInfo.color, color: diffInfo.color }}
                          >
                            {diffInfo.label}
                          </Badge>
                        </div>
                        <div className="flex gap-4 items-center">
                          <div className="flex flex-col">
                             <span className="text-[7px] font-black uppercase tracking-widest text-white/20">Pulse</span>
                             <span className="text-xs font-black italic text-[#FFEA00]">{game.bpm} BPM</span>
                          </div>
                          <div className="w-px h-6 bg-white/5" />
                          <div className="flex flex-col">
                             <span className="text-[7px] font-black uppercase tracking-widest text-white/20">Type</span>
                             <span className="text-xs font-black italic text-white/30 uppercase tracking-tight">{game.type.replace('-', ' ')}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Levels displayed directly in the card */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {gameLevels.sort((a,b) => a.difficulty - b.difficulty).map((level) => {
                        const progress = getLevelProgress(level.id);
                        return (
                          <Link 
                            key={level.id}
                            href={`/session/${level.id}`}
                            className="block"
                          >
                            <div className={cn(
                              "h-16 md:h-20 border flex flex-col items-center justify-center gap-1 group/level transition-all rounded-xl relative overflow-hidden",
                              progress ? "border-[#00E676]/30 bg-[#00E676]/5" : "border-white/5 bg-white/2 hover:bg-white/5 hover:border-white/10"
                            )}>
                              <span className="text-[7px] opacity-30 font-black uppercase tracking-[0.2em]">LVL {level.difficulty}</span>
                              <div className="text-[9px] md:text-[10px] flex items-center gap-1 uppercase italic font-black group-hover/level:text-primary transition-colors">
                                {level.name}
                                <ChevronRight className="w-2.5 h-2.5" />
                              </div>
                              {progress && (
                                <div className="mt-1 flex items-center gap-1 bg-[#00E676]/20 px-1.5 py-0.5 rounded-full border border-[#00E676]/30">
                                  <Trophy className="w-2 h-2 text-[#00E676]" />
                                  <span className="text-[8px] font-black text-[#00E676]">{progress.accuracy}%</span>
                                </div>
                              )}
                              <div className="absolute -bottom-1 -right-1 text-2xl font-black italic opacity-[0.02] select-none">{level.difficulty}</div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
