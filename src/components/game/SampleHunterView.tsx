
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Game, Level, Sound, GameScore, SoundType, TriggerPattern } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trophy, Loader2, Sparkles, XCircle, Disc, Mic, Speaker, ArrowLeft, Percent, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc, increment, setDoc, serverTimestamp } from 'firebase/firestore';

const SYNC_OFFSET = 0.08;
const PASS_THRESHOLD = 80;
const DIFFICULTY_REWARDS: Record<number, number> = { 1: 50, 2: 100, 3: 200, 4: 1000 };

const OBJECT_ICONS: Record<SoundType, any> = {
  kick: Disc,
  clap: Mic,
  percs: Speaker,
  misc: Sparkles,
};

const OBJECT_COLORS: Record<SoundType, string> = {
  kick: '#993DEB',
  clap: '#FF3D00',
  percs: '#FFEA00',
  misc: '#3838FA',
};

// Generates a stable position based on a seed string, expanded to full screen range
const getPosition = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const x = Math.abs((hash % 80) + 10); 
  const y = Math.abs(((hash >> 8) % 80) + 10); 
  return { x, y };
};

interface SampleHunterViewProps {
  game: Game;
  level: Level;
  sounds: Sound[];
  patterns: TriggerPattern[];
}

export const SampleHunterView: React.FC<SampleHunterViewProps> = ({ game, level, sounds, patterns }) => {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [countIn, setCountIn] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [score, setScore] = useState<GameScore>({ hits: 0, misses: 0, accuracy: 100 });
  const [isFinished, setIsFinished] = useState(false);
  const [hasAwardedPoints, setHasAwardedPoints] = useState(false);
  
  const [capturedNotes, setCapturedNotes] = useState<Set<string>>(new Set());
  const [missedNotes, setMissedNotes] = useState<Set<string>>(new Set());

  const frameRef = useRef<number>(null);
  const clearedNotesRef = useRef<Set<string>>(new Set());

  const bpm = game.bpm || 120;
  const TOTAL_STEPS = 512;

  const soundsWithPatterns = useMemo(() => {
    return sounds.map(sound => {
      const uniqueSteps = new Set<number>();
      sound.patternIds?.forEach((pId, index) => {
        const pattern = patterns.find(p => p.id === pId);
        if (pattern) {
          const offset = index * 128;
          pattern.steps.forEach(s => uniqueSteps.add(s + offset));
        }
      });
      return { ...sound, triggerSteps: Array.from(uniqueSteps).sort((a, b) => a - b) };
    });
  }, [sounds, patterns]);

  useEffect(() => {
    const preload = async () => {
      if (!audioEngine) return;
      const urls = [
        game.backingTrackUrl || '',
        ...sounds.map(s => s.sampleUrl)
      ];
      try {
        await audioEngine.preloadAudio(urls);
      } catch (e) {
        console.error('Initial preload failed', e);
      }
    };
    preload();
  }, [sounds, game.backingTrackUrl]);

  const startLevel = async () => {
    if (!audioEngine) return;
    setIsLoadingAudio(true);
    try {
      await audioEngine.resume();
      
      const urlsToLoad = [game.backingTrackUrl || '', ...sounds.map(s => s.sampleUrl)];
      await audioEngine.preloadAudio(urlsToLoad);

      clearedNotesRef.current = new Set();
      setCapturedNotes(new Set());
      setMissedNotes(new Set());
      setScore({ hits: 0, misses: 0, accuracy: 100 });
      setIsFinished(false);
      setHasAwardedPoints(false);
      
      const secondsPerBeat = 60 / bpm;
      const now = audioEngine.getContextTime();
      const actualStartTime = now + (4 * secondsPerBeat);
      audioEngine.setStartTime(actualStartTime);

      await audioEngine.playCountIn(bpm, (beat) => setCountIn(5 - beat));
      setCountIn(null);
      setIsPlaying(true);
      await audioEngine.startBackingTrack(game.backingTrackUrl || '', actualStartTime);
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: "Audio Link Failed", 
        description: e.message || "Failed to establish sync pulse." 
      });
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handleCatch = useCallback((noteId: string, sound: Sound, relativeTime: number) => {
    // Only allow hit if visible (1 second window: 0.5s before to 0.5s after hit point)
    if (!audioEngine || !isPlaying || clearedNotesRef.current.has(noteId) || missedNotes.has(noteId) || capturedNotes.has(noteId)) return;
    
    // Strict visibility check
    if (Math.abs(relativeTime) > 0.5) return;

    setCapturedNotes(prev => new Set(prev).add(noteId));
    audioEngine.playOneShot(sound.sampleUrl);
    
    clearedNotesRef.current.add(noteId);
    setScore(prev => {
      const nextHits = prev.hits + 1;
      const total = nextHits + prev.misses;
      return { hits: nextHits, misses: prev.misses, accuracy: Math.round((nextHits / total) * 100) };
    });
  }, [isPlaying, missedNotes, capturedNotes]);

  useEffect(() => {
    if (isPlaying) {
      const update = () => {
        if (audioEngine) {
          const t = audioEngine.getCurrentTime();
          setCurrentTime(t);
          const secondsPerStep = (60 / bpm) / 4;
          
          let newMissesCount = 0;
          soundsWithPatterns.forEach(sound => {
            sound.triggerSteps.forEach(step => {
              const noteId = `${sound.type}-${step}`;
              const noteTime = step * secondsPerStep;
              const relativeTime = noteTime - (t - SYNC_OFFSET);

              // 1 second window: vanishes at -0.5s relative to its hit point
              if (!clearedNotesRef.current.has(noteId) && !capturedNotes.has(noteId) && !missedNotes.has(noteId) && relativeTime < -0.5) {
                setMissedNotes(prev => new Set(prev).add(noteId));
                newMissesCount++;
                clearedNotesRef.current.add(noteId);
              }
            });
          });

          if (newMissesCount > 0) {
            setScore(prev => {
              const nextMisses = prev.misses + newMissesCount;
              const total = prev.hits + nextMisses;
              return { hits: prev.hits, misses: nextMisses, accuracy: total === 0 ? 100 : Math.round((prev.hits / total) * 100) };
            });
          }

          if (t >= (TOTAL_STEPS / 4) * (60 / bpm) + 1.5) {
            setIsPlaying(false);
            setIsFinished(true);
            audioEngine.stop();
          }
        }
        frameRef.current = requestAnimationFrame(update);
      };
      frameRef.current = requestAnimationFrame(update);
    }
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [isPlaying, bpm, soundsWithPatterns, capturedNotes, missedNotes]);

  useEffect(() => {
    if (isFinished && score.accuracy >= PASS_THRESHOLD && !hasAwardedPoints && user && db) {
      const reward = DIFFICULTY_REWARDS[level.difficulty] || 0;
      updateDoc(doc(db, 'users', user.uid), { streetCred: increment(reward) });
      setDoc(doc(db, 'users', user.uid, 'progress', level.id), { 
        levelId: level.id, 
        accuracy: score.accuracy, 
        completedAt: serverTimestamp() 
      }, { merge: true });
      setHasAwardedPoints(true);
    }
  }, [isFinished, score.accuracy, hasAwardedPoints, user, db, level]);

  // Logic to prevent multiple icons in Level 1
  const visibleNotes = useMemo(() => {
    if (!isPlaying) return [];
    
    const secondsPerStep = (60 / bpm) / 4;
    const notes: any[] = [];
    
    soundsWithPatterns.forEach(sound => {
      sound.triggerSteps.forEach(step => {
        const noteId = `${sound.type}-${step}`;
        const noteTime = step * secondsPerStep;
        const relativeTime = noteTime - (currentTime - SYNC_OFFSET);
        
        // 1 second window
        const isVisible = relativeTime <= 0.5 && relativeTime >= -0.5;
        const isCaptured = capturedNotes.has(noteId);
        const isMissed = missedNotes.has(noteId);
        
        if (isVisible || isCaptured || isMissed) {
          notes.push({ noteId, sound, relativeTime, isVisible, isCaptured, isMissed });
        }
      });
    });

    // Level 1: Only show the one closest to the hit point (relativeTime near 0)
    if (level.difficulty === 1) {
      const activeNotes = notes.filter(n => !n.isCaptured && !n.isMissed);
      if (activeNotes.length > 1) {
        const closest = activeNotes.sort((a, b) => Math.abs(a.relativeTime) - Math.abs(b.relativeTime))[0];
        return notes.filter(n => n.noteId === closest.noteId || n.isCaptured || n.isMissed);
      }
    }
    
    return notes;
  }, [isPlaying, soundsWithPatterns, currentTime, bpm, capturedNotes, missedNotes, level.difficulty]);

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-2 md:p-4 overflow-hidden select-none font-body">
      <header className="flex justify-between items-center mb-1 px-2 h-10 md:h-12 shrink-0 z-50">
        <div className="flex items-center gap-2">
          <Link href={`/studio/${game.studioId}`}>
            <ArrowLeft className="w-4 h-4 text-white/50 hover:text-white transition-colors" />
          </Link>
          <div>
            <h1 className="text-[10px] md:text-xs font-black uppercase italic tracking-tighter text-primary leading-none">Sample Catcher</h1>
            <p className="text-[7px] md:text-[8px] opacity-40 uppercase font-bold tracking-widest line-clamp-1">{game.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-black/60 px-3 py-1 rounded-full border border-white/10 h-8 md:h-10 backdrop-blur-md">
            <Percent className="w-3 h-3 text-[#FFEA00]" />
            <p className={cn("text-sm md:text-2xl font-black italic", score.accuracy >= PASS_THRESHOLD ? "text-[#00E676]" : "text-[#FF3D00]")}>
              {score.accuracy}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 relative gemini-border gemini-glow bg-black/40 overflow-hidden rounded-2xl md:rounded-[3rem]">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {visibleNotes.map(({ noteId, sound, relativeTime, isVisible, isCaptured, isMissed }) => {
          if (clearedNotesRef.current.has(noteId) && !isCaptured && !isMissed) return null;

          const Icon = OBJECT_ICONS[sound.type];
          const color = isCaptured ? '#00E676' : isMissed ? '#FF3D00' : OBJECT_COLORS[sound.type];
          const pos = getPosition(noteId);
          
          return (
            <button
              key={noteId}
              onPointerDown={(e) => { e.stopPropagation(); handleCatch(noteId, sound, relativeTime); }}
              disabled={isCaptured || isMissed || !isVisible}
              className={cn(
                "absolute z-20 outline-none cursor-pointer p-0 m-0 border-none bg-transparent",
                isMissed && "opacity-0 transition-opacity duration-300"
              )}
              style={{ 
                left: `${pos.x}%`, 
                top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="relative p-6 md:p-10 flex items-center justify-center">
                {/* Glow Shadow */}
                <div 
                  className={cn(
                    "absolute inset-0 rounded-full blur-3xl",
                    isCaptured ? "opacity-100 bg-[#00E676]" : isMissed ? "opacity-40 bg-[#FF3D00]" : "opacity-30"
                  )} 
                  style={{ backgroundColor: (!isCaptured && !isMissed) ? color : undefined }} 
                />
                
                {/* 3D Icon Container */}
                <div className="relative flex items-center justify-center">
                  <Icon 
                    className={cn(
                      "w-16 h-16 md:w-32 md:h-32",
                      "filter drop-shadow-[0_12px_10px_rgba(0,0,0,0.8)]"
                    )}
                    style={{ color: color }} 
                  />
                  
                  {/* Glossy Plastic Highlights */}
                  {!isCaptured && !isMissed && (
                    <div className="absolute inset-0 pointer-events-none">
                      {/* Upper Rim Light */}
                      <div className="absolute top-[5%] left-[15%] w-[40%] h-[25%] bg-white/30 rounded-full blur-md" />
                      {/* Inner Shine */}
                      <div className="absolute inset-4 border-[2px] border-white/5 rounded-full" />
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {!isPlaying && !isFinished && countIn === null && (
          <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-md">
            <Card className="p-8 bg-black/50 border-none gemini-border text-center max-w-sm mx-4 shadow-2xl">
              <div className="bg-primary/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/30 shadow-[0_0_30px_rgba(255,51,153,0.3)]">
                <Zap className="w-10 h-10 text-primary animate-pulse" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black mb-2 uppercase italic tracking-tighter">Sample Catcher</h2>
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-40 mb-8">Catch the samples as they appear. One by one.</p>
              <Button onClick={startLevel} disabled={isLoadingAudio} className="w-full h-16 bg-white text-black font-black uppercase rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)]">
                {isLoadingAudio ? <Loader2 className="animate-spin" /> : "Initiate Sync"}
              </Button>
            </Card>
          </div>
        )}

        {countIn !== null && (
          <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
            <div className="text-[10rem] md:text-[15rem] font-black italic text-[#FFEA00] drop-shadow-[0_0_60px_rgba(255,234,0,0.5)]">{countIn}</div>
          </div>
        )}

        {isFinished && (
          <div className="absolute inset-0 bg-black/98 flex items-center justify-center z-50 p-6 backdrop-blur-2xl">
            <div className="text-center space-y-8 max-w-sm">
              {score.accuracy >= PASS_THRESHOLD ? (
                <>
                  <div className="relative inline-block">
                    <Trophy className="w-24 h-24 text-[#FFEA00] mx-auto drop-shadow-[0_0_40px_rgba(255,234,0,0.6)]" />
                    <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-primary animate-bounce" />
                  </div>
                  <h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter">Session Synced</h2>
                  <p className="text-3xl text-[#00E676] font-black italic">{score.accuracy}% Sync</p>
                </>
              ) : (
                <>
                  <XCircle className="w-24 h-24 text-[#FF3D00] mx-auto drop-shadow-[0_0_40px_rgba(255,61,0,0.6)]" />
                  <h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter">Desynced</h2>
                  <p className="text-xl opacity-60 uppercase tracking-[0.3em] font-black">Sync failure</p>
                </>
              )}
              <div className="flex gap-4 pt-8">
                <Button onClick={startLevel} variant="outline" className="flex-1 h-14 border-white/10 bg-white/5 hover:bg-white/10 text-xs md:text-sm uppercase font-black italic rounded-2xl">Retry</Button>
                <Link href={`/studio/${game.studioId}`} className="flex-1">
                  <Button className="w-full h-14 bg-white text-black font-black uppercase italic rounded-2xl hover:scale-105 active:scale-95 transition-all">Return</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="p-3 text-center shrink-0">
        <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] text-white/10">Synchronizing urban rhythm patterns...</p>
      </footer>
    </div>
  );
};
