
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Game, Level } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Trophy, 
  Zap, 
  Target, 
  Activity, 
  CheckCircle2, 
  XCircle,
  Timer,
  Waveform,
  Volume2
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

export const RhythmTrainerView: React.FC<RhythmTrainerViewProps> = ({ game, level }) => {
  const db = useFirestore();
  const { user } = useUser();

  const [mode, setMode] = useState<RhythmMode>('sync');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBpm, setCurrentBpm] = useState(100);
  const [status, setStatus] = useState<'IDLE' | 'LEARNING' | 'PERFORMING' | 'FEEDBACK'>('IDLE');
  
  const [taps, setTaps] = useState<{ time: number, offset: number, step: number }[]>([]);
  const [pattern, setPattern] = useState(PATTERNS[0]);
  const [feedback, setFeedback] = useState<{ score: number, avgOffset: number } | null>(null);

  const startTimeRef = useRef<number>(0);
  const audioContextTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => audioEngine?.stop();
  }, []);

  const handleTap = useCallback(() => {
    if (status !== 'PERFORMING' || !audioEngine) return;

    const now = audioEngine.getContextTime();
    const elapsed = now - audioContextTimeRef.current;
    const secondsPerBeat = 60 / currentBpm;
    
    // Calculate nearest step
    const currentStep = elapsed / secondsPerBeat;
    const nearestStep = mode === 'sync' ? Math.round(currentStep) : 
      pattern.steps.reduce((prev, curr) => Math.abs(curr - currentStep) < Math.abs(prev - currentStep) ? curr : prev);
    
    const targetTime = nearestStep * secondsPerBeat;
    const offsetMs = (elapsed - targetTime) * 1000;

    setTaps(prev => [...prev, { time: now, offset: offsetMs, step: nearestStep }]);
    
    // Play feedback sound
    audioEngine.playOneShot('https://actions.google.com/sounds/v1/impacts/wood_block_impact.ogg');
  }, [status, currentBpm, mode, pattern]);

  const startExercise = async () => {
    if (!audioEngine) return;
    await audioEngine.resume();
    
    setTaps([]);
    setFeedback(null);
    const secondsPerBeat = 60 / currentBpm;

    if (mode === 'follow') {
      setStatus('LEARNING');
      setIsPlaying(true);
      // Play pattern for user to hear
      for (const step of pattern.steps) {
        setTimeout(() => {
          audioEngine.playOneShot('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        }, step * secondsPerBeat * 1000);
      }
      
      setTimeout(() => {
        setIsPlaying(false);
        audioContextTimeRef.current = audioEngine.getContextTime();
        setStatus('PERFORMING');
      }, 4 * secondsPerBeat * 1000);

    } else if (mode === 'sync') {
      setStatus('PERFORMING');
      setIsPlaying(true);
      audioContextTimeRef.current = audioEngine.getContextTime();
      
      // Start a 4-bar metronome
      for (let i = 0; i < 16; i++) {
        setTimeout(() => {
          if (i % 4 === 0) {
            audioEngine.playOneShot('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
          }
        }, i * secondsPerBeat * 1000);
      }

      setTimeout(() => {
        finishExercise();
      }, 16 * secondsPerBeat * 1000);
    } else if (mode === 'gap') {
      setStatus('PERFORMING');
      setIsPlaying(true);
      audioContextTimeRef.current = audioEngine.getContextTime();
      
      // Metronome for 2 bars, then silence for 2 bars
      for (let i = 0; i < 8; i++) {
        setTimeout(() => {
           audioEngine.playOneShot('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        }, i * secondsPerBeat * 1000);
      }

      setTimeout(() => {
        finishExercise();
      }, 16 * secondsPerBeat * 1000);
    }
  };

  const finishExercise = () => {
    setIsPlaying(false);
    setStatus('FEEDBACK');
    
    if (taps.length === 0) {
      setFeedback({ score: 0, avgOffset: 0 });
      return;
    }

    const absOffsets = taps.map(t => Math.abs(t.offset));
    const avgOffset = absOffsets.reduce((a, b) => a + b, 0) / taps.length;
    
    // Scoring logic: 0ms = 100, 100ms = 0
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
  };

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-4 font-body overflow-hidden">
      <header className="flex justify-between items-center h-20 shrink-0 z-50 px-6 bg-black/40 backdrop-blur-xl border-b border-white/5 rounded-t-3xl">
        <div className="flex items-center gap-4">
          <Link href="/">
            <ArrowLeft className="w-6 h-6 text-white/40 hover:text-white transition-all hover:scale-110" />
          </Link>
          <div>
            <h1 className="text-xl font-black uppercase italic tracking-tighter text-gradient leading-none pr-6">RHYTHM MASTER</h1>
            <p className="text-[10px] opacity-30 uppercase font-black tracking-[0.2em] mt-1">Timing & Precision Lab</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center p-6 relative overflow-y-auto">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#FF3399 1.5px, transparent 1.5px)', backgroundSize: '40px 40px' }} />

        {/* Mode Toggle */}
        {status === 'IDLE' && (
          <div className="grid grid-cols-3 gap-3 mb-12 w-full max-w-xl">
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
        )}

        <div className="w-full max-w-2xl flex-1 flex flex-col justify-center gap-12">
          {status === 'IDLE' && (
            <div className="text-center space-y-10">
              <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20 animate-pulse">
                <Target className="w-12 h-12 text-primary" />
              </div>
              <div>
                <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-4">
                  {mode === 'sync' ? 'Beat Precision' : mode === 'follow' ? 'Pattern Mimic' : 'Internal Clock'}
                </h2>
                <p className="text-xs opacity-40 uppercase font-bold tracking-[0.2em] leading-relaxed">
                  {mode === 'sync' ? 'Tap exactly on beats 2 and 4' : mode === 'follow' ? 'Listen to the pattern, then tap it back' : 'Metronome stops - keep the beat going'}
                </p>
              </div>
              <Button 
                onClick={startExercise}
                className="w-full h-24 bg-white text-black text-2xl font-black uppercase italic rounded-2xl hover:scale-105 transition-all shadow-2xl"
              >
                Start Session
              </Button>
            </div>
          )}

          {(status === 'LEARNING' || status === 'PERFORMING') && (
            <div className="flex-1 flex flex-col items-center justify-center gap-16">
              <div className="text-center">
                <h3 className="text-6xl font-black italic text-[#FFEA00] mb-2">
                  {status === 'LEARNING' ? 'LISTEN' : 'TAP'}
                </h3>
                <div className="flex gap-2 justify-center">
                   {Array.from({ length: 4 }).map((_, i) => (
                     <div key={i} className={cn("w-3 h-3 rounded-full", isPlaying ? "bg-primary animate-pulse" : "bg-white/10")} />
                   ))}
                </div>
              </div>

              <div 
                onPointerDown={handleTap}
                className="w-full aspect-square max-w-[400px] gemini-border cursor-pointer group active:scale-95 transition-transform"
              >
                <div className="w-full h-full bg-black/60 backdrop-blur-3xl rounded-3xl flex items-center justify-center">
                  <Activity className="w-20 h-20 text-primary opacity-20 group-active:opacity-100 group-active:scale-125 transition-all" />
                  <div className="absolute inset-0 bg-primary/5 rounded-3xl opacity-0 group-active:opacity-100 transition-opacity" />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 w-full h-12">
                {taps.slice(-4).map((tap, i) => (
                  <div key={i} className="flex flex-col items-center animate-in slide-in-from-bottom-2">
                    <span className={cn(
                      "text-[10px] font-black uppercase italic",
                      Math.abs(tap.offset) < 50 ? "text-[#00E676]" : "text-primary"
                    )}>
                      {Math.abs(tap.offset).toFixed(0)}ms
                    </span>
                    <div className={cn("w-2 h-2 rounded-full mt-1", Math.abs(tap.offset) < 50 ? "bg-[#00E676]" : "bg-primary")} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {status === 'FEEDBACK' && feedback && (
            <div className="text-center space-y-16 animate-in zoom-in-95">
              <div>
                <Trophy className={cn("w-24 h-24 mx-auto mb-6", feedback.score >= 80 ? "text-[#FFEA00]" : "text-white/20")} />
                <h3 className="text-7xl font-black italic uppercase tracking-tighter text-gradient">
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
                    {feedback.avgOffset < 30 ? 'Elite' : feedback.avgOffset < 60 ? 'Pro' : 'Solid'}
                  </p>
                </div>
              </div>

              <div className="h-32 bg-white/2 rounded-2xl border border-white/5 flex items-center justify-around px-8 relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center opacity-10">
                   <div className="w-full h-px bg-white/20" />
                   <div className="h-full w-px bg-white/20 absolute left-1/2" />
                </div>
                {/* Visual Soll/Ist representation */}
                <div className="text-[10px] font-black uppercase opacity-20 absolute top-2 left-4">Grid View</div>
                <div className="flex gap-4">
                  {taps.slice(0, 8).map((t, i) => (
                    <div key={i} className="relative h-12 w-4 flex flex-col items-center">
                       <div className="absolute top-1/2 -translate-y-1/2 w-px h-full bg-white/10" />
                       <div 
                         className="absolute w-2 h-2 rounded-full bg-primary" 
                         style={{ top: `${50 + (t.offset / 5)}%` }} 
                       />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <Button onClick={() => setStatus('IDLE')} variant="outline" className="flex-1 h-20 rounded-xl border-white/10 uppercase font-black italic text-lg hover:bg-white/5">New Run</Button>
                <Link href="/" className="flex-1">
                  <Button className="w-full h-20 bg-white text-black rounded-xl font-black uppercase italic text-lg shadow-xl">Done</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="p-8 shrink-0 flex justify-center opacity-20">
        <div className="flex items-center gap-4">
          <Timer className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase tracking-[0.5em]">High Res Clock Active • 1ms Latency Buffer</span>
        </div>
      </footer>
    </div>
  );
};
