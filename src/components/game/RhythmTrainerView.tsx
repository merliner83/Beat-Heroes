
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Game, Level, TriggerPattern, PatternProgress, getAccuracyColor } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  Play, 
  Square,
  Trophy, 
  Zap, 
  Target, 
  Brain,
  Volume2
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, increment, setDoc, serverTimestamp, collection, query } from 'firebase/firestore';

const SOUND_MAPPING: Record<string, string> = {
  'kick': 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FKICK1.mp3?alt=media&token=23415b38-2c12-4462-bb74-385533ad1c57',
  'clave': 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FClaves.mp3?alt=media&token=1162b3f6-19d7-4a41-a3b6-9c243cd5d36a'
};

const QUIZ_STEPS = 64; // 4 Bars (4 * 16 Steps)

interface RhythmTrainerViewProps {
  game: Game;
  level: Level;
}

type ViewStatus = 'IDLE' | 'COUNT_IN' | 'PLAYING' | 'RESULTS';

export const RhythmTrainerView: React.FC<RhythmTrainerViewProps> = ({ game, level }) => {
  const db = useFirestore();
  const { user } = useUser();

  const [mode, setMode] = useState<'explore' | 'quiz'>('explore');
  const [status, setStatus] = useState<ViewStatus>('IDLE');
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0); 
  const [countIn, setCountIn] = useState<number | null>(null);
  const [lastHitTime, setLastHitTime] = useState(0);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  const startTimeRef = useRef<number>(0);
  const lastScheduledStepRef = useRef<number>(-1);
  const frameRef = useRef<number | null>(null);
  const userTapsRef = useRef<{ step: number }[]>([]);

  const bpm = 120; 
  const stepTime = (60 / bpm) / 4; // 16th note duration

  const patternsQuery = useMemoFirebase(() => db ? query(collection(db, 'patterns')) : null, [db]);
  const { data: patterns } = useCollection<TriggerPattern>(patternsQuery);

  const progressQuery = useMemoFirebase(() => user && db ? query(collection(db, 'users', user.uid, 'patternProgress')) : null, [user, db]);
  const { data: patternProgress } = useCollection<PatternProgress>(progressQuery);

  const selectedPattern = useMemo(() => patterns?.find(p => p.id === selectedPatternId), [patterns, selectedPatternId]);

  useEffect(() => {
    if (patterns && patterns.length > 0 && !selectedPatternId) {
      setSelectedPatternId(patterns[0].id);
    }
  }, [patterns, selectedPatternId]);

  const stopPlayback = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setStatus('IDLE');
    setPlayhead(0);
    startTimeRef.current = 0;
    lastScheduledStepRef.current = -1;
  }, []);

  const finishQuiz = useCallback((taps: { step: number }[]) => {
    if (!selectedPattern) return;
    
    // Pattern might be 8 bars, quiz is only 4
    const targetSteps = selectedPattern.steps.filter(s => s < QUIZ_STEPS);
    let hits = 0;
    const matchedTaps = new Set<number>();
    const tolerance = 0.5;

    targetSteps.forEach(target => {
      let bestMatchIdx = -1;
      let minDiff = Infinity;

      taps.forEach((tap, idx) => {
        if (matchedTaps.has(idx)) return;
        const diff = Math.abs(tap.step - target);
        if (diff <= tolerance && diff < minDiff) {
          minDiff = diff;
          bestMatchIdx = idx;
        }
      });

      if (bestMatchIdx !== -1) {
        hits++;
        matchedTaps.add(bestMatchIdx);
      }
    });

    const totalNotes = targetSteps.length;
    // Calculate accuracy: hits vs required notes, penalty for extra taps
    const rawAccuracy = totalNotes > 0 ? (hits / totalNotes) : 0;
    const extraTapsPenalty = taps.length > hits ? (taps.length - hits) * 0.05 : 0;
    const accuracy = Math.max(0, Math.min(100, Math.round((rawAccuracy - extraTapsPenalty) * 100)));
    
    setFinalScore(accuracy);
    setStatus('RESULTS');
    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    if (user && db) {
      setDoc(doc(db, 'users', user.uid, 'patternProgress', selectedPattern.id), { 
        patternId: selectedPattern.id, 
        accuracy, 
        completedAt: serverTimestamp() 
      }, { merge: true });
      setDoc(doc(db, 'users', user.uid), { streetCred: increment(accuracy * 2) }, { merge: true });
    }
  }, [selectedPattern, user, db]);

  const handleTap = useCallback(() => {
    if (!audioEngine || !selectedPattern) return;
    
    audioEngine.playOneShot(selectedPattern.sampleUrl || SOUND_MAPPING['clave']);

    if (startTimeRef.current === 0 || status !== 'PLAYING') return;

    const contextTime = audioEngine.getContextTime();
    const elapsed = contextTime - startTimeRef.current;
    
    if (elapsed < 0) return;

    const currentStepRaw = elapsed / stepTime;
    const tolerance = 0.5;
    
    // Check if hit against pattern (using modulo 128 as patterns are often 8 bars)
    const normalizedPos = currentStepRaw % 128;
    const isHit = selectedPattern.steps.some(s => {
      const diff = Math.min(
        Math.abs(s - normalizedPos),
        Math.abs(s - (normalizedPos - 128)),
        Math.abs(s - (normalizedPos + 128))
      );
      return diff <= tolerance;
    });

    if (isHit) {
      setLastHitTime(Date.now());
    }

    if (mode === 'quiz') {
      userTapsRef.current.push({ step: currentStepRaw });
    }
  }, [selectedPattern, status, mode, stepTime]);

  const loop = useCallback(() => {
    if (!audioEngine || startTimeRef.current === 0) return;

    const now = audioEngine.getContextTime();
    const elapsed = now - startTimeRef.current;
    
    if (elapsed < 0) {
      frameRef.current = requestAnimationFrame(loop);
      return;
    }

    const currentStepRaw = elapsed / stepTime;
    const currentStepInt = Math.floor(currentStepRaw);

    // Hard stop for quiz at exactly 4 bars
    if (mode === 'quiz' && currentStepInt >= QUIZ_STEPS) {
      finishQuiz(userTapsRef.current);
      return; // Stop animation loop
    }

    if (currentStepInt > lastScheduledStepRef.current) {
      const metronomeUrl = (audioEngine as any).constructor.METRONOME_URL;
      const sampleUrl = selectedPattern?.sampleUrl || SOUND_MAPPING['clave'];

      // Metronome every beat
      if (currentStepInt % 4 === 0) {
        audioEngine.playOneShot(metronomeUrl);
      }

      // Pattern playback only in explore mode
      if (mode === 'explore' && selectedPattern?.steps.includes(currentStepInt % 128)) {
        audioEngine.playOneShot(sampleUrl);
      }

      lastScheduledStepRef.current = currentStepInt;
      setPlayhead(currentStepInt % 16);
    }

    frameRef.current = requestAnimationFrame(loop);
  }, [selectedPattern, mode, stepTime, finishQuiz]);

  const startSession = async (newMode: 'explore' | 'quiz') => {
    if (!audioEngine || !selectedPattern) return;
    
    setMode(newMode);
    stopPlayback();
    userTapsRef.current = [];
    setFinalScore(null);

    await audioEngine.resume();
    await audioEngine.preloadAudio([selectedPattern.sampleUrl || '', (audioEngine as any).constructor.METRONOME_URL]);

    if (newMode === 'quiz') {
      setStatus('COUNT_IN');
      await audioEngine.playCountIn(bpm, (beat) => setCountIn(5 - beat));
      setCountIn(null);
    }

    setStatus('PLAYING');
    startTimeRef.current = audioEngine.getContextTime() + 0.1; 
    lastScheduledStepRef.current = -1;
    loop();
  };

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const isHitActive = Date.now() - lastHitTime < 150;

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-4 font-body overflow-hidden select-none">
      <header className="flex justify-between items-center h-20 shrink-0 z-50 px-6 bg-black/40 backdrop-blur-xl border-b border-white/5 rounded-t-3xl">
        <div className="flex items-center gap-4">
          <Link href="/">
            <ArrowLeft className="w-6 h-6 text-white/40 hover:text-white transition-all hover:scale-110" />
          </Link>
          <div>
            <h1 className="text-xl font-black uppercase italic tracking-tighter text-gradient leading-none">RHYTHM MASTER</h1>
            <p className="text-[10px] opacity-30 uppercase font-black tracking-[0.2em] mt-1">MIDI Lab Interface</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start p-6 md:p-12 relative overflow-y-auto">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#FF3399 1.5px, transparent 1.5px)', backgroundSize: '40px 40px' }} />

        <div className="w-full max-w-5xl space-y-12 animate-in zoom-in-95 duration-500 pb-20">
          <div className="text-center">
            <h2 className="text-4xl md:text-7xl font-black uppercase italic tracking-tighter mb-6 text-gradient h-20 flex items-center justify-center">
              {status === 'COUNT_IN' ? countIn : status === 'RESULTS' ? 'FINISHED' : 'RHYTHM MASTER'}
            </h2>
            
            <div className="flex gap-1 md:gap-2 justify-center w-full max-w-2xl mx-auto mb-10">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className={cn(
                  "h-10 md:h-14 flex-1 rounded-md border transition-all duration-75 flex items-center justify-center",
                  (playhead === i && status === 'PLAYING') ? "border-[#00E676] bg-[#00E676]/20 shadow-[0_0_15px_rgba(0,230,118,0.3)] scale-y-110" : 
                  (selectedPattern?.steps.some(s => s % 16 === i)) ? "border-primary/40 bg-primary/20" : 
                  "border-white/5 bg-white/5"
                )} />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-12 md:gap-24">
             <Button
                onClick={() => (status === 'PLAYING' || status === 'COUNT_IN') ? stopPlayback() : startSession('explore')}
                className={cn(
                  "w-20 h-20 md:w-24 md:h-24 rounded-2xl border border-white/10 bg-black/40 hover:bg-black/60",
                  (status === 'PLAYING' || status === 'COUNT_IN') && mode === 'explore' ? "text-primary border-primary" : "text-white/40"
                )}
              >
                {(status === 'PLAYING' || status === 'COUNT_IN') && mode === 'explore' ? <Square className="w-6 h-6 fill-primary" /> : <Play className="w-6 h-6 fill-white" />}
             </Button>

             <Button
                onPointerDown={(e) => { e.preventDefault(); handleTap(); }}
                className={cn(
                  "w-44 h-44 md:w-52 md:h-52 rounded-[3rem] border-4 transition-all duration-75 bg-black/40 hover:bg-black/40 shadow-2xl relative overflow-hidden",
                  isHitActive ? "border-[#00E676] bg-[#00E676] scale-105 shadow-[0_0_120px_rgba(0,230,118,0.7)]" : "border-white/10"
                )}
              >
                <div className="relative flex flex-col items-center justify-center z-10">
                  <Target className={cn("w-12 h-12 mb-2", isHitActive ? "text-black" : "text-white/20")} />
                  <span className={cn("text-xs font-black uppercase tracking-widest", isHitActive ? "text-black" : "opacity-40")}>
                    {isHitActive ? 'HIT' : 'TAP'}
                  </span>
                </div>
              </Button>

              <Button
                onClick={() => startSession('quiz')}
                disabled={status === 'COUNT_IN' || (status === 'PLAYING' && mode === 'quiz')}
                className={cn(
                  "w-20 h-20 md:w-24 md:h-24 rounded-2xl border border-white/10 bg-black/40 hover:bg-black/60",
                  (status === 'PLAYING' || status === 'COUNT_IN') && mode === 'quiz' ? "text-primary border-primary" : "text-white/40"
                )}
              >
                <Brain className="w-6 h-6" />
              </Button>
          </div>

          {status === 'RESULTS' && (
            <div className="text-center space-y-12 animate-in zoom-in-95 bg-black/90 backdrop-blur-3xl p-10 rounded-[3rem] border border-white/10 shadow-2xl max-w-lg mx-auto z-[100] relative">
              <div className="flex flex-col items-center">
                <Trophy className="w-20 h-20 text-[#FFEA00] mb-6 drop-shadow-[0_0_30px_rgba(255,234,0,0.5)]" />
                <h2 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter text-gradient leading-tight">
                  {finalScore}%
                </h2>
                <p className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40 mt-2">Accuracy achieved</p>
              </div>
              <div className="flex gap-4 w-full">
                <Button onClick={() => startSession('quiz')} variant="outline" className="flex-1 h-16 rounded-xl font-black italic border-white/10 uppercase tracking-widest hover:bg-white/5">Retry Quiz</Button>
                <Button onClick={() => setStatus('IDLE')} className="flex-1 h-16 bg-white text-black rounded-xl font-black italic uppercase tracking-widest hover:scale-105 transition-transform">Done</Button>
              </div>
            </div>
          )}

          {status === 'IDLE' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              {patterns?.map(p => {
                const mastery = patternProgress?.find(pp => pp.patternId === p.id)?.accuracy || 0;
                return (
                  <div 
                    key={p.id} 
                    onClick={() => setSelectedPatternId(p.id)}
                    className={cn(
                      "cursor-pointer p-4 rounded-xl border transition-all group",
                      selectedPatternId === p.id ? "border-primary bg-black/80 shadow-[0_0_30px_rgba(255,51,153,0.1)]" : "bg-black/40 border-white/5 hover:border-white/20"
                    )}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-[10px] font-black uppercase italic truncate pr-2">{p.name}</h4>
                      <span className="text-[9px] font-black italic" style={{ color: getAccuracyColor(mastery) }}>{mastery}%</span>
                    </div>
                    <Progress value={mastery} className="h-1" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <footer className="p-8 shrink-0 flex justify-center opacity-20">
        <div className="flex items-center gap-4">
          <Volume2 className="w-5 h-5" />
          <span className="text-[10px] font-black uppercase tracking-[0.5em]">Sample-Accurate Sync Engine | 4-Bar Limit</span>
        </div>
      </footer>
    </div>
  );
};
