
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

// Urban Neon Colors
const OBJECT_COLORS: Record<SoundType, string> = {
  kick: '#FF00FF', // Neon Magenta
  clap: '#00FFFF', // Cyan
  percs: '#FFEA00', // Neon Yellow
  misc: '#3838FA', // Electric Blue
};

/**
 * Generates a stable random position across the entire screen area.
 */
const getPosition = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const x = Math.abs((hash % 85) + 7.5); 
  const y = Math.abs(((hash >> 16) % 80) + 10); 
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
      const urls = [game.backingTrackUrl || '', ...sounds.map(s => s.sampleUrl)];
      try { await audioEngine.preloadAudio(urls); } catch (e) {}
    };
    preload();
  }, [sounds, game.backingTrackUrl]);

  const startLevel = async () => {
    if (!audioEngine) return;
    setIsLoadingAudio(true);
    try {
      await audioEngine.resume();
      await audioEngine.preloadAudio([game.backingTrackUrl || '', ...sounds.map(s => s.sampleUrl)]);

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
      toast({ variant: "destructive", title: "Audio Sync Failed" });
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handleCatch = useCallback((noteId: string, sound: Sound) => {
    if (!audioEngine || !isPlaying || clearedNotesRef.current.has(noteId)) return;
    
    setCapturedNotes(prev => new Set(prev).add(noteId));
    audioEngine.playOneShot(sound.sampleUrl);
    
    clearedNotesRef.current.add(noteId);
    setScore(prev => {
      const nextHits = prev.hits + 1;
      const total = nextHits + prev.misses;
      return { hits: nextHits, misses: prev.misses, accuracy: Math.round((nextHits / total) * 100) };
    });
  }, [isPlaying]);

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
              // Larger window: 1.5 seconds visibility
              const relativeTime = noteTime - (t - SYNC_OFFSET);

              // Count as miss if it's passed the 0.75s visibility window after the hit point
              if (!clearedNotesRef.current.has(noteId) && relativeTime < -0.75) {
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
  }, [isPlaying, bpm, soundsWithPatterns]);

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

  const visibleNotes = useMemo(() => {
    if (!isPlaying) return [];
    
    const secondsPerStep = (60 / bpm) / 4;
    const allNotes: any[] = [];
    
    // Total visibility duration: 1.5 seconds (0.75s before, 0.75s after hit point)
    const WINDOW_SIZE = 0.75;

    soundsWithPatterns.forEach(sound => {
      sound.triggerSteps.forEach(step => {
        const noteId = `${sound.type}-${step}`;
        const noteTime = step * secondsPerStep;
        const relativeTime = noteTime - (currentTime - SYNC_OFFSET);
        
        const isCaptured = capturedNotes.has(noteId);
        const isMissed = missedNotes.has(noteId);
        const isWithinWindow = relativeTime <= WINDOW_SIZE && relativeTime >= -WINDOW_SIZE;

        if (isWithinWindow || isCaptured || isMissed) {
          allNotes.push({ noteId, sound, relativeTime, isWithinWindow, isCaptured, isMissed, step });
        }
      });
    });

    // Stricter sequential logic for Level 1
    if (level.difficulty === 1) {
      allNotes.sort((a, b) => a.step - b.step);
      
      // Find the absolute first unhandled or recently handled note
      const firstActive = allNotes.find(n => {
        const isActive = !n.isCaptured && !n.isMissed && n.isWithinWindow;
        const isShowingFeedback = (n.isCaptured || n.isMissed) && n.relativeTime > -0.5;
        return isActive || isShowingFeedback;
      });

      return firstActive ? [firstActive] : [];
    }
    
    return allNotes;
  }, [isPlaying, soundsWithPatterns, currentTime, bpm, capturedNotes, missedNotes, level.difficulty]);

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-2 md:p-4 overflow-hidden select-none font-body relative">
      {/* Background Image - Urban Graffiti Boombox (Not zoomed in) */}
      <div 
        className="absolute inset-0 opacity-25 pointer-events-none bg-contain bg-center bg-no-repeat"
        style={{ 
          backgroundImage: 'url(https://picsum.photos/seed/beathero-boombox/1080/1920)',
          backgroundSize: 'contain'
        }}
        data-ai-hint="urban boombox"
      />
      
      <header className="flex justify-between items-center mb-1 px-2 h-10 md:h-12 shrink-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-2">
          <Link href={`/studio/${game.studioId}`}>
            <ArrowLeft className="w-4 h-4 text-white/50 hover:text-white transition-colors" />
          </Link>
          <div>
            <h1 className="text-[10px] md:text-xs font-black uppercase italic tracking-tighter text-primary leading-none">Sample Catcher</h1>
            <p className="text-[7px] md:text-[8px] opacity-40 uppercase font-bold tracking-widest">{game.name}</p>
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

      <main className="flex-1 relative overflow-hidden rounded-2xl md:rounded-[3rem] border border-white/5 z-20">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1.5px, transparent 1.5px)', backgroundSize: '40px 40px' }} />

        {visibleNotes.map(({ noteId, sound, isWithinWindow, isCaptured, isMissed, step }) => {
          const Icon = OBJECT_ICONS[sound.type];
          const baseColor = OBJECT_COLORS[sound.type];
          const feedbackColor = isCaptured ? '#00FF66' : isMissed ? '#FF3D00' : baseColor;
          const pos = getPosition(`${game.id}-${sound.id}-${step}`);

          return (
            <div
              key={noteId}
              className={cn(
                "absolute z-20 pointer-events-auto",
                (isCaptured || isMissed) && "animate-out fade-out duration-500 fill-mode-forwards"
              )}
              style={{ 
                left: `${pos.x}%`, 
                top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <button
                onPointerDown={(e) => { e.stopPropagation(); handleCatch(noteId, sound); }}
                disabled={isCaptured || isMissed || !isWithinWindow}
                className="relative p-10 md:p-14 flex items-center justify-center outline-none border-none bg-transparent group cursor-pointer"
              >
                {/* 3D Static Glow Base */}
                <div 
                  className={cn(
                    "absolute inset-0 rounded-full blur-3xl transition-all duration-300",
                    isCaptured ? "bg-[#00FF66] opacity-70" : isMissed ? "bg-[#FF3D00] opacity-70" : "bg-white/5 opacity-10"
                  )} 
                  style={{ backgroundColor: isCaptured || isMissed ? undefined : baseColor }} 
                />
                
                <div className="relative flex items-center justify-center">
                  <Icon 
                    className={cn(
                      "w-24 h-24 md:w-36 md:h-36 transition-colors duration-200",
                      "filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)]"
                    )}
                    style={{ color: feedbackColor }} 
                  />
                  
                  {/* Haptic Glossy Plastic Highlights */}
                  {!isCaptured && !isMissed && (
                    <div className="absolute inset-0 pointer-events-none rounded-full overflow-hidden">
                      <div className="absolute top-[5%] left-[15%] w-[70%] h-[35%] bg-gradient-to-b from-white/30 to-transparent rounded-full blur-[2px]" />
                      <div className="absolute inset-0 border-[3px] border-white/10 rounded-full" />
                    </div>
                  )}
                </div>
              </button>
            </div>
          );
        })}

        {!isPlaying && !isFinished && countIn === null && (
          <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-50 backdrop-blur-md">
            <Card className="p-10 bg-black/50 border-none gemini-border text-center max-w-sm mx-4 shadow-2xl">
              <div className="bg-primary/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/30">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black mb-2 uppercase italic tracking-tighter">Sample Catcher</h2>
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-40 mb-8">Urban Precision Interface</p>
              <Button onClick={startLevel} disabled={isLoadingAudio} className="w-full h-16 bg-white text-black font-black uppercase rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.1)]">
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
                  <Trophy className="w-20 h-20 text-[#FFEA00] mx-auto drop-shadow-[0_0_40px_rgba(255,234,0,0.4)]" />
                  <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">Session Synced</h2>
                  <p className="text-3xl text-[#00FF66] font-black italic">{score.accuracy}% Sync</p>
                </>
              ) : (
                <>
                  <XCircle className="w-20 h-20 text-[#FF3D00] mx-auto drop-shadow-[0_0_40px_rgba(255,61,0,0.4)]" />
                  <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">Desynced</h2>
                  <p className="text-xl opacity-60 uppercase tracking-[0.3em] font-black">Sync failure</p>
                </>
              )}
              <div className="flex gap-4 pt-8">
                <Button onClick={startLevel} variant="outline" className="flex-1 h-14 bg-white/5 hover:bg-white/10 text-xs md:text-sm uppercase font-black italic rounded-2xl">Retry</Button>
                <Link href={`/studio/${game.studioId}`} className="flex-1">
                  <Button className="w-full h-14 bg-white text-black font-black uppercase italic rounded-2xl">Return</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="p-3 text-center shrink-0 z-50 bg-black/40 backdrop-blur-sm border-t border-white/5">
        <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] text-white/10 italic">Urban Sequential Interface v3.0</p>
      </footer>
    </div>
  );
};
