
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useMemoFirebase, useCollection, useDoc, useUser } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Studio, Game, Level, LevelProgress, Track } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ChevronRight, Trophy, Loader2, Play, Pause, Music, Zap, ExternalLink } from 'lucide-react';
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

  const tracksQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'tracks'));
  }, [db]);
  const { data: allTracks } = useCollection<Track>(tracksQuery);

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

  const studioTracks = useMemo(() => {
    if (!games || !allTracks) return [];
    const usedTrackIds = new Set(games.map(g => g.trackId).filter(Boolean));
    return allTracks.filter(t => usedTrackIds.has(t.id));
  }, [games, allTracks]);

  const getTrackName = (game: Game) => {
    if (game.trackId && allTracks) {
      const track = allTracks.find(t => t.id === game.trackId);
      if (track) return track.name;
    }
    return game.backingTrackUrl?.split('/').pop()?.replace('.ogg', '') || 'Generic Track';
  };

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
          <div className="mb-8 md:mb-12">
            <div className="flex items-center gap-3 mb-3">
               {studio.district && (
                 <Badge variant="outline" className="border-primary/30 text-primary text-[8px] font-black uppercase tracking-widest bg-primary/5 px-2 py-0.5">
                   {studio.district}
                 </Badge>
               )}
               <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
            </div>
            <h1 className="text-3xl md:text-6xl font-black mb-3 md:mb-4 uppercase italic tracking-tighter leading-none text-white">
              {studio.name}
            </h1>
            <p className="text-xs md:text-sm opacity-40 font-medium max-w-xl leading-relaxed mb-6">
              {studio.description}
            </p>

            {studio.linkUrl && (
              <a 
                href={studio.linkUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-5 py-2.5 transition-all group"
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-primary italic">
                  {studio.linkLabel || 'Visit Studio'}
                </span>
                <ExternalLink className="w-3 h-3 text-white/40 group-hover:text-white transition-colors" />
              </a>
            )}
          </div>
        )}

        {/* Tracks Section */}
        <div className="mb-10 md:mb-14">
          <div className="flex items-center gap-2 mb-4">
            <Music className="w-4 h-4 text-primary" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-white">TRACKS</h2>
          </div>
          {studioTracks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {studioTracks.map((track, idx) => (
                <div key={track.id} className="p-2 bg-white/2 border border-white/5 hover:bg-white/5 transition-all flex items-center justify-between group rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[9px] font-black italic text-white/20">
                      {(idx + 1).toString().padStart(2, '0')}
                    </div>
                    <h4 className="text-xs font-black italic uppercase tracking-tight group-hover:text-primary transition-colors">{track.name}</h4>
                  </div>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => toggleTrack(track.url)}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all",
                      playingTrack === track.url ? "bg-primary text-white" : "bg-white/5 hover:bg-white/10"
                    )}
                  >
                    {playingTrack === track.url ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-white/2 rounded-2xl border border-dashed border-white/10">
               <p className="text-[9px] font-black uppercase tracking-[0.3em] opacity-20 italic">No tracks synced for this studio</p>
            </div>
          )}
        </div>

        {/* Games Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#FFEA00]" />
              <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-white">GAMES</h2>
            </div>
            {isLoadingLevels && <Loader2 className="w-3 h-3 animate-spin opacity-20" />}
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {games?.map((game) => {
              const gameLevels = allLevels?.filter(l => l.gameId === game.id) || [];
              const diffInfo = DIFFICULTY_MAP[game.difficulty || 1];

              // Calculate overall game progress
              const totalAccuracy = gameLevels.reduce((acc, level) => {
                const progress = getLevelProgress(level.id);
                return acc + (progress?.accuracy || 0);
              }, 0);
              const overallProgress = gameLevels.length > 0 ? Math.round(totalAccuracy / gameLevels.length) : 0;

              return (
                <div key={game.id} className="relative group">
                  <div className="p-4 md:p-6 bg-black/40 border border-white/5 rounded-2xl md:rounded-[2rem]">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                      <div className="flex-1 w-full">
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                          <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter leading-none group-hover:text-primary transition-colors">{game.name}</h3>
                          
                          <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                            <Music className="w-2.5 h-2.5 text-primary" />
                            <span className="text-[9px] font-black italic uppercase text-white/40">{getTrackName(game)}</span>
                          </div>

                          <Badge 
                            variant="outline" 
                            className="text-[8px] font-black tracking-widest py-0.5 px-2 h-5"
                            style={{ borderColor: diffInfo.color, color: diffInfo.color }}
                          >
                            {diffInfo.label}
                          </Badge>
                        </div>

                        {/* Progress Bar Sektion */}
                        <div className="mb-6">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/20">Overall Mastery</span>
                            <span className={cn(
                              "text-[10px] font-black italic",
                              overallProgress >= 80 ? "text-[#00E676]" : "text-primary"
                            )}>
                              {overallProgress}%
                            </span>
                          </div>
                          <Progress value={overallProgress} className="h-1.5 bg-white/5" />
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
                              "h-12 md:h-14 border flex flex-col items-center justify-center transition-all rounded-xl relative overflow-hidden",
                              progress ? "border-[#00E676]/30 bg-[#00E676]/5" : "border-white/5 bg-white/2 hover:bg-white/5 hover:border-white/10"
                            )}>
                              <div className="text-[10px] md:text-sm flex items-center gap-1 uppercase italic font-black group-hover/level:text-primary transition-colors">
                                LVL {level.difficulty}
                                <ChevronRight className="w-3 h-3" />
                              </div>
                              {progress && (
                                <div className="mt-1 flex items-center gap-1 bg-[#00E676]/20 px-1.5 py-0.5 rounded-full border border-[#00E676]/30 scale-75">
                                  <Trophy className="w-2 h-2 text-[#00E676]" />
                                  <span className="text-[8px] font-black text-[#00E676]">{progress.accuracy}%</span>
                                </div>
                              )}
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
