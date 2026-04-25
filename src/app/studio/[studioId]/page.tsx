
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useMemoFirebase, useCollection, useDoc, useUser } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Studio, Game, Level, LevelProgress, Track, hasAccess } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ChevronRight, Trophy, Loader2, Play, Pause, Music, Zap, ExternalLink, Lock } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { audioEngine } from '@/lib/game/audio-engine';

const DIFFICULTY_MAP: Record<number, { label: string, color: string }> = {
  1: { label: 'BEGINNER', color: '#00E676' },
  2: { label: 'SKILLED', color: '#FFEA00' },
  3: { label: 'PRO', color: '#EB3D99' },
  4: { label: 'HERO', color: '#FF3D00' },
};

export default function StudioPage() {
  const { studioId } = useParams();
  const db = useFirestore();
  const { user, profile, isUserLoading } = useUser();

  const studioRef = useMemoFirebase(() => studioId ? doc(db, 'studios', studioId as string) : null, [db, studioId]);
  const { data: studio, isLoading: isLoadingStudio } = useDoc<Studio>(studioRef);

  const gamesQuery = useMemoFirebase(() => {
    if (!db || !studioId) return null;
    return query(collection(db, 'games'), where('studioId', '==', studioId));
  }, [db, studioId]);
  const { data: allGames } = useCollection<Game>(gamesQuery);

  const tracksQuery = useMemoFirebase(() => {
    if (!db || !studioId) return null;
    return query(collection(db, 'tracks'), where('studioId', '==', studioId));
  }, [db, studioId]);
  const { data: studioTracks } = useCollection<Track>(tracksQuery);

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

  // Preloading all studio tracks for instant playback
  useEffect(() => {
    if (studioTracks && studioTracks.length > 0 && audioEngine) {
      const trackUrls = studioTracks.map(t => t.url).filter(url => !!url);
      audioEngine.preloadAudio(trackUrls);
    }
  }, [studioTracks]);

  const isStudioLocked = studio && !hasAccess(profile?.role, studio.minRole || 'free');

  const filteredGames = useMemo(() => {
    if (!allGames) return [];
    // Fixed order: BEAT HERO, VINYL HUNTER, SAMPLE CATCHER
    const order = ['rhythm-producer', 'sample-hunter', 'sample-catcher'];
    return [...allGames]
      .filter(game => hasAccess(profile?.role, game.minRole || 'free'))
      .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  }, [allGames, profile?.role]);

  const toggleTrack = (url: string) => {
    if (!audio || !url) return;
    if (playingTrack === url) {
      audio.pause();
      setPlayingTrack(null);
    } else {
      audio.src = `/api/proxy-audio?url=${encodeURIComponent(url)}`;
      audio.play().catch(e => console.warn("Studio audio play failed", e));
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

  const getLevelProgress = (levelId: string) => {
    return userProgress?.find(p => p.levelId === levelId);
  };

  if (isUserLoading || isLoadingStudio) {
    return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-center text-white gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 italic">Syncing Rack...</p>
      </div>
    );
  }

  if (isStudioLocked) {
    return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-center text-white p-6 text-center">
        <Lock className="w-16 h-16 text-primary mb-6" />
        <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-2 text-gradient">Access Denied</h2>
        <p className="text-sm opacity-50 mb-8 max-w-xs font-medium uppercase tracking-widest">
          {studio?.minRole?.toUpperCase()} Authorization Required
        </p>
        <Link href="/">
          <Button className="bg-white text-black font-black uppercase italic rounded-full px-12 h-14">Back to Hub</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-16 font-body selection:bg-primary selection:text-white">
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#FF3399 1.5px, transparent 1.5px)', backgroundSize: '40px 40px' }} />
      
      <div className="max-w-5xl mx-auto relative">
        <Link href="/" className="inline-flex items-center gap-3 text-sm opacity-40 hover:opacity-100 mb-8 md:mb-12 transition-all uppercase font-black tracking-[0.3em] group">
          <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" /> Back
        </Link>

        {studio && (
          <div className="mb-10 md:mb-16">
            <div className="flex items-center gap-4 mb-4">
               {studio.district && (
                 <Badge variant="outline" className="border-primary/30 text-primary text-[12px] font-black uppercase tracking-widest bg-primary/5 px-3 py-1">
                   {studio.district}
                 </Badge>
               )}
               <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
            </div>
            <h1 className="text-3xl md:text-6xl font-black mb-5 md:mb-7 uppercase italic tracking-tighter leading-none text-white">
              {studio.name}
            </h1>
            <p className="text-sm md:text-lg opacity-40 font-medium max-w-2xl leading-relaxed mb-8">
              {studio.description}
            </p>

            {studio.linkUrl && (
              <a 
                href={studio.linkUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-6 py-3 transition-all group"
              >
                <span className="text-xs font-black uppercase tracking-widest text-primary italic">
                  {studio.linkLabel || 'Visit Studio'}
                </span>
                <ExternalLink className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
              </a>
            )}
          </div>
        )}

        <div className="mb-14 md:mb-20">
          <div className="flex items-center gap-3 mb-6">
            <Music className="w-6 h-6 text-primary" />
            <h2 className="text-xs font-black uppercase tracking-[0.5em] text-white">STUDIO TRACKS</h2>
          </div>
          {studioTracks && studioTracks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {studioTracks.map((track, idx) => (
                <div key={track.id} className="gemini-border-primary group">
                  <div className="p-3 bg-black/40 backdrop-blur-xl border border-white/5 flex items-center justify-between rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[11px] font-black italic text-white/20">
                        {(idx + 1).toString().padStart(2, '0')}
                      </div>
                      <div>
                        <h4 className="text-sm md:text-base font-black italic uppercase tracking-tight group-hover:text-primary transition-colors">{track.name}</h4>
                        {track.author && <p className="text-[9px] opacity-30 uppercase font-black">{track.author}</p>}
                      </div>
                    </div>
                    {track.url && (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => toggleTrack(track.url)}
                        className={cn(
                          "w-10 h-10 rounded-full transition-all",
                          playingTrack === track.url ? "bg-primary text-white" : "bg-white/5 hover:bg-white/10"
                        )}
                      >
                        {playingTrack === track.url ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-10 text-center bg-white/2 rounded-2xl border border-dashed border-white/10">
               <p className="text-xs font-black uppercase tracking-[0.3em] opacity-20 italic">No tracks synced for this studio</p>
            </div>
          )}
        </div>

        <div className="space-y-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-6 h-6 text-[#FFEA00]" />
              <h2 className="text-xs font-black uppercase tracking-[0.5em] text-white">STUDIO MODULES</h2>
            </div>
            {isLoadingLevels && <Loader2 className="w-5 h-5 animate-spin opacity-20" />}
          </div>
          
          <div className="grid grid-cols-1 gap-10">
            {filteredGames.map((game) => {
              const gameLevels = allLevels?.filter(l => l.gameId === game.id) || [];
              const diffInfo = DIFFICULTY_MAP[game.difficulty || 1];

              const totalAccuracy = gameLevels.reduce((acc, level) => {
                const progress = getLevelProgress(level.id);
                return acc + (progress?.accuracy || 0);
              }, 0);
              const overallProgress = gameLevels.length > 0 ? Math.round(totalAccuracy / gameLevels.length) : 0;

              return (
                <div key={game.id} className="relative group gemini-border">
                  <div className="p-4 md:p-6 bg-black/40 backdrop-blur-xl">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                      <div className="flex-1 w-full">
                        <div className="flex flex-wrap items-center gap-4 mb-4">
                          <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter leading-none group-hover:text-primary transition-colors">
                            {game.name}
                          </h3>
                          
                          <div className="flex items-center gap-3">
                            <Badge 
                              variant="outline" 
                              className="text-[10px] font-black tracking-widest py-1 px-3 h-6"
                              style={{ borderColor: diffInfo.color, color: diffInfo.color }}
                            >
                              {diffInfo.label}
                            </Badge>
                            {game.bpm && (
                              <span className="text-xs font-black italic text-[#FFEA00]">
                                {game.bpm} BPM
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mb-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Mastery</span>
                            <span className={cn(
                              "text-[10px] font-black italic",
                              overallProgress >= 80 ? "text-[#00E676]" : "text-primary"
                            )}>
                              {overallProgress}%
                            </span>
                          </div>
                          <Progress value={overallProgress} className="h-1.5 bg-white/5" />
                        </div>
                      </div>
                    </div>

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
                              "h-14 md:h-16 border flex flex-col items-center justify-center transition-all rounded-xl relative overflow-hidden group/level",
                              progress ? "border-[#00E676]/30 bg-[#00E676]/5" : "border-white/5 bg-white/2 hover:bg-white/5 hover:border-white/10"
                            )}>
                              <div className="text-xs md:text-sm flex items-center gap-1.5 uppercase italic font-black transition-colors group-hover/level:text-primary">
                                LVL {level.difficulty}
                                <ChevronRight className="w-3 h-3" />
                              </div>
                              {progress && (
                                <div className="mt-1 flex items-center gap-1 bg-[#00E676]/20 px-2 py-0.5 rounded-full border border-[#00E676]/30">
                                  <Trophy className="w-2.5 h-2.5 text-[#00E676]" />
                                  <span className="text-[9px] font-black text-[#00E676]">{progress.accuracy}%</span>
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
