
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
  kick: '#FF3399',
  clap: '#00FFFF',
  percs: '#FFEA00',
  misc: '#3838FA',
};

const getPosition = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  // Höhere Varianz für die Verteilung über den gesamten Rack-Screen
  const x = Math.abs((hash % 80) + 10); 
  const y = Math.abs(((hash >> 14) % 80) + 10); 
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

  const handleCatch = useCallback((noteId: string, sound: Sound) => {
    if (clearedNotesRef.current.has(noteId)) return;
    
    clearedNotesRef.current.add(noteId);
    setCapturedNotes(prev => {
      const next = new Set(prev);
      next.add(noteId);
      return next;
    });
    
    if (audioEngine) {
      audioEngine.playOneShot(sound.sampleUrl);
    }
    
    setScore(prev => {
      const nextHits = prev.hits + 1;
      const total = nextHits + prev.misses;
      return { hits: nextHits, misses: prev.misses, accuracy: Math.round((nextHits / total) * 100) };
    });
  }, []);

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
              // Zeitfenster, wie lange ein Icon sichtbar bleibt (ca. 1.2s)
              const relativeTime = noteTime - (t - SYNC_OFFSET);

              if (!clearedNotesRef.current.has(noteId) && relativeTime < -0.8) {
                clearedNotesRef.current.add(noteId);
                setMissedNotes(prev => {
                  const next = new Set(prev);
                  next.add(noteId);
                  return next;
                });
                newMissesCount++;
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

          if (t >= (TOTAL_STEPS / 4) * (60 / bpm) + 1.0) {
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
    const allPossible = [];
    for (const sound of soundsWithPatterns) {
      for (const step of sound.triggerSteps) {
        const noteId = `${sound.type}-${step}`;
        const noteTime = step * secondsPerStep;
        const relativeTime = noteTime - (currentTime - SYNC_OFFSET);
        allPossible.push({ noteId, sound, relativeTime, step });
      }
    }
    allPossible.sort((a, b) => a.step - b.step);

    // Level 1: Streng sequenziell - immer nur EIN Icon anzeigen
    if (level.difficulty === 1) {
      const nextActiveNote = allPossible.find(n => !clearedNotesRef.current.has(n.noteId));
      const items = [];
      if (nextActiveNote && nextActiveNote.relativeTime <= 1.2 && nextActiveNote.relativeTime >= -0.8) {
        items.push(nextActiveNote);
      }
      // Feedback-Icons (Hit/Miss) kurz stehen lassen
      const feedbackNotes = allPossible.filter(n => 
        (capturedNotes.has(n.noteId) || missedNotes.has(n.noteId)) && 
        n.relativeTime > -0.4
      );
      return [...items, ...feedbackNotes];
    }

    // Höhere Level: Mehrere Icons gleichzeitig möglich
    return allPossible.filter(n => {
      const isHandled = capturedNotes.has(n.noteId) || missedNotes.has(n.noteId);
      const isVisible = n.relativeTime <= 1.0 && n.relativeTime >= -0.6;
      return isVisible || (isHandled && n.relativeTime > -0.3);
    });
  }, [isPlaying, soundsWithPatterns, currentTime, bpm, capturedNotes, missedNotes, level.difficulty]);

  const bgUrl = game.backgroundImageUrl || 'https://picsum.photos/seed/beathero-boombox/1080/1920';

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
    } catch (e) {
      toast({ variant: "destructive", title: "Audio Sync Failed" });
    } finally {
      setIsLoadingAudio(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-2 md:p-4 overflow-hidden select-none font-body relative">
      {/* Immersiver Background-Fade */}
      <div 
        className="absolute inset-0 opacity-40 pointer-events-none bg-center bg-no-repeat transition-opacity duration-1000 z-10"
        style={{ 
          backgroundImage: `url(${bgUrl})`,
          backgroundSize: '85% auto',
          maskImage: 'radial-gradient(circle at center, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 85%)',
          WebkitMaskImage: 'radial-gradient(circle at center, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 85%)'
        }}
      />
      
      <header className="flex justify-between items-center mb-1 px-2 h-10 md:h-12 shrink-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-2">
          <Link href={`/studio/${game.studioId}`}>
            <ArrowLeft className="w-4 h-4 text-white/50 hover:text-white" />
          </Link>
          <div>
            <h1 className="text-[10px] md:text-xs font-black uppercase italic tracking-tighter text-primary leading-none">Sample Catcher</h1>
            <p className="text-[7px] md:text-[8px] opacity-40 uppercase font-bold tracking-widest">{game.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-black/60 px-3 py-1 rounded-full border border-white/10 h-8 md:h-10 backdrop-blur-md">
            <Percent className="w-3 h-3 text-[#FFEA00]" />
            <p className={cn("text-sm md:text-2xl font-black italic", score.accuracy >= PASS_THRESHOLD ? "text-[#00FF66]" : "text-[#FF3D00]")}>
              {score.accuracy}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden rounded-2xl md:rounded-[3rem] border border-white/5 z-20 pointer-events-auto">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1.5px, transparent 1.5px)', backgroundSize: '40px 40px' }} />

        {visibleNotes.map(({ noteId, sound, step }) => {
          const Icon = OBJECT_ICONS[sound.type];
          const baseColor = OBJECT_COLORS[sound.type];
          const isCaptured = capturedNotes.has(noteId);
          const isMissed = missedNotes.has(noteId);
          const feedbackColor = isCaptured ? '#00FF66' : isMissed ? '#FF3D00' : baseColor;
          const pos = getPosition(`catcher-v10-${game.id}-${sound.id}-${step}`);

          return (
            <div
              key={noteId}
              onPointerDown={(e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                handleCatch(noteId, sound); 
              }}
              className={cn(
                "absolute z-30 pointer-events-auto cursor-pointer select-none touch-none flex items-center justify-center",
                (isCaptured || isMissed) && "animate-out fade-out duration-300"
              )}
              style={{ 
                left: `${pos.x}%`, 
                top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
                // Massive Hitbox: Das gesamte 160x160 Quadrat ist klickbar
                width: '160px',
                height: '160px',
              }}
            >
              <div className="relative w-full h-full flex items-center justify-center bg-transparent">
                {/* Statische Glanz-Effekte & Haptischer Schatten */}
                <div 
                  className={cn(
                    "absolute inset-4 rounded-full blur-[40px] opacity-20 transition-all duration-75",
                    isCaptured ? "bg-[#00FF66] opacity-100" : isMissed ? "bg-[#FF3D00] opacity-80" : ""
                  )} 
                  style={{ backgroundColor: isCaptured || isMissed ? undefined : baseColor }} 
                />
                
                {/* Plastisches Icon-Design mit feinerem Strich */}
                <div className="relative flex items-center justify-center pointer-events-none">
                  <Icon 
                    className="w-24 h-24 md:w-32 md:h-32 transition-colors duration-75"
                    strokeWidth={0.8}
                    style={{ color: feedbackColor, filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.8))' }} 
                  />
                  {!isCaptured && !isMissed && (
                    <div className="absolute inset-0 pointer-events-none opacity-40">
                      {/* Statisches Glossy-Finish */}
                      <div className="absolute top-[10%] left-[20%] w-[60%] h-[25%] bg-gradient-to-b from-white/60 to-transparent rounded-full blur-[2px]" />
                    </div>
                  )}
                </div>
              </div>
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
        <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] text-white/10 italic">Urban Sequential Interface v10.0</p>
      </footer>
    </div>
  );
};
