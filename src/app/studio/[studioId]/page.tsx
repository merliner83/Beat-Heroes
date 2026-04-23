"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useMemoFirebase, useCollection, useDoc, useUser } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Studio, Game, Level, LevelProgress } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, LayoutGrid, ChevronRight, Trophy, Loader2, Play, Pause, Music, Zap } from 'lucide-react';
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
      
      <div className="max-w-5xl mx-auto relative">
        <Link href="/" className="inline-flex items-center gap-2 text-[10px] opacity-40 hover:opacity-100 mb-8 md:mb-12 transition-all uppercase font-black tracking-[0.3em] group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Rack Hub
        </Link>

        {studio && (
          <div className="mb-12 md:mb-20">
            <div className="flex items-center gap-3 mb-4">
               {studio.district && (
                 <Badge variant="outline" className="border-primary/30 text-primary text-[8px] font-black uppercase tracking-widest bg-primary/5 px-3 py-1">
                   {studio.district}
                 </Badge>
               )}
               <div className="h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent" />
            </div>
            <h1 className="text-4xl md:text-8xl font-black mb-4 md:mb-6 uppercase italic tracking-tighter leading-none text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">
              {studio.name}
            </h1>
            <p className="text-sm md:text-lg opacity-50 font-medium max-w-2xl leading-relaxed">
              {studio.description}
            </p>
          </div>
        )}

        {/* Tracks Section */}
        {uniqueTracks.length > 0 && (
          <div className="mb-16 md:mb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-3 mb-8">
              <Music className="w-5 h-5 text-primary" />
              <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Studio Master Tracks</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {uniqueTracks.map((track, idx) => (
                <div key={idx} className="gemini-border p-4 bg-white/2 hover:bg-white/5 transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-black italic text-white/20">
                      0{idx + 1}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">Backing Track</p>
                      <h4 className="text-sm font-black italic uppercase tracking-tight group-hover:text-primary transition-colors">{track.name}</h4>
                    </div>
                  </div>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => toggleTrack(track.url)}
                    className={cn(
                      "w-12 h-12 rounded-full transition-all",
                      playingTrack === track.url ? "bg-primary text-white shadow-[0_0_20px_rgba(255,51,153,0.4)]" : "bg-white/5 hover:bg-white/10"
                    )}
                  >
                    {playingTrack === track.url ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Games Section */}
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-[#FFEA00]" />
              <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Active Rack Modules</h2>
            </div>
            {isLoadingLevels && <Loader2 className="w-4 h-4 animate-spin opacity-20" />}
          </div>
          
          <div className="grid grid-cols-1 gap-12">
            {games?.map((game) => {
              const gameLevels = allLevels?.filter(l => l.gameId === game.id) || [];
              const diffInfo = DIFFICULTY_MAP[game.difficulty || 1];

              return (
                <div key={game.id} className="relative group">
                  <div className="gemini-border p-6 md:p-12 bg-black/40 backdrop-blur-xl border border-white/5">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-4 mb-6">
                          <h3 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter leading-none group-hover:text-primary transition-colors">{game.name}</h3>
                          <Badge 
                            variant="outline" 
                            className="text-[10px] font-black tracking-widest py-1.5 px-4"
                            style={{ borderColor: diffInfo.color, color: diffInfo.color }}
                          >
                            {diffInfo.label}
                          </Badge>
                        </div>
                        <div className="flex gap-6 items-center">
                          <div className="flex flex-col">
                             <span className="text-[8px] font-black uppercase tracking-widest text-white/20 mb-1">Pulse Rate</span>
                             <span className="text-sm font-black italic text-[#FFEA00]">{game.bpm} BPM</span>
                          </div>
                          <div className="w-px h-8 bg-white/5" />
                          <div className="flex flex-col">
                             <span className="text-[8px] font-black uppercase tracking-widest text-white/20 mb-1">Module Type</span>
                             <span className="text-sm font-black italic text-white/40 uppercase tracking-tight">{game.type.replace('-', ' ')}</span>
                          </div>
                        </div>
                      </div>
                      <LayoutGrid className="w-12 h-12 opacity-5 text-primary group-hover:opacity-20 transition-all duration-700 rotate-12 group-hover:rotate-0" />
                    </div>

                    {/* Levels displayed directly in the card */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {gameLevels.sort((a,b) => a.difficulty - b.difficulty).map((level) => {
                        const progress = getLevelProgress(level.id);
                        return (
                          <Link 
                            key={level.id}
                            href={`/session/${level.id}`}
                            className="block"
                          >
                            <div className={cn(
                              "h-24 md:h-28 border-2 flex flex-col items-center justify-center gap-1 group/level transition-all rounded-2xl relative overflow-hidden",
                              progress ? "border-[#00E676]/30 bg-[#00E676]/5" : "border-white/5 bg-white/2 hover:bg-white/5 hover:border-white/10"
                            )}>
                              <span className="text-[8px] opacity-30 font-black uppercase tracking-[0.3em]">LVL {level.difficulty}</span>
                              <div className="text-[10px] md:text-xs flex items-center gap-1 uppercase italic font-black group-hover/level:text-primary transition-colors">
                                {level.name}
                                <ChevronRight className="w-3 h-3" />
                              </div>
                              {progress && (
                                <div className="mt-2 flex items-center gap-1 bg-[#00E676]/20 px-2 py-0.5 rounded-full border border-[#00E676]/30">
                                  <Trophy className="w-2.5 h-2.5 text-[#00E676]" />
                                  <span className="text-[9px] font-black text-[#00E676]">{progress.accuracy}%</span>
                                </div>
                              )}
                              {/* Background number pulse */}
                              <div className="absolute -bottom-2 -right-2 text-4xl font-black italic opacity-[0.03] select-none">{level.difficulty}</div>
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
