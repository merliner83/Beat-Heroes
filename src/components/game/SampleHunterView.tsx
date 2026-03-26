
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Game, Level, Sound, GameScore, SoundType, TriggerPattern } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, RotateCcw, Trophy, Home, Loader2, Music2, Disc, Mic, Speaker, Sparkles, XCircle, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

interface SampleHunterViewProps {
  game: Game;
  level: Level;
  sounds: Sound[];
  patterns: TriggerPattern[];
}

export const SampleHunterView: React.FC<SampleHunterViewProps> = ({ game, level, sounds, patterns }) => {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [countIn, setCountIn] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [score, setScore] = useState<GameScore>({ hits: 0, misses: 0, accuracy: 100 });
  const [isFinished, setIsFinished] = useState(false);
  const [hasAwardedPoints, setHasAwardedPoints] = useState(false);
  const [activeFlashes, setActiveFlashes] = useState<{ type: 'hit' | 'miss', key: number } | null>(null);

  const frameRef = useRef<number>(null);
  const clearedNotesRef = useRef<Set<string>>(new Set());

  const bpm = game.bpm || 120;
  const TOTAL_STEPS = 512;

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

  const triggerFlash = (type: 'hit' | 'miss') => {
    setActiveFlashes({ type, key: Date.now() });
  };

  const startLevel = async () => {
    if (!audioEngine) return;
    setIsLoadingAudio(true);
    try {
      await audioEngine.resume();
      clearedNotesRef.current = new Set();
      setScore({ hits: 0, misses: 0, accuracy: 100 });
      setIsFinished(false);
      setHasAwardedPoints(false);
      
      const secondsPerBeat = 60 / bpm;
      const now = audioEngine.getContextTime();
      const actualStartTime = now + (4 * secondsPerBeat);
      audioEngine.setStartTime(actualStartTime);
      setIsPlaying(true);

      await audioEngine.playCountIn(bpm, (beat) => setCountIn(5 - beat));
      setCountIn(null);
      await audioEngine.startBackingTrack(game.backingTrackUrl || '', actualStartTime);
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Audio engine failed." });
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handleCatch = useCallback(() => {
    if (!audioEngine || !isPlaying) return;
    const time = audioEngine.getCurrentTime();
    const adjustedTime = time - SYNC_OFFSET;
    const secondsPerStep = (60 / bpm) / 4;
    const currentStep = adjustedTime / secondsPerStep;
    const tolerance = 1.2;

    let closestNote: { id: string, sound: Sound } | null = null;
    let minDiff = Infinity;

    soundsWithPatterns.forEach(sound => {
      sound.triggerSteps.forEach(step => {
        const noteId = `${sound.type}-${step}`;
        if (clearedNotesRef.current.has(noteId)) return;
        const diff = Math.abs(currentStep - step);
        if (diff <= tolerance && diff < minDiff) {
          minDiff = diff;
          closestNote = { id: noteId, sound };
        }
      });
    });

    if (closestNote) {
      clearedNotesRef.current.add((closestNote as any).id);
      audioEngine.playOneShot((closestNote as any).sound.sampleUrl);
      triggerFlash('hit');
      setScore(prev => {
        const nextHits = prev.hits + 1;
        const total = nextHits + prev.misses;
        return { hits: nextHits, misses: prev.misses, accuracy: Math.round((nextHits / total) * 100) };
      });
    } else {
      triggerFlash('miss');
      setScore(prev => {
        const nextMisses = prev.misses + 1;
        const total = prev.hits + nextMisses;
        return { hits: prev.hits, misses: nextMisses, accuracy: Math.round((prev.hits / total) * 100) };
      });
    }
  }, [isPlaying, soundsWithPatterns, bpm]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleCatch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCatch]);

  useEffect(() => {
    if (isPlaying) {
      const update = () => {
        if (audioEngine) {
          const t = audioEngine.getCurrentTime();
          setCurrentTime(t);
          const secondsPerStep = (60 / bpm) / 4;
          const currentStep = (t - SYNC_OFFSET) / secondsPerStep;
          const tolerance = 1.2;

          let newMisses = 0;
          soundsWithPatterns.forEach(sound => {
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
              return { hits: prev.hits, misses: nextMisses, accuracy: Math.round((prev.hits / total) * 100) };
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

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-4 overflow-hidden select-none">
      <header className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-black uppercase italic tracking-tighter text-[#3838FA]">Sample Hunter</h1>
          <p className="text-[10px] opacity-40 uppercase font-bold tracking-widest">{game.name} • {level.name}</p>
        </div>
        <div className="text-right border-l border-white/10 pl-4">
          <p className="text-[10px] uppercase font-black opacity-30">Timing Accuracy</p>
          <p className={cn("text-3xl font-black italic", score.accuracy >= PASS_THRESHOLD ? "text-[#00E676]" : "text-[#FF3D00]")}>
            {score.accuracy}%
          </p>
        </div>
      </header>

      <main className="flex-1 relative gemini-border gemini-glow bg-black/40 overflow-hidden" onClick={handleCatch}>
        {/* Target Zone */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-4 border-[#3838FA]/20 flex items-center justify-center">
          <div className={cn(
            "w-24 h-24 rounded-full border-2 border-white/10 flex items-center justify-center transition-all",
            activeFlashes?.type === 'hit' && "bg-[#00E676]/20 border-[#00E676] scale-110",
            activeFlashes?.type === 'miss' && "bg-[#FF3D00]/20 border-[#FF3D00] scale-90"
          )}>
            <div className="text-[10px] font-black uppercase tracking-widest opacity-40">Catch Zone</div>
          </div>
        </div>

        {/* Floating Samples */}
        {isPlaying && soundsWithPatterns.map(sound => 
          sound.triggerSteps.map(step => {
            const noteId = `${sound.type}-${step}`;
            if (clearedNotesRef.current.has(noteId)) return null;

            const noteTime = step * ((60 / bpm) / 4);
            const relativeTime = noteTime - (currentTime - SYNC_OFFSET);
            if (relativeTime < -0.5 || relativeTime > 2.5) return null;

            const Icon = OBJECT_ICONS[sound.type];
            const color = OBJECT_COLORS[sound.type];
            
            // Movement logic: spiral towards center
            const progress = relativeTime / 2.5; // 1 to 0
            const angle = step * 137.5 + (1 - progress) * 360; // Phyllotaxis spiral
            const radius = progress * 400; // Fly in from edge
            
            const x = Math.cos(angle * Math.PI / 180) * radius;
            const y = Math.sin(angle * Math.PI / 180) * radius;

            return (
              <div
                key={noteId}
                className="absolute top-1/2 left-1/2 transition-transform duration-75"
                style={{ 
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${1 - progress * 0.5})`,
                  color: color,
                  filter: `drop-shadow(0 0 10px ${color})`
                }}
              >
                <Icon className="w-8 h-8 md:w-12 md:h-12" />
              </div>
            );
          })
        )}

        {!isPlaying && !isFinished && countIn === null && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
            <Card className="p-8 bg-black border-none gemini-border text-center max-w-xs">
              <Sparkles className="w-12 h-12 text-[#3838FA] mx-auto mb-6" />
              <h2 className="text-2xl font-black mb-6 uppercase italic tracking-tighter">Hunter Mode</h2>
              <p className="text-xs opacity-60 mb-8 uppercase tracking-widest leading-relaxed">Catch samples as they reach the center by pressing SPACE or Tapping.</p>
              <Button onClick={startLevel} className="w-full h-14 bg-white text-black font-black uppercase rounded-xl">Hunt Samples</Button>
            </Card>
          </div>
        )}

        {countIn !== null && (
          <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
            <div className="text-[10rem] font-black italic text-white/50">{countIn}</div>
          </div>
        )}

        {isFinished && (
          <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-50 p-6">
            <div className="text-center space-y-6">
              {score.accuracy >= PASS_THRESHOLD ? (
                <>
                  <Trophy className="w-16 h-16 text-[#FFEA00] mx-auto" />
                  <h2 className="text-4xl font-black uppercase italic">Samples Collected</h2>
                  <p className="text-2xl text-[#00E676] font-black">{score.accuracy}% Sync</p>
                </>
              ) : (
                <>
                  <XCircle className="w-16 h-16 text-[#FF3D00] mx-auto" />
                  <h2 className="text-4xl font-black uppercase italic">Hunt Failed</h2>
                  <p className="text-xl opacity-60 uppercase tracking-widest">Timing was too loose.</p>
                </>
              )}
              <div className="flex gap-4 pt-8">
                <Button onClick={startLevel} variant="outline" className="flex-1 h-12 border-white/20">Retry</Button>
                <Link href={`/studio/${game.studioId}`} className="flex-1">
                  <Button className="w-full h-12 bg-white text-black font-black">Back to Studio</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="p-4 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-20">Tap the center zone on beat to catch samples</p>
      </footer>
    </div>
  );
};
