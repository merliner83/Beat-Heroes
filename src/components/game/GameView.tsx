"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Game, Level, Sound, GameScore, SoundType, TriggerPattern } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { SamplerPad, FlashType } from './SamplerPad';
import { NoteLane } from './NoteLane';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Music2, Trophy, Loader2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc, increment, setDoc, serverTimestamp } from 'firebase/firestore';

const SYNC_OFFSET = 0.08;
const PAD_COLORS: Record<SoundType, string> = {
  kick: '#993DEB',
  clap: '#FF3D00',
  percs: '#FFEA00',
  misc: '#FFFFFF',
};
const SHORTCUTS: Record<SoundType, string> = {
  kick: 'A',
  clap: 'S',
  percs: 'D',
  misc: 'F',
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
  
  const [padFlashes, setPadFlashes] = useState<Record<SoundType, { type: FlashType, key: number }>>({
    kick: { type: null, key: 0 },
    clap: { type: null, key: 0 },
    percs: { type: null, key: 0 },
    misc: { type: null, key: 0 },
  });
  
  const frameRef = useRef<number>(null);
  const clearedNotesRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();

  const soundsWithPatterns = sounds.map(sound => {
    let allSteps: number[] = [];
    sound.patternIds?.forEach((pId, index) => {
      const pattern = patterns.find(p => p.id === pId);
      if (pattern) {
        const offset = index * 128;
        allSteps = [...allSteps, ...pattern.steps.map(s => s + offset)];
      }
    });
    return { ...sound, triggerSteps: allSteps };
  });

  const bpm = game.bpm || 120;
  const TOTAL_STEPS = 512;

  const triggerPadFlash = (type: SoundType, flashType: FlashType) => {
    setPadFlashes(prev => ({
      ...prev,
      [type]: { type: flashType, key: Date.now() }
    }));
  };

  const handlePadPress = useCallback((type: SoundType) => {
    if (!audioEngine || !isPlaying) return;
    const sound = soundsWithPatterns.find(s => s.type === type);
    if (!sound) return;

    audioEngine.playOneShot(sound.sampleUrl);
    const time = audioEngine.getCurrentTime();
    const currentStep = (time - SYNC_OFFSET) / ((60 / bpm) / 4);
    const tolerance = 1.2; 
    
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
        return { hits: prev.hits, misses: nextMisses, accuracy: Math.round((prev.hits / total) * 100) };
      });
    }
  }, [isPlaying, soundsWithPatterns, bpm]);

  const startLevel = async () => {
    if (!audioEngine) return;
    setIsLoadingAudio(true);
    try {
      await audioEngine.resume();
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
          const currentStep = (t - SYNC_OFFSET) / ((60 / bpm) / 4);
          const tolerance = 1.2;

          let passiveMisses = 0;
          soundsWithPatterns.forEach(sound => {
            sound.triggerSteps.forEach(step => {
              const noteId = `${sound.type}-${step}`;
              if (!clearedNotesRef.current.has(noteId) && currentStep > step + tolerance) {
                clearedNotesRef.current.add(noteId);
                passiveMisses++;
              }
            });
          });

          if (passiveMisses > 0) {
            setScore(prev => {
              const nextMisses = prev.misses + passiveMisses;
              const total = prev.hits + nextMisses;
              return { hits: prev.hits, misses: nextMisses, accuracy: Math.round((prev.hits / total) * 100) };
            });
          }
          
          if (t >= (TOTAL_STEPS / 4) * (60 / bpm) + 2) { 
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
    if (isFinished && score.accuracy >= PASS_THRESHOLD && user && db) {
      updateDoc(doc(db, 'users', user.uid), { streetCred: increment(100) });
      setDoc(doc(db, 'users', user.uid, 'progress', level.id), { 
        levelId: level.id, 
        accuracy: score.accuracy, 
        completedAt: serverTimestamp() 
      }, { merge: true });
    }
  }, [isFinished, score.accuracy, user, db, level]);

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-2 md:p-4 max-w-5xl mx-auto overflow-hidden">
      <header className="flex justify-between items-center mb-2 md:mb-4 px-2">
        <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
          <Link href={`/studio/${game.studioId}`}>
            <h1 className="text-base md:text-2xl font-black uppercase italic tracking-tighter text-white">BeatHero</h1>
          </Link>
          <div className="h-4 w-px bg-white/10 hidden md:block" />
          <p className="text-[7px] md:text-[10px] uppercase font-black opacity-30 tracking-widest line-clamp-1">{game.name} • {level.name}</p>
        </div>
        
        <div className="flex items-center gap-3 md:gap-6">
          <div className="text-right">
            <p className="text-[7px] md:text-[8px] uppercase font-black opacity-30 mb-0.5">Accuracy</p>
            <p className={cn("text-lg md:text-2xl font-black italic leading-none", score.accuracy >= PASS_THRESHOLD ? "text-[#00E676]" : "text-[#FF3D00]")}>
              {score.accuracy}%
            </p>
          </div>
        </div>
      </header>

      <main className="relative flex-1 gemini-border gemini-glow overflow-hidden flex flex-col bg-black/40">
        <div className="flex-1 flex px-1">
          {(['kick', 'clap', 'percs', 'misc'] as SoundType[]).map((type) => {
            const sound = soundsWithPatterns.find(s => s.type === type);
            return (
              <NoteLane key={type} notes={sound?.triggerSteps || []} currentTime={currentTime} bpm={bpm} isActive={isPlaying} color={PAD_COLORS[type]} />
            );
          })}
        </div>

        <div className="p-4 md:p-10 bg-black/60 border-t border-white/5">
          <div className="flex justify-center gap-2 md:gap-8">
            {(['kick', 'clap', 'percs', 'misc'] as SoundType[]).map((type) => (
              <SamplerPad 
                key={type} 
                label={type} 
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
          <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
            <Card className="p-8 md:p-12 bg-black border-none gemini-border text-center">
              <Music2 className="w-8 h-8 md:w-12 md:h-12 text-[#993DEB] mx-auto mb-6" />
              <h2 className="text-xl md:text-3xl font-black mb-8 uppercase italic tracking-tighter">Ready to Produce?</h2>
              <Button onClick={startLevel} disabled={isLoadingAudio} className="w-40 md:w-56 h-12 md:h-16 text-lg md:text-xl font-black uppercase italic bg-white text-black rounded-2xl hover:scale-105 transition-transform">
                {isLoadingAudio ? <Loader2 className="animate-spin" /> : "Start Session"}
              </Button>
            </Card>
          </div>
        )}

        {countIn !== null && (
          <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="text-[6rem] md:text-[12rem] font-black italic text-[#FFEA00] drop-shadow-[0_0_30px_rgba(255,234,0,0.5)] animate-in zoom-in-50">{countIn}</div>
          </div>
        )}

        {isFinished && (
          <div className="absolute inset-0 bg-black/95 flex items-center justify-center p-6 z-50">
            <div className="text-center space-y-6">
              {score.accuracy >= PASS_THRESHOLD ? (
                <>
                  <Trophy className="w-12 h-12 md:w-16 md:h-16 text-[#FFEA00] mx-auto" />
                  <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter">Gold Standard</h2>
                  <p className="text-[#00E676] font-black text-2xl md:text-3xl italic">{score.accuracy}% Accuracy</p>
                </>
              ) : (
                <>
                  <XCircle className="w-12 h-12 md:w-16 md:h-16 text-[#FF3D00] mx-auto" />
                  <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter">Session Rejected</h2>
                  <p className="text-[#FF3D00] font-black text-2xl md:text-3xl italic">{score.accuracy}% Accuracy</p>
                </>
              )}
              <div className="flex gap-4 pt-8 max-w-sm mx-auto">
                <Button onClick={startLevel} variant="outline" className="flex-1 h-12 border-white/20">Retry</Button>
                <Link href={`/studio/${game.studioId}`} className="flex-1">
                  <Button className="w-full h-12 bg-white text-black font-black uppercase italic">Studio</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
