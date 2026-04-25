
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Game, Level, Sound, GameScore, SoundType, TriggerPattern } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { SamplerPad, FlashType } from './SamplerPad';
import { NoteLane } from './NoteLane';
import { Button } from '@/components/ui/button';
import { Music2, Trophy, Loader2, XCircle, ArrowLeft, Sparkles, Percent } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore } from '@/firebase';
import { doc, increment, setDoc, serverTimestamp } from 'firebase/firestore';

export const SYNC_OFFSET = 0.03;
export const HIT_POSITION = 550; 

const PAD_COLORS: Record<SoundType, string> = {
  kick: '#993DEB',
  clap: '#FF3D00',
  percs: '#FFEA00',
  misc: '#3838FA',
};

const PAD_LABELS: Record<SoundType, string> = {
  kick: 'PAD 1',
  clap: 'PAD 2',
  percs: 'PAD 3',
  misc: 'PAD 4',
};

const SHORTCUTS: Record<SoundType, string> = {
  kick: 'A',
  clap: 'S',
  percs: 'K',
  misc: 'L',
};

const PASS_THRESHOLD = 80;

interface GameViewProps {
  game: Game;
  level: Level;
  sounds: Sound[];
  patterns: TriggerPattern[];
}

export const GameView: React.FC<GameViewProps> = ({ game, level, sounds, patterns }) => {
  const db = useFirestore();
  const { user } = useUser();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [countIn, setCountIn] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [score, setScore] = useState<GameScore>({ hits: 0, misses: 0, accuracy: 100 });
  const [isFinished, setIsFinished] = useState(false);
  const [hasStartedFade, setHasStartedFade] = useState(false);
  
  const [globalFlash, setGlobalFlash] = useState<{ type: FlashType, key: number }>({ type: null, key: 0 });
  const [padFlashes, setPadFlashes] = useState<Record<SoundType, { type: FlashType, key: number }>>({
    kick: { type: null, key: 0 },
    clap: { type: null, key: 0 },
    percs: { type: null, key: 0 },
    misc: { type: null, key: 0 },
  });
  
  const frameRef = useRef<number>(null);
  const clearedNotesRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();

  const bpm = game.bpm || 128;
  const TOTAL_STEPS = 320; 
  const SESSION_DURATION = (20 * 4 * 60) / bpm; 
  const FADE_DURATION = 2;

  const activeSoundTypes: SoundType[] = ['kick'];
  if (level.difficulty >= 2) activeSoundTypes.push('clap');
  if (level.difficulty >= 3) activeSoundTypes.push('percs');
  if (level.difficulty >= 4) activeSoundTypes.push('misc');

  const filteredSounds = sounds.filter(s => activeSoundTypes.includes(s.type));

  const soundsWithPatterns = filteredSounds.map(sound => {
    const uniqueSteps = new Set<number>();
    const patternOffsets = [0, 64, 192]; 
    sound.patternIds?.forEach((pId, index) => {
      const pattern = patterns.find(p => p.id === pId);
      if (pattern && index < patternOffsets.length) {
        const offset = patternOffsets[index];
        const maxStepsInSection = index === 0 ? 64 : 128;
        pattern.steps.forEach(s => {
          if (s < maxStepsInSection) {
            const actualStep = s + offset;
            if (actualStep < TOTAL_STEPS) {
              uniqueSteps.add(actualStep);
            }
          }
        });
      }
    });
    return { ...sound, triggerSteps: Array.from(uniqueSteps).sort((a, b) => a - b) };
  });

  // Background Preloading on Mount
  useEffect(() => {
    const preload = async () => {
      if (!audioEngine) return;
      const urls = [
        game.backingTrackUrl || '',
        ...filteredSounds.map(s => s.sampleUrl)
      ];
      await audioEngine.preloadAudio(urls);
      setIsAudioReady(true);
    };
    preload();
  }, [filteredSounds, game.backingTrackUrl]);

  useEffect(() => {
    return () => {
      audioEngine?.stop();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const triggerPadFlash = (type: SoundType, flashType: FlashType) => {
    const key = Date.now();
    setPadFlashes(prev => ({ ...prev, [type]: { type: flashType, key } }));
    setGlobalFlash({ type: flashType, key });
  };

  const handlePadPress = useCallback((type: SoundType) => {
    if (!audioEngine || !isPlaying) return;
    if (!activeSoundTypes.includes(type)) return;

    const sound = soundsWithPatterns.find(s => s.type === type);
    if (!sound) return;

    audioEngine.playOneShot(sound.sampleUrl);
    const time = audioEngine.getCurrentTime();
    const secondsPerStep = (60 / bpm) / 4;
    
    const currentStep = (time - SYNC_OFFSET) / secondsPerStep;
    const tolerance = level.difficulty <= 2 ? 1.8 : 1.4; 
    
    let hitNoteId: string | null = null;
    let minDiff = Infinity;

    sound.triggerSteps.forEach(step => {
      const noteId = `${type}-${step}`;
      if (clearedNotesRef.current.has(noteId)) return;
      const diff = Math.abs(currentStep - step);
      if (diff <= tolerance && diff < minDiff) {
        minDiff = diff;
        hitNoteId = noteId;
      }
    });

    if (hitNoteId) {
      triggerPadFlash(type, 'hit');
      clearedNotesRef.current.add(hitNoteId);
      setScore(prev => {
        const nextHits = prev.hits + 1;
        const total = nextHits + prev.misses;
        return { hits: nextHits, misses: prev.misses, accuracy: Math.round((nextHits / total) * 100) };
      });
    } else {
      triggerPadFlash(type, 'miss');
      setScore(prev => {
        const nextMisses = prev.misses + 1;
        const total = prev.hits + nextMisses;
        return { hits: prev.hits, misses: nextMisses, accuracy: total === 0 ? 100 : Math.round((prev.hits / total) * 100) };
      });
    }
  }, [isPlaying, soundsWithPatterns, bpm, activeSoundTypes, level.difficulty]);

  const startLevel = async () => {
    if (!audioEngine) return;
    setIsLoadingAudio(true);
    setHasStartedFade(false);
    try {
      await audioEngine.resume();
      
      const urlsToLoad = [game.backingTrackUrl || '', ...filteredSounds.map(s => s.sampleUrl)];
      // This will return immediately if background preloading is already done
      await audioEngine.preloadAudio(urlsToLoad);

      clearedNotesRef.current = new Set();
      setScore({ hits: 0, misses: 0, accuracy: 100 });
      setIsFinished(false);
      
      const secondsPerBeat = 60 / bpm;
      const now = audioEngine.getContextTime();
      const actualStartTime = now + (4 * secondsPerBeat);
      audioEngine.setStartTime(actualStartTime);
      
      await audioEngine.playCountIn(bpm, (beat) => setCountIn(5 - beat));
      setCountIn(null);
      setIsPlaying(true); 
      await audioEngine.startBackingTrack(game.backingTrackUrl || '', actualStartTime);
    } catch (e) {
      toast({ variant: "destructive", title: "Audio Error" });
    } finally {
      setIsLoadingAudio(false);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      const update = () => {
        if (audioEngine) {
          const t = audioEngine.getCurrentTime();
          setCurrentTime(t);
          const secondsPerStep = (60 / bpm) / 4;
          const currentStep = (t - SYNC_OFFSET) / secondsPerStep;
          const tolerance = level.difficulty <= 2 ? 1.8 : 1.4;

          if (t >= SESSION_DURATION && !hasStartedFade) {
            setHasStartedFade(true);
            audioEngine.fadeBackingTrack(FADE_DURATION);
          }

          let passiveMissesCount = 0;
          soundsWithPatterns.forEach(sound => {
            sound.triggerSteps.forEach(step => {
              const noteId = `${sound.type}-${step}`;
              if (!clearedNotesRef.current.has(noteId) && currentStep > step + tolerance) {
                clearedNotesRef.current.add(noteId);
                passiveMissesCount++;
              }
            });
          });

          if (passiveMissesCount > 0) {
            setScore(prev => {
              const nextMisses = prev.misses + passiveMissesCount;
              const total = prev.hits + nextMisses;
              return { hits: prev.hits, misses: nextMisses, accuracy: total === 0 ? 100 : Math.round((prev.hits / total) * 100) };
            });
          }
          
          if (t >= SESSION_DURATION + FADE_DURATION) { 
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
  }, [isPlaying, bpm, soundsWithPatterns, level.difficulty, SESSION_DURATION, hasStartedFade]);

  useEffect(() => {
    if (isFinished && score.accuracy >= PASS_THRESHOLD && user && db) {
      setDoc(doc(db, 'users', user.uid), { streetCred: increment(100) }, { merge: true });
      setDoc(doc(db, 'users', user.uid, 'progress', level.id), { 
        levelId: level.id, 
        accuracy: score.accuracy, 
        completedAt: serverTimestamp() 
      }, { merge: true });
    }
  }, [isFinished, score.accuracy, user, db, level]);

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-3 md:p-6 max-w-6xl mx-auto overflow-hidden">
      <header className="flex justify-between items-center mb-2 px-4 h-12 md:h-16 shrink-0 relative z-[60]">
        <div className="flex items-center gap-4">
          <Link href={`/studio/${game.studioId}`}>
            <ArrowLeft className="w-6 h-6 text-white/50 hover:text-white" />
          </Link>
          <div className="flex flex-col">
            <h1 className="text-xs md:text-sm font-black uppercase italic tracking-tighter text-white leading-none">Session</h1>
            <p className="text-[9px] md:text-[10px] uppercase font-black opacity-30 tracking-widest line-clamp-1">{game.name}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 bg-black/60 backdrop-blur-xl px-5 py-2 rounded-full border border-white/10 h-10 md:h-14">
            <Percent className="w-4 h-4 text-[#FFEA00]" />
            <p className={cn("text-lg md:text-3xl font-black italic leading-none", score.accuracy >= PASS_THRESHOLD ? "text-[#00E676]" : "text-[#FF3D00]")}>
              {score.accuracy}
            </p>
          </div>
        </div>
      </header>

      <main className="relative flex-1 gemini-border gemini-glow overflow-hidden flex flex-col bg-black/40 rounded-3xl md:rounded-[3rem] z-10">
        <div className="absolute inset-0 z-0">
          <div className="flex h-full px-2 relative">
            {activeSoundTypes.map((type) => {
              const sound = soundsWithPatterns.find(s => s.type === type);
              return (
                <NoteLane key={type} notes={sound?.triggerSteps || []} currentTime={currentTime} bpm={bpm} isActive={isPlaying} color={PAD_COLORS[type]} />
              );
            })}
          </div>
        </div>

        <div 
          key={globalFlash.key}
          className={cn(
            "absolute left-0 right-0 h-2 z-20 pointer-events-none transition-all duration-300 rounded-full",
            globalFlash.type === 'hit' && "bg-[#00E676] shadow-[0_0_40px_#00E676] opacity-100",
            globalFlash.type === 'miss' && "bg-[#FF3D00] shadow-[0_0_40px_#FF3D00] opacity-100",
            !globalFlash.type && "bg-white/20 opacity-30"
          )}
          style={{ top: `${HIT_POSITION}px` }}
        />

        <div className="absolute left-0 right-0 z-40 px-6 md:px-12 pointer-events-none" style={{ top: `${HIT_POSITION + 140}px` }}>
          <div className={cn(
            "grid gap-4 md:gap-8 mx-auto pointer-events-auto bg-black/20 backdrop-blur-sm p-4 rounded-3xl border border-white/5 shadow-2xl",
            activeSoundTypes.length === 1 ? "grid-cols-1 max-w-[140px]" :
            activeSoundTypes.length === 2 ? "grid-cols-2 max-w-[280px]" :
            "grid-cols-4 max-w-xl"
          )}>
            {activeSoundTypes.map((type) => (
              <SamplerPad 
                key={type} 
                label={PAD_LABELS[type]} 
                shortcut={SHORTCUTS[type]} 
                onPress={() => handlePadPress(type)} 
                color={PAD_COLORS[type]} 
                flash={padFlashes[type].type} 
                flashKey={padFlashes[type].key} 
              />
            ))}
          </div>
        </div>

        {!isPlaying && !isFinished && countIn === null && (
          <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-[70] backdrop-blur-sm">
            <div className="text-center mx-6">
              <Sparkles className="w-16 h-16 text-[#993DEB] mx-auto mb-6 animate-pulse-neon" />
              <h2 className="text-2xl md:text-5xl font-black mb-10 uppercase italic tracking-tighter text-gradient">Sync Interface</h2>
              <Button 
                onClick={startLevel} 
                disabled={isLoadingAudio || !isAudioReady} 
                className="w-56 md:w-80 h-16 md:h-24 text-base md:text-3xl font-black uppercase italic bg-white text-black rounded-3xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.2)]"
              >
                {!isAudioReady ? (
                  <><Loader2 className="animate-spin mr-3" /> Loading Modules...</>
                ) : isLoadingAudio ? (
                  <Loader2 className="animate-spin" />
                ) : "Initiate Pulse"}
              </Button>
              {!isAudioReady && (
                <p className="text-[10px] uppercase font-black tracking-widest opacity-30 mt-6">Decoding Rack Signals...</p>
              )}
            </div>
          </div>
        )}

        {countIn !== null && (
          <div className="absolute inset-0 flex items-center justify-center z-[70] pointer-events-none">
            <div className="text-[10rem] md:text-[18rem] font-black italic text-[#FFEA00] drop-shadow-[0_0_70px_rgba(255,234,0,0.4)] animate-in zoom-in-50 duration-200">{countIn}</div>
          </div>
        )}

        {isFinished && (
          <div className="absolute inset-0 bg-black/98 flex items-center justify-center p-8 z-[80] backdrop-blur-2xl">
            <div className="text-center space-y-8 max-md">
              {score.accuracy >= PASS_THRESHOLD ? (
                <>
                  <Trophy className="w-20 h-20 text-[#FFEA00] mx-auto drop-shadow-[0_0_30px_#FFEA00]" />
                  <h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter">Gold Mastered</h2>
                  <p className="text-[#00E676] font-black text-3xl md:text-5xl italic">{score.accuracy}% Sync</p>
                </>
              ) : (
                <>
                  <XCircle className="w-20 h-20 text-[#FF3D00] mx-auto drop-shadow-[0_0_30px_#FF3D00]" />
                  <h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter">Desynced</h2>
                  <p className="text-[#FF3D00] font-black text-3xl md:text-5xl italic">{score.accuracy}% Sync</p>
                </>
              )}
              <div className="flex gap-6 pt-12">
                <Button onClick={startLevel} variant="outline" className="flex-1 h-16 md:h-20 border-white/20 text-sm md:text-lg uppercase font-black italic rounded-2xl">Retry</Button>
                <Link href={`/studio/${game.studioId}`} className="flex-1">
                  <Button className="w-full h-16 md:h-20 bg-white text-black font-black uppercase italic rounded-2xl">Return</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
