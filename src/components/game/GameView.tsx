
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

// Constant for sync offset
export const SYNC_OFFSET = 0.0;

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
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [countIn, setCountIn] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [score, setScore] = useState<GameScore>({ hits: 0, misses: 0, accuracy: 100 });
  const [isFinished, setIsFinished] = useState(false);
  const [hasStartedFade, setHasStartedFade] = useState(false);
  
  const [padFlashes, setPadFlashes] = useState<Record<SoundType, { type: FlashType, key: number }>>({
    kick: { type: null, key: 0 },
    clap: { type: null, key: 0 },
    percs: { type: null, key: 0 },
    misc: { type: null, key: 0 },
  });
  
  const frameRef = useRef<number>(null);
  const clearedNotesRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();

  const bpm = game.bpm || 120;
  const TOTAL_STEPS = 256; // 16 Bars * 16 steps
  const SESSION_DURATION = (16 * 4 * 60) / bpm; // 16 Bars
  const FADE_DURATION = 2;

  const activeSoundTypes: SoundType[] = ['kick'];
  if (level.difficulty >= 2) activeSoundTypes.push('clap');
  if (level.difficulty >= 3) activeSoundTypes.push('percs');
  if (level.difficulty >= 4) activeSoundTypes.push('misc');

  const filteredSounds = sounds.filter(s => activeSoundTypes.includes(s.type));

  const soundsWithPatterns = filteredSounds.map(sound => {
    const uniqueSteps = new Set<number>();
    sound.patternIds?.forEach((pId, index) => {
      const pattern = patterns.find(p => p.id === pId);
      if (pattern) {
        const offset = index * 128; 
        pattern.steps.forEach(s => {
          const actualStep = s + offset;
          if (actualStep < TOTAL_STEPS) {
            uniqueSteps.add(actualStep);
          }
        });
      }
    });
    return { ...sound, triggerSteps: Array.from(uniqueSteps).sort((a, b) => a - b) };
  });

  useEffect(() => {
    return () => {
      audioEngine?.stop();
    };
  }, []);

  useEffect(() => {
    const preload = async () => {
      if (!audioEngine) return;
      const urls = [
        ...filteredSounds.map(s => s.sampleUrl),
        game.backingTrackUrl || ''
      ];
      await audioEngine.preloadAudio(urls);
    };
    preload();
  }, [filteredSounds, game.backingTrackUrl]);

  const triggerPadFlash = (type: SoundType, flashType: FlashType) => {
    setPadFlashes(prev => ({
      ...prev,
      [type]: { type: flashType, key: Date.now() }
    }));
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

          if (t >= SESSION_DURATION - FADE_DURATION && !hasStartedFade) {
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
              return { 
                hits: prev.hits, 
                misses: nextMisses, 
                accuracy: total === 0 ? 100 : Math.round((prev.hits / total) * 100) 
              };
            });
          }
          
          if (t >= SESSION_DURATION + 1) { 
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
    <div className="flex flex-col h-screen bg-[#050505] text-white p-2 md:p-4 max-w-5xl mx-auto overflow-hidden">
      <header className="flex justify-between items-center mb-1 px-2 h-10 md:h-12 shrink-0">
        <div className="flex items-center gap-2">
          <Link href={`/studio/${game.studioId}`}>
            <ArrowLeft className="w-4 h-4 text-white/50 hover:text-white" />
          </Link>
          <div className="flex flex-col">
            <h1 className="text-[10px] md:text-xs font-black uppercase italic tracking-tighter text-white leading-none">Session</h1>
            <p className="text-[7px] md:text-[8px] uppercase font-black opacity-30 tracking-widest line-clamp-1">{game.name}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full border border-white/10 h-8 md:h-10">
            <Percent className="w-3 h-3 text-[#FFEA00]" />
            <p className={cn("text-sm md:text-2xl font-black italic leading-none", score.accuracy >= PASS_THRESHOLD ? "text-[#00E676]" : "text-[#FF3D00]")}>
              {score.accuracy}
            </p>
          </div>
        </div>
      </header>

      <main className="relative flex-1 gemini-border gemini-glow overflow-hidden flex flex-col bg-black/40 rounded-2xl md:rounded-[2rem]">
        <div className="flex-1 flex px-1">
          {activeSoundTypes.map((type) => {
            const sound = soundsWithPatterns.find(s => s.type === type);
            return (
              <NoteLane key={type} notes={sound?.triggerSteps || []} currentTime={currentTime} bpm={bpm} isActive={isPlaying} color={PAD_COLORS[type]} />
            );
          })}
        </div>

        <div className="p-2 md:p-8 bg-black/60 border-t border-white/5 shrink-0">
          <div className={cn(
            "grid gap-2 md:gap-4 max-w-lg mx-auto",
            activeSoundTypes.length === 1 ? "grid-cols-1 max-w-[120px]" :
            activeSoundTypes.length === 2 ? "grid-cols-2 max-w-[240px]" :
            "grid-cols-4"
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
          <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="text-center mx-4">
              <Sparkles className="w-12 h-12 text-[#993DEB] mx-auto mb-4 animate-pulse-neon" />
              <h2 className="text-xl md:text-4xl font-black mb-8 uppercase italic tracking-tighter">Sync Interface</h2>
              <Button onClick={startLevel} disabled={isLoadingAudio} className="w-48 md:w-64 h-14 md:h-20 text-sm md:text-2xl font-black uppercase italic bg-white text-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)]">
                {isLoadingAudio ? <Loader2 className="animate-spin" /> : "Initiate Pulse"}
              </Button>
            </div>
          </div>
        )}

        {countIn !== null && (
          <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="text-[8rem] md:text-[14rem] font-black italic text-[#FFEA00] drop-shadow-[0_0_50px_rgba(255,234,0,0.4)] animate-in zoom-in-50 duration-200">{countIn}</div>
          </div>
        )}

        {isFinished && (
          <div className="absolute inset-0 bg-black/98 flex items-center justify-center p-6 z-50">
            <div className="text-center space-y-6 max-w-sm">
              {score.accuracy >= PASS_THRESHOLD ? (
                <>
                  <Trophy className="w-16 h-16 text-[#FFEA00] mx-auto drop-shadow-[0_0_20px_#FFEA00]" />
                  <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter">Gold Mastered</h2>
                  <p className="text-[#00E676] font-black text-2xl md:text-4xl italic">{score.accuracy}% Sync</p>
                </>
              ) : (
                <>
                  <XCircle className="w-16 h-16 text-[#FF3D00] mx-auto drop-shadow-[0_0_20px_#FF3D00]" />
                  <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter">Desynced</h2>
                  <p className="text-[#FF3D00] font-black text-2xl md:text-4xl italic">{score.accuracy}% Sync</p>
                </>
              )}
              <div className="flex gap-4 pt-10">
                <Button onClick={startLevel} variant="outline" className="flex-1 h-14 border-white/20 text-xs md:text-sm uppercase font-black italic rounded-xl">Retry</Button>
                <Link href={`/studio/${game.studioId}`} className="flex-1">
                  <Button className="w-full h-14 bg-white text-black font-black uppercase italic rounded-xl">Return</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
