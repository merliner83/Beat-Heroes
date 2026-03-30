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

// Helper to generate a stable random position based on a string seed
const getPosition = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const x = Math.abs((hash % 80) + 10); // 10% to 90%
  const y = Math.abs(((hash >> 8) % 70) + 15); // 15% to 85%
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

  const handleCatch = useCallback((noteId: string, sound: Sound) => {
    if (!audioEngine || !isPlaying || clearedNotesRef.current.has(noteId)) return;

    // Mark as captured for visual feedback
    setCapturedNotes(prev => new Set(prev).add(noteId));
    
    // Play sound immediately
    audioEngine.playOneShot(sound.sampleUrl);
    
    // Small delay before removing from screen for the green effect
    setTimeout(() => {
      clearedNotesRef.current.add(noteId);
      setScore(prev => {
        const nextHits = prev.hits + 1;
        const total = nextHits + prev.misses;
        return { hits: nextHits, misses: prev.misses, accuracy: Math.round((nextHits / total) * 100) };
      });
    }, 150);
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      const update = () => {
        if (audioEngine) {
          const t = audioEngine.getCurrentTime();
          setCurrentTime(t);
          const secondsPerStep = (60 / bpm) / 4;
          const currentStep = (t - SYNC_OFFSET) / secondsPerStep;
          const missTolerance = 1.0;

          let newMisses = 0;
          soundsWithPatterns.forEach(sound => {
            sound.triggerSteps.forEach(step => {
              const noteId = `${sound.type}-${step}`;
              if (!clearedNotesRef.current.has(noteId) && !capturedNotes.has(noteId) && currentStep > step + missTolerance) {
                clearedNotesRef.current.add(noteId);
                newMisses++;
              }
            });
          });

          if (newMisses > 0) {
            setScore(prev => {
              const nextMisses = prev.misses + newMisses;
              const total = prev.hits + nextMisses;
              return { hits: prev.hits, misses: nextMisses, accuracy: total === 0 ? 100 : Math.round((prev.hits / total) * 100) };
            });
          }

          if (t >= (TOTAL_STEPS / 4) * (60 / bpm) + 1) {
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
  }, [isPlaying, bpm, soundsWithPatterns, capturedNotes]);

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
          <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full border border-white/10 h-8 md:h-10 backdrop-blur-md">
            <Percent className="w-3 h-3 text-[#FFEA00]" />
            <p className={cn("text-sm md:text-2xl font-black italic", score.accuracy >= PASS_THRESHOLD ? "text-[#00E676]" : "text-[#FF3D00]")}>
              {score.accuracy}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 relative gemini-border gemini-glow bg-black/40 overflow-hidden rounded-2xl md:rounded-[2rem]">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {isPlaying && soundsWithPatterns.map(sound => 
          sound.triggerSteps.map(step => {
            const noteId = `${sound.type}-${step}`;
            if (clearedNotesRef.current.has(noteId)) return null;

            const noteTime = step * ((60 / bpm) / 4);
            const relativeTime = noteTime - (currentTime - SYNC_OFFSET);
            
            if (relativeTime < -0.3 || relativeTime > 0.8) return null;

            const Icon = OBJECT_ICONS[sound.type];
            const isCaptured = capturedNotes.has(noteId);
            const color = isCaptured ? '#00E676' : OBJECT_COLORS[sound.type];
            const pos = getPosition(noteId);
            
            const opacity = relativeTime < 0 ? 1 + relativeTime * 3 : 1;

            return (
              <button
                key={noteId}
                onClick={(e) => { e.stopPropagation(); handleCatch(noteId, sound); }}
                className={cn(
                  "absolute transition-all duration-150 active:scale-95 cursor-pointer z-20 group",
                  isCaptured && "scale-110 brightness-150"
                )}
                style={{ 
                  left: `${pos.x}%`, 
                  top: `${pos.y}%`,
                  transform: 'translate(-50%, -50%)',
                  opacity: isCaptured ? 1 : Math.max(0, opacity),
                  color: color,
                }}
              >
                <div className="relative">
                  <div 
                    className={cn(
                      "absolute inset-0 blur-xl opacity-20 group-hover:opacity-100 transition-opacity",
                      isCaptured && "opacity-100 blur-2xl"
                    )} 
                    style={{ backgroundColor: color }} 
                  />
                  <Icon className={cn(
                    "w-12 h-12 md:w-20 md:h-20 transition-all drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]",
                    isCaptured && "drop-shadow-[0_0_30px_#00E676]"
                  )} />
                </div>
              </button>
            );
          })
        )}

        {!isPlaying && !isFinished && countIn === null && (
          <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-md">
            <Card className="p-8 bg-black/50 border-none gemini-border text-center max-w-sm mx-4 shadow-2xl">
              <div className="bg-primary/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/30">
                <Zap className="w-10 h-10 text-primary animate-pulse" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black mb-2 uppercase italic tracking-tighter">Sample Catcher</h2>
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-40 mb-8">Tap the icons to sync your session</p>
              <Button onClick={startLevel} disabled={isLoadingAudio} className="w-full h-16 bg-white text-black font-black uppercase rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                {isLoadingAudio ? <Loader2 className="animate-spin" /> : "Initiate Sync"}
              </Button>
            </Card>
          </div>
        )}

        {countIn !== null && (
          <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
            <div className="text-[10rem] md:text-[15rem] font-black italic text-[#FFEA00] animate-in zoom-in-50 duration-200 drop-shadow-[0_0_50px_rgba(255,234,0,0.3)]">{countIn}</div>
          </div>
        )}

        {isFinished && (
          <div className="absolute inset-0 bg-black/98 flex items-center justify-center z-50 p-6 backdrop-blur-xl">
            <div className="text-center space-y-8 max-w-sm">
              {score.accuracy >= PASS_THRESHOLD ? (
                <>
                  <div className="relative inline-block">
                    <Trophy className="w-24 h-24 text-[#FFEA00] mx-auto drop-shadow-[0_0_30px_rgba(255,234,0,0.5)]" />
                    <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-primary animate-bounce" />
                  </div>
                  <h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter">Session Synced</h2>
                  <p className="text-3xl text-[#00E676] font-black italic">{score.accuracy}% Accuracy</p>
                </>
              ) : (
                <>
                  <XCircle className="w-24 h-24 text-[#FF3D00] mx-auto drop-shadow-[0_0_30px_rgba(255,61,0,0.5)]" />
                  <h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter">Desynced</h2>
                  <p className="text-xl opacity-60 uppercase tracking-[0.3em] font-black">Sync failed</p>
                </>
              )}
              <div className="flex gap-4 pt-8">
                <Button onClick={startLevel} variant="outline" className="flex-1 h-14 border-white/10 bg-white/5 hover:bg-white/10 text-xs md:text-sm uppercase font-black italic rounded-2xl transition-all">Retry</Button>
                <Link href={`/studio/${game.studioId}`} className="flex-1">
                  <Button className="w-full h-14 bg-white text-black font-black uppercase italic rounded-2xl hover:scale-105 active:scale-95 transition-all">Return</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="p-3 text-center shrink-0">
        <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Press the samples to capture the groove</p>
      </footer>
    </div>
  );
};
