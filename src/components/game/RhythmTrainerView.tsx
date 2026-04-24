
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Game, Level } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Play, 
  Trophy, 
  Zap, 
  Target, 
  Activity, 
  Timer,
  X
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore } from '@/firebase';
import { doc, increment, setDoc, serverTimestamp } from 'firebase/firestore';

type RhythmMode = 'follow' | 'sync' | 'gap';

const PATTERNS = [
  { id: 'p1', name: 'Straight Four', steps: [0, 1, 2, 3], bpm: 100 },
  { id: 'p2', name: 'Eight Note Drive', steps: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], bpm: 100 },
  { id: 'p3', name: 'The Backbeat', steps: [1, 3], bpm: 90 },
  { id: 'p4', name: 'Offbeat Groove', steps: [0.5, 1.5, 2.5, 3.5], bpm: 100 },
  { id: 'p5', name: 'Syncopated Funk', steps: [0, 0.75, 1.5, 2.25, 3], bpm: 95 },
];

interface RhythmTrainerViewProps {
  game: Game;
  level: Level;
}

type Status = 'IDLE' | 'COUNT_IN' | 'LEARNING' | 'PERFORMING' | 'FEEDBACK';

export const RhythmTrainerView: React.FC<RhythmTrainerViewProps> = ({ game, level }) => {
  const db = useFirestore();
  const { user } = useUser();

  const [mode, setMode] = useState<RhythmMode>('sync');
  const [currentBpm] = useState(100);
  const [status, setStatus] = useState<Status>('IDLE');
  const [countIn, setCountIn] = useState<number | null>(null);
  const [beatProgress, setBeatProgress] = useState(0); // 0 to 4
  
  const [taps, setTaps] = useState<{ offset: number, step: number }[]>([]);
  const [pattern] = useState(PATTERNS[Math.floor(Math.random() * PATTERNS.length)]);
  const [feedback, setFeedback] = useState<{ score: number, avgOffset: number } | null>(null);

  const requestRef = useRef<number>(null);
  const startTimeRef = useRef<number>(0);
  const audioContextTimeRef = useRef<number>(0);

  const secondsPerBeat = 60 / currentBpm;

  const updateProgress = useCallback(() => {
    if (!audioEngine) return;
    const now = audioEngine.getContextTime();
    const elapsed = now - startTimeRef.current;
    
    // Beat progression (0 to 4 beats per bar)
    const progress = (elapsed / secondsPerBeat) % 4;
    setBeatProgress(progress);

    requestRef.current = requestAnimationFrame(updateProgress);
  }, [secondsPerBeat]);

  useEffect(() => {
    if (status !== 'IDLE' && status !== 'FEEDBACK') {
      requestRef.current = requestAnimationFrame(updateProgress);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [status, updateProgress]);

  useEffect(() => {
    return () => audioEngine?.stop();
  }, []);

  const handleTap = useCallback(() => {
    if (status !== 'PERFORMING' || !audioEngine) return;

    const now = audioEngine.getContextTime();
    const elapsed = now - audioContextTimeRef.current;
    
    // Calculate nearest step based on mode
    let nearestStep = 0;
    if (mode === 'sync') {
      // User should hit 1, 2, 3, 4 (usually 2 & 4 in rhythm apps, but let's allow all beats here for simplicity)
      nearestStep = Math.round(elapsed / secondsPerBeat) % 4;
    } else {
      // User should hit steps in the pattern
      nearestStep = pattern.steps.reduce((prev, curr) => 
        Math.abs(curr - (elapsed / secondsPerBeat % 4)) < Math.abs(prev - (elapsed / secondsPerBeat % 4)) ? curr : prev
      );
    }
    
    const targetTimeInBar = nearestStep * secondsPerBeat;
    const actualTimeInBar = elapsed % (4 * secondsPerBeat);
    
    // Simple offset calculation
    let offsetMs = (actualTimeInBar - targetTimeInBar) * 1000;
    // Fix wrap around
    if (offsetMs > (secondsPerBeat * 500)) offsetMs -= (secondsPerBeat * 1000 * 4);
    if (offsetMs < -(secondsPerBeat * 500)) offsetMs += (secondsPerBeat * 1000 * 4);

    setTaps(prev => [...prev, { offset: offsetMs, step: nearestStep }]);
    audioEngine.playOneShot('https://actions.google.com/sounds/v1/impacts/wood_block_impact.ogg');
  }, [status, currentBpm, mode, pattern, secondsPerBeat]);

  const startExercise = async () => {
    if (!audioEngine) return;
    await audioEngine.resume();
    
    setTaps([]);
    setFeedback(null);
    setStatus('COUNT_IN');
    
    // Start Count In
    const now = audioEngine.getContextTime();
    startTimeRef.current = now;
    
    await audioEngine.playCountIn(currentBpm, (beat) => setCountIn(5 - beat));
    setCountIn(null);

    const exerciseStart = audioEngine.getContextTime();
    startTimeRef.current = exerciseStart;
    audioContextTimeRef.current = exerciseStart;

    if (mode === 'follow') {
      setStatus('LEARNING');
      // Play pattern once
      for (const step of pattern.steps) {
        setTimeout(() => {
          audioEngine.playOneShot('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        }, step * secondsPerBeat * 1000);
      }
      
      setTimeout(() => {
        const nextStart = audioEngine.getContextTime();
        startTimeRef.current = nextStart;
        audioContextTimeRef.current = nextStart;
        setStatus('PERFORMING');
        // Let it run for 2 bars (8 beats)
        setTimeout(finishExercise, 8 * secondsPerBeat * 1000);
      }, 4 * secondsPerBeat * 1000);

    } else if (mode === 'sync') {
      setStatus('PERFORMING');
      // Play metronome while performing
      for (let i = 0; i < 16; i++) {
        setTimeout(() => {
          // Play click on 2 & 4 or every beat? Let's do every beat for "sync"
          audioEngine.playOneShot('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        }, i * secondsPerBeat * 1000);
      }
      setTimeout(finishExercise, 16 * secondsPerBeat * 1000);
    } else if (mode === 'gap') {
      setStatus('PERFORMING');
      // Metronome for 4 beats, then 4 beats silence, then 4 beats metronome, etc.
      for (let i = 0; i < 16; i++) {
        if (i < 4 || (i >= 8 && i < 12)) {
          setTimeout(() => {
            audioEngine.playOneShot('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
          }, i * secondsPerBeat * 1000);
        }
      }
      setTimeout(finishExercise, 16 * secondsPerBeat * 1000);
    }
  };

  const finishExercise = () => {
    setStatus('FEEDBACK');
    setIsPlaying(false);
    
    setTaps(prev => {
      if (prev.length === 0) {
        setFeedback({ score: 0, avgOffset: 0 });
        return prev;
      }
      const absOffsets = prev.map(t => Math.abs(t.offset));
      const avgOffset = absOffsets.reduce((a, b) => a + b, 0) / prev.length;
      const score = Math.max(0, Math.round(100 - (avgOffset / 1.5)));
      setFeedback({ score, avgOffset });

      if (user && db) {
        setDoc(doc(db, 'users', user.uid, 'progress', level.id), { 
          levelId: level.id, 
          accuracy: score, 
          completedAt: serverTimestamp() 
        }, { merge: true });
        setDoc(doc(db, 'users', user.uid), { streetCred: increment(score * 2) }, { merge: true });
      }
      return prev;
    });
  };

  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-4 font-body overflow-hidden select-none">
      <header className="flex justify-between items-center h-20 shrink-0 z-50 px-6 bg-black/40 backdrop-blur-xl border-b border-white/5 rounded-t-3xl">
        <div className="flex items-center gap-4">
          <Link href="/">
            <ArrowLeft className="w-6 h-6 text-white/40 hover:text-white transition-all hover:scale-110" />
          </Link>
          <div>
            <h1 className="text-xl font-black uppercase italic tracking-tighter text-gradient leading-none">RHYTHM MASTER</h1>
            <p className="text-[10px] opacity-30 uppercase font-black tracking-[0.2em] mt-1">Timing & Precision Lab</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center p-6 relative">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#FF3399 1.5px, transparent 1.5px)', backgroundSize: '40px 40px' }} />

        {status === 'IDLE' && (
          <div className="w-full max-w-xl flex flex-col items-center justify-center h-full space-y-12 animate-in fade-in zoom-in-95">
             <div className="grid grid-cols-3 gap-3 w-full">
              {(['sync', 'follow', 'gap'] as RhythmMode[]).map(m => (
                <Button 
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "h-16 rounded-xl font-black uppercase italic tracking-tighter transition-all",
                    mode === m ? "bg-primary text-white border-2 border-primary" : "bg-white/5 text-white/40 border border-white/10"
                  )}
                >
                  {m}
                </Button>
              ))}
            </div>

            <div className="text-center space-y-6">
              <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20">
                <Target className="w-12 h-12 text-primary" />
              </div>
              <h2 className="text-4xl font-black uppercase italic tracking-tighter">
                {mode === 'sync' ? 'Beat Precision' : mode === 'follow' ? 'Pattern Mimic' : 'Internal Clock'}
              </h2>
              <p className="text-xs opacity-40 uppercase font-bold tracking-[0.2em] leading-relaxed max-w-xs mx-auto">
                {mode === 'sync' ? 'Halte den Takt genau auf dem Raster.' : mode === 'follow' ? 'Höre das Muster und klopfe es nach.' : 'Das Metronom stoppt - halte das Tempo.'}
              </p>
              <Button 
                onClick={startExercise}
                className="w-full h-24 bg-white text-black text-2xl font-black uppercase italic rounded-2xl hover:scale-105 transition-all shadow-2xl"
              >
                Übung Starten
              </Button>
            </div>
          </div>
        )}

        {(status === 'COUNT_IN' || status === 'LEARNING' || status === 'PERFORMING') && (
          <div className="flex-1 flex flex-col items-center justify-center gap-12 w-full max-w-2xl animate-in fade-in">
            {/* Status Indicator */}
            <div className="text-center">
              <h3 className="text-5xl md:text-7xl font-black italic text-[#FFEA00] mb-4">
                {status === 'COUNT_IN' ? countIn : status === 'LEARNING' ? 'LISTEN' : 'GO!'}
              </h3>
              
              {/* Visual Metronome */}
              <div className="flex gap-4 justify-center items-center h-12">
                 {[0, 1, 2, 3].map((i) => {
                   const isActive = Math.floor(beatProgress) === i;
                   const isTarget = mode === 'sync' ? true : pattern.steps.includes(i);
                   return (
                     <div 
                       key={i} 
                       className={cn(
                         "w-4 h-4 rounded-full transition-all duration-75",
                         isActive ? "scale-150 bg-primary shadow-[0_0_20px_var(--primary)]" : "bg-white/10",
                         isTarget && !isActive && "border border-primary/30"
                       )} 
                     />
                   );
                 })}
              </div>
            </div>

            {/* Tap Zone */}
            <div 
              onPointerDown={handleTap}
              className="w-full aspect-square max-w-[360px] gemini-border cursor-pointer group active:scale-95 transition-transform"
            >
              <div className="w-full h-full bg-black/60 backdrop-blur-3xl rounded-3xl flex flex-col items-center justify-center p-8 relative overflow-hidden">
                <Activity className={cn(
                  "w-20 h-20 transition-all",
                  status === 'PERFORMING' ? "text-primary opacity-40 group-active:opacity-100 group-active:scale-110" : "text-white/5 opacity-10"
                )} />
                
                {/* Visual Feedback Line */}
                <div className="absolute bottom-10 left-8 right-8 h-1 bg-white/5 rounded-full">
                  <div 
                    className="absolute top-0 h-full bg-primary transition-all duration-75"
                    style={{ left: `${(beatProgress / 4) * 100}%`, width: '4px' }}
                  />
                  {/* Targets for Follow Mode */}
                  {mode === 'follow' && pattern.steps.map((s, i) => (
                    <div key={i} className="absolute top-0 w-2 h-full bg-[#FFEA00] opacity-40" style={{ left: `${(s / 4) * 100}%` }} />
                  ))}
                </div>
              </div>
            </div>

            {/* Last Taps Feedback */}
            <div className="grid grid-cols-4 gap-4 w-full h-16">
              {taps.slice(-4).map((tap, i) => (
                <div key={i} className="flex flex-col items-center animate-in slide-in-from-bottom-2">
                  <span className={cn(
                    "text-[10px] font-black uppercase italic",
                    Math.abs(tap.offset) < 60 ? "text-[#00E676]" : "text-primary"
                  )}>
                    {Math.abs(tap.offset).toFixed(0)}ms
                  </span>
                  <div className={cn("w-2 h-2 rounded-full mt-1", Math.abs(tap.offset) < 60 ? "bg-[#00E676]" : "bg-primary")} />
                </div>
              ))}
            </div>

            <Button 
              variant="ghost" 
              onClick={() => setStatus('IDLE')}
              className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/5 border border-white/10"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        )}

        {status === 'FEEDBACK' && feedback && (
          <div className="text-center space-y-12 animate-in zoom-in-95 h-full flex flex-col justify-center max-w-lg w-full">
            <div>
              <Trophy className={cn("w-20 h-20 mx-auto mb-6", feedback.score >= 80 ? "text-[#FFEA00]" : "text-white/20")} />
              <h3 className="text-7xl font-black italic uppercase tracking-tighter text-gradient leading-none">
                {feedback.score}%
              </h3>
              <p className="text-[10px] uppercase font-black tracking-[0.5em] opacity-30 mt-2">Accuracy Score</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-30 mb-2">Avg. Deviation</p>
                <p className="text-2xl font-black italic text-primary">{feedback.avgOffset.toFixed(1)}ms</p>
              </div>
              <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-30 mb-2">Timing Rank</p>
                <p className="text-2xl font-black italic text-[#00E676]">
                  {feedback.avgOffset < 35 ? 'Elite' : feedback.avgOffset < 70 ? 'Pro' : 'Solid'}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <Button onClick={() => setStatus('IDLE')} variant="outline" className="flex-1 h-20 rounded-xl border-white/10 uppercase font-black italic text-lg hover:bg-white/5">Neu Versuchen</Button>
              <Link href="/" className="flex-1">
                <Button className="w-full h-20 bg-white text-black rounded-xl font-black uppercase italic text-lg shadow-xl">Fertig</Button>
              </Link>
            </div>
          </div>
        )}
      </main>

      <footer className="p-8 shrink-0 flex justify-center opacity-20">
        <div className="flex items-center gap-4">
          <Timer className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase tracking-[0.5em]">High Res Clock Active • Low Latency Buffer</span>
        </div>
      </footer>
    </div>
  );
};
