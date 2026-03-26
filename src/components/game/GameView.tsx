
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Game, Level, Sound, GameScore, SoundType, TriggerPattern } from '@/lib/game/types';
import { audioEngine, AudioEngine } from '@/lib/game/audio-engine';
import { SamplerPad, FlashType } from './SamplerPad';
import { NoteLane } from './NoteLane';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, RotateCcw, Trophy, Home, Loader2, Music2, CheckCircle2, AlertCircle, XCircle, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc, increment, setDoc, serverTimestamp } from 'firebase/firestore';

const SYNC_OFFSET = 0.08;

const PAD_COLORS: Record<SoundType, string> = {
  kick: '#993DEB',
  clap: '#FF3D00',
  percs: '#FFEA00',
  misc: '#FFFF00',
};

const SHORTCUTS: Record<SoundType, string> = {
  kick: 'A',
  clap: 'S',
  percs: 'D',
  misc: 'F',
};

const PASS_THRESHOLD = 90;

const DIFFICULTY_REWARDS: Record<number, number> = {
  1: 50,
  2: 100,
  3: 200,
  4: 1000,
};

interface GameViewProps {
  game: Game;
  level: Level;
  sounds: Sound[];
  patterns: TriggerPattern[];
}

export const GameView: React.FC<GameViewProps> = ({ game, level, sounds, patterns }) => {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [countIn, setCountIn] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [score, setScore] = useState<GameScore>({ hits: 0, misses: 0, accuracy: 100 });
  const [isFinished, setIsFinished] = useState(false);
  const [hasAwardedPoints, setHasAwardedPoints] = useState(false);
  const [loadStates, setLoadStates] = useState<Record<string, string>>({});
  
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

  const TOTAL_STEPS = 512;
  const bpm = game.bpm || 120;
  const backingTrackUrl = game.backingTrackUrl || '';

  useEffect(() => {
    const urls = [backingTrackUrl, ...sounds.map(s => s.sampleUrl), AudioEngine.METRONOME_URL];
    if (audioEngine) {
      audioEngine.preloadAudio(urls);
    }

    const interval = setInterval(() => {
      if (audioEngine) {
        const newStates: Record<string, string> = {};
        urls.forEach(url => {
          newStates[url] = audioEngine.getLoadStatus(url);
        });
        setLoadStates(newStates);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [backingTrackUrl, sounds]);

  const backingTrackReady = loadStates[backingTrackUrl] === 'ready';
  const metronomeReady = loadStates[AudioEngine.METRONOME_URL] === 'ready';

  const checkIsPlayable = (type: SoundType, difficulty: number) => {
    if (type === 'kick') return difficulty >= 1;
    if (type === 'clap') return difficulty >= 2;
    if (type === 'percs') return difficulty >= 3;
    if (type === 'misc') return difficulty >= 4;
    return true; 
  };

  const triggerPadFlash = (type: SoundType, flashType: FlashType) => {
    setPadFlashes(prev => ({
      ...prev,
      [type]: { type: flashType, key: Date.now() }
    }));
  };

  const handlePadPress = useCallback((type: SoundType) => {
    if (!audioEngine || !isPlaying) return;
    if (!checkIsPlayable(type, level.difficulty)) return;

    const sound = soundsWithPatterns.find(s => s.type === type);
    if (sound) {
      audioEngine.playOneShot(sound.sampleUrl);
      const time = audioEngine.getCurrentTime();
      const adjustedTime = time - SYNC_OFFSET; 
      const secondsPerStep = (60 / bpm) / 4;
      const currentStep = adjustedTime / secondsPerStep;
      const tolerance = 1.0; 
      
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
          return { hits: nextHits, misses: prev.misses, accuracy: total === 0 ? 100 : Math.round((nextHits / total) * 100) };
        });
      } else {
        triggerPadFlash(type, 'miss');
        setScore(prev => {
          const nextMisses = prev.misses + 1;
          const total = prev.hits + nextMisses;
          return { hits: prev.hits, misses: nextMisses, accuracy: total === 0 ? 100 : Math.round((prev.hits / total) * 100) };
        });
      }
    }
  }, [isPlaying, soundsWithPatterns, level.difficulty, bpm]);

  const startLevel = async () => {
    if (!audioEngine) return;
    setIsLoadingAudio(true);
    try {
      const isResumed = await audioEngine.resume();
      if (!isResumed) throw new Error("AudioContext failed to resume");

      clearedNotesRef.current = new Set();
      setScore({ hits: 0, misses: 0, accuracy: 100 });
      setIsFinished(false);
      setHasAwardedPoints(false);
      
      const secondsPerBeat = 60 / bpm;
      const now = audioEngine.getContextTime();
      const actualStartTime = now + (4 * secondsPerBeat);
      audioEngine.setStartTime(actualStartTime);
      setIsPlaying(true); 

      if (metronomeReady) {
        await audioEngine.playCountIn(bpm, (beat) => setCountIn(5 - beat));
        setCountIn(null);
      }
      if (backingTrackReady) await audioEngine.startBackingTrack(backingTrackUrl, actualStartTime);
    } catch (e) {
      toast({ variant: "destructive", title: "Audio Error", description: "The audio system could not be started." });
      setCountIn(null);
      setIsPlaying(false);
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
          const tolerance = 1.0;

          let newMisses = 0;
          soundsWithPatterns.forEach(sound => {
            if (!checkIsPlayable(sound.type, level.difficulty)) return;
            sound.triggerSteps.forEach(step => {
              const noteId = `${sound.type}-${step}`;
              if (!clearedNotesRef.current.has(noteId) && currentStep > step + tolerance) {
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
          
          if (t >= (TOTAL_STEPS / 4) * (60 / bpm)) { 
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
  }, [isPlaying, bpm, level.difficulty, soundsWithPatterns]);

  const isPassed = score.accuracy >= PASS_THRESHOLD;

  useEffect(() => {
    if (isFinished && isPassed && !hasAwardedPoints && user && db) {
      const reward = DIFFICULTY_REWARDS[level.difficulty] || 0;
      const userRef = doc(db, 'users', user.uid);
      const progressRef = doc(db, 'users', user.uid, 'progress', level.id);
      updateDoc(userRef, { streetCred: increment(reward) }).catch(() => setDoc(userRef, { streetCred: reward }, { merge: true }));
      setDoc(progressRef, { levelId: level.id, accuracy: score.accuracy, completedAt: serverTimestamp() }, { merge: true });
      setHasAwardedPoints(true);
    }
  }, [isFinished, isPassed, hasAwardedPoints, user, db, level, score.accuracy]);

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-4 md:p-6 max-w-5xl mx-auto overflow-hidden">
      <div className="flex justify-between items-center mb-4 md:mb-6 gap-2">
        <div className="flex items-center gap-2 md:gap-6 min-w-0">
          <Link href={`/studio/${game.studioId}`} className="min-w-0">
            <div className="cursor-pointer group">
              <h1 className="text-xl md:text-4xl font-black tracking-tighter text-white uppercase italic leading-none group-hover:text-[#993DEB] transition-colors truncate">BeatHero</h1>
              <p className="text-[8px] md:text-[10px] opacity-40 font-black uppercase tracking-[0.2em] mt-1 truncate">
                {game.name} • {level.name}
              </p>
            </div>
          </Link>
          {(isPlaying || countIn !== null) && (
            <Button variant="ghost" size="sm" onClick={() => { audioEngine?.stop(); router.push(`/studio/${game.studioId}`); }} className="text-[8px] md:text-[10px] uppercase font-black tracking-widest text-destructive border border-destructive/20 gap-1 px-2 h-7 rounded-full shrink-0">
              <X className="w-2 h-2" /> Abort
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-3 md:gap-8 shrink-0">
          <div className="text-right border-l border-white/10 pl-3 md:pl-8">
            <p className="text-[8px] md:text-[10px] uppercase font-black tracking-widest opacity-30">Accuracy</p>
            <div className="flex items-center gap-1.5 md:gap-3">
              <p className={cn("text-2xl md:text-4xl font-black italic tracking-tighter transition-colors", isPassed ? "text-[#00E676]" : "text-[#FF3D00]")}>
                {score.accuracy}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative flex-1 gemini-border gemini-glow overflow-hidden flex flex-col">
        <div className="flex-1 flex px-2 md:px-4 relative bg-black/40">
          {(['kick', 'clap', 'percs', 'misc'] as SoundType[]).map((type) => {
            const sound = soundsWithPatterns.find(s => s.type === type);
            return (
              <NoteLane key={type} notes={sound?.triggerSteps || []} currentTime={currentTime} bpm={bpm} isActive={isPlaying && checkIsPlayable(type, level.difficulty)} color={PAD_COLORS[type]} />
            );
          })}
        </div>

        <div className="p-4 md:p-8 bg-black/40 border-t border-white/5 flex flex-col gap-4">
          <div className="flex justify-center gap-3 md:gap-6">
            {(['kick', 'clap', 'percs', 'misc'] as SoundType[]).map((type) => (
              <div key={type} className="flex flex-col items-center gap-2 w-full max-w-[140px]">
                <SamplerPad label={type} shortcut={SHORTCUTS[type]} onPress={() => handlePadPress(type)} color={PAD_COLORS[type]} isInactive={!checkIsPlayable(type, level.difficulty)} flash={padFlashes[type].type} key={padFlashes[type].key} />
              </div>
            ))}
          </div>
        </div>

        {!isPlaying && !isFinished && countIn === null && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <Card className="p-8 md:p-12 bg-black border-none gemini-border gemini-glow text-center max-w-sm w-full">
              <Music2 className="w-12 h-12 text-[#993DEB] mx-auto mb-6" />
              <h2 className="text-2xl md:text-3xl font-black mb-6 uppercase italic tracking-tighter">Ready?</h2>
              <Button onClick={startLevel} disabled={isLoadingAudio || !backingTrackReady} className="w-full h-12 md:h-16 text-lg md:text-xl font-black uppercase italic tracking-tighter bg-white text-black hover:bg-white/90 rounded-xl md:rounded-2xl">
                {isLoadingAudio ? <Loader2 className="animate-spin" /> : "Start Level"}
              </Button>
            </Card>
          </div>
        )}

        {countIn !== null && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50 pointer-events-none">
            <div className="text-[8rem] md:text-[12rem] font-black italic tracking-tighter text-white/80 animate-in zoom-in-50 duration-200">
              {countIn}
            </div>
          </div>
        )}

        {isFinished && (
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 z-50">
            <div className="max-w-md w-full text-center space-y-6 animate-in zoom-in-95 duration-500">
              {isPassed ? (
                <>
                  <Trophy className="w-16 h-16 text-[#FFEA00] mx-auto mb-4" />
                  <h2 className="text-3xl md:text-5xl font-black text-white uppercase italic tracking-tighter">Accomplished</h2>
                  <p className="text-[#00E676] font-black text-2xl italic">{score.accuracy}% Accuracy</p>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10 inline-block">
                    <p className="text-[#FFEA00] font-black text-xl tracking-widest">+{DIFFICULTY_REWARDS[level.difficulty]} SC</p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="w-16 h-16 text-[#FF3D00] mx-auto mb-4" />
                  <h2 className="text-3xl md:text-5xl font-black text-white uppercase italic tracking-tighter">Level Failed</h2>
                  <p className="text-[#FF3D00] font-black text-2xl italic">{score.accuracy}% Accuracy</p>
                </>
              )}
              <div className="flex gap-4 pt-8">
                <Button onClick={startLevel} variant="outline" className="flex-1 h-12 border-white/20 bg-white/5 rounded-xl font-black uppercase italic tracking-tighter">Retry</Button>
                <Link href={`/studio/${game.studioId}`} className="flex-1">
                  <Button className="w-full h-12 bg-white text-black rounded-xl font-black uppercase italic tracking-tighter">Studio</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
