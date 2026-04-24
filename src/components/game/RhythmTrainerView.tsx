
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Game, Level, Sound, TriggerPattern } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Trophy, 
  Zap, 
  Activity, 
  CheckCircle2, 
  XCircle,
  BarChart3,
  X,
  Volume2,
  Brain
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, increment, setDoc, serverTimestamp, collection, query, where } from 'firebase/firestore';

interface RhythmPattern {
  id: string;
  name: string;
  steps: number[]; // 0-15 for 1 bar
  soundUrl: string;
}

const RHYTHM_CONFIG: RhythmPattern[] = [
  { 
    id: '4th-kick', 
    name: 'Straight Four', 
    steps: [0, 4, 8, 12], 
    soundUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FKICK1.mp3?alt=media&token=23415b38-2c12-4462-bb74-385533ad1c57' 
  },
  { 
    id: 'off-hats', 
    name: 'Off-Beat Hats', 
    steps: [2, 6, 10, 14], 
    soundUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FSHE_HiHat_03.wav?alt=media&token=a5e7b4ac-3af8-49ab-bb6b-557a6e3551bd' 
  },
  { 
    id: '16th-shaker', 
    name: 'Shaker Drive', 
    steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 
    soundUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2Foooh.wav?alt=media&token=bf90be29-fd25-4fad-bc2c-9483840246ba' 
  },
  { 
    id: 'clave', 
    name: 'Classic Clave', 
    steps: [0, 3, 6, 10, 12], 
    soundUrl: 'https://actions.google.com/sounds/v1/impacts/wood_block_impact.ogg' 
  },
];

const TOTAL_ROUNDS = 5;

interface RhythmTrainerViewProps {
  game: Game;
  level: Level;
}

type ViewStatus = 'IDLE' | 'PLAYING' | 'COUNT_IN' | 'QUIZ_PLAYING' | 'FEEDBACK' | 'RESULTS';

export const RhythmTrainerView: React.FC<RhythmTrainerViewProps> = ({ game, level }) => {
  const db = useFirestore();
  const { user } = useUser();

  const [mode, setMode] = useState<'explore' | 'quiz'>('explore');
  const [status, setStatus] = useState<ViewStatus>('IDLE');
  const [selectedPatternId, setSelectedPatternId] = useState(RHYTHM_CONFIG[0].id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0); // 0-15
  const [countIn, setCountIn] = useState<number | null>(null);

  // Quiz State
  const [round, setRound] = useState(1);
  const [targetPatternId, setTargetPatternId] = useState('');
  const [lastGuess, setLastGuess] = useState<string | null>(null);
  const [sessionScores, setSessionScores] = useState<number[]>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const playheadRef = useRef(0);

  const selectedPattern = RHYTHM_CONFIG.find(p => p.id === selectedPatternId)!;
  const bpm = game.bpm || 120;
  const stepTime = (60 / bpm) / 4 * 1000;

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  const startPlayback = async (pattern: RhythmPattern) => {
    if (!audioEngine) return;
    await audioEngine.resume();
    await audioEngine.preloadAudio([pattern.soundUrl, audioEngine.constructor.METRONOME_URL]);
    
    setIsPlaying(true);
    playheadRef.current = 0;
    setPlayhead(0);

    const tick = () => {
      const currentStep = playheadRef.current;
      setPlayhead(currentStep);

      // Metronome on beats (0, 4, 8, 12)
      if (currentStep % 4 === 0) {
        audioEngine.playOneShot(audioEngine.constructor.METRONOME_URL);
      }

      // Pattern Sound
      if (pattern.steps.includes(currentStep)) {
        audioEngine.playOneShot(pattern.soundUrl);
      }

      playheadRef.current = (currentStep + 1) % 16;
      timerRef.current = setTimeout(tick, stepTime);
    };

    tick();
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPlayhead(0);
    playheadRef.current = 0;
  };

  const toggleExplore = () => {
    if (isPlaying) stopPlayback();
    else startPlayback(selectedPattern);
  };

  const startQuiz = async () => {
    setMode('quiz');
    setRound(1);
    setSessionScores([]);
    generateNewQuizTarget();
  };

  const generateNewQuizTarget = async () => {
    stopPlayback();
    const randomPattern = RHYTHM_CONFIG[Math.floor(Math.random() * RHYTHM_CONFIG.length)];
    setTargetPatternId(randomPattern.id);
    setLastGuess(null);
    setStatus('COUNT_IN');

    if (!audioEngine) return;
    await audioEngine.resume();
    
    // Count In
    await audioEngine.playCountIn(bpm, (beat) => setCountIn(5 - beat));
    setCountIn(null);
    
    // Play Pattern once
    setStatus('QUIZ_PLAYING');
    await playPatternOnce(randomPattern);
    setStatus('IDLE');
  };

  const playPatternOnce = (pattern: RhythmPattern): Promise<void> => {
    return new Promise((resolve) => {
      let step = 0;
      const tick = () => {
        if (step % 4 === 0) {
          audioEngine?.playOneShot(audioEngine.constructor.METRONOME_URL);
        }
        if (pattern.steps.includes(step)) {
          audioEngine?.playOneShot(pattern.soundUrl);
        }
        setPlayhead(step);
        step++;
        if (step < 16) {
          setTimeout(tick, stepTime);
        } else {
          setPlayhead(0);
          resolve();
        }
      };
      tick();
    });
  };

  const handleGuess = (id: string) => {
    if (status !== 'IDLE' || mode !== 'quiz' || lastGuess) return;
    setLastGuess(id);
    const isCorrect = id === targetPatternId;
    setSessionScores(prev => [...prev, isCorrect ? 100 : 0]);
    setStatus('FEEDBACK');
  };

  const nextRound = () => {
    if (round < TOTAL_ROUNDS) {
      setRound(r => r + 1);
      generateNewQuizTarget();
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = () => {
    const avgScore = Math.round(sessionScores.reduce((a, b) => a + b, 0) / TOTAL_ROUNDS);
    setStatus('RESULTS');

    if (user && db) {
      setDoc(doc(db, 'users', user.uid, 'progress', level.id), { 
        levelId: level.id, 
        accuracy: avgScore, 
        completedAt: serverTimestamp() 
      }, { merge: true });
      setDoc(doc(db, 'users', user.uid), { streetCred: increment(avgScore * 5) }, { merge: true });
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
            <h1 className="text-xl font-black uppercase italic tracking-tighter text-gradient leading-none pr-8">RHYTHM MASTER</h1>
            <p className="text-[10px] opacity-30 uppercase font-black tracking-[0.2em] mt-1">16-Step Pattern Lab</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start p-6 md:p-12 relative overflow-y-auto">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#FF3399 1.5px, transparent 1.5px)', backgroundSize: '40px 40px' }} />

        {/* Mode Toggle */}
        {status === 'IDLE' && (
          <div className="flex p-1.5 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-xl mb-12 animate-in fade-in slide-in-from-top-4">
            <Button 
              variant="ghost" 
              onClick={() => { setMode('explore'); stopPlayback(); }}
              className={cn(
                "rounded-xl px-10 h-12 text-sm font-black uppercase italic tracking-widest transition-all",
                mode === 'explore' ? "bg-white/10 text-white" : "text-white/20"
              )}
            >
              Explore
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => { setMode('quiz'); stopPlayback(); }}
              className={cn(
                "rounded-xl px-10 h-12 text-sm font-black uppercase italic tracking-widest transition-all",
                mode === 'quiz' ? "bg-primary text-white" : "text-white/20"
              )}
            >
              Quiz
            </Button>
          </div>
        )}

        {mode === 'explore' && (
          <div className="w-full max-w-3xl space-y-12 animate-in zoom-in-95 duration-500">
            {/* Pattern Grid */}
            <div className="gemini-border-primary">
              <div className="p-8 md:p-12 bg-black/60 backdrop-blur-3xl rounded-2xl border border-white/5">
                <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-16 gap-2 md:gap-3 mb-10">
                  {Array.from({ length: 16 }).map((_, i) => {
                    const isStep = selectedPattern.steps.includes(i);
                    const isCurrent = playhead === i && isPlaying;
                    return (
                      <div 
                        key={i} 
                        className={cn(
                          "aspect-square rounded-lg border-2 transition-all duration-75 flex items-center justify-center",
                          isStep ? "bg-primary/20 border-primary" : "bg-white/5 border-white/5",
                          isCurrent && "scale-110 brightness-150 shadow-[0_0_15px_var(--primary)]",
                          i % 4 === 0 && !isStep && "border-white/10"
                        )}
                      >
                        {isStep && <div className={cn("w-2 h-2 rounded-full", isCurrent ? "bg-white" : "bg-primary")} />}
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {RHYTHM_CONFIG.map(p => (
                    <Button
                      key={p.id}
                      onClick={() => {
                        setSelectedPatternId(p.id);
                        if (isPlaying) {
                          stopPlayback();
                          startPlayback(p);
                        }
                      }}
                      className={cn(
                        "h-16 rounded-xl border flex flex-col gap-1 transition-all",
                        selectedPatternId === p.id ? "bg-primary border-primary text-white" : "bg-white/5 border-white/10 hover:border-white/20 text-white/40"
                      )}
                    >
                      <span className="text-[10px] font-black uppercase italic tracking-tighter">{p.name}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <Button 
              onClick={toggleExplore}
              className={cn(
                "w-full h-24 rounded-2xl text-2xl font-black uppercase italic transition-all active:scale-95 shadow-2xl shadow-primary/20",
                isPlaying ? "bg-destructive text-white" : "bg-white text-black"
              )}
            >
              {isPlaying ? <Pause className="mr-4 w-8 h-8" fill="currentColor" /> : <Play className="mr-4 w-8 h-8" fill="currentColor" />}
              {isPlaying ? "Stop Loop" : "Play Rhythm"}
            </Button>
          </div>
        )}

        {mode === 'quiz' && (
          <div className="w-full max-w-2xl">
            {status === 'IDLE' && !lastGuess && sessionScores.length === 0 && (
              <div className="text-center space-y-10 animate-in zoom-in-95">
                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20">
                  <Brain className="w-12 h-12 text-primary" />
                </div>
                <h2 className="text-4xl font-black uppercase italic tracking-tighter">Rhythm Recognition</h2>
                <p className="text-xs opacity-40 uppercase tracking-[0.3em] max-w-xs mx-auto">Hear the pattern, identify the steps. 5 Rounds.</p>
                <Button 
                  onClick={startQuiz}
                  className="w-full h-24 bg-primary text-white text-2xl font-black uppercase italic rounded-2xl hover:scale-105 transition-all shadow-2xl"
                >
                  Start Quiz
                </Button>
              </div>
            )}

            {(status === 'COUNT_IN' || status === 'QUIZ_PLAYING' || status === 'IDLE') && targetPatternId && (
              <div className="space-y-12 pt-8 animate-in fade-in">
                <div className="flex justify-between items-center bg-white/5 p-6 rounded-2xl border border-white/5">
                   <div className="text-xs font-black uppercase tracking-widest opacity-40 italic">
                     Round {round} / {TOTAL_ROUNDS}
                   </div>
                   {status === 'IDLE' && (
                     <Button 
                      variant="ghost" 
                      onClick={() => playPatternOnce(RHYTHM_CONFIG.find(p => p.id === targetPatternId)!)}
                      className="h-10 px-6 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest"
                     >
                       Replay Sound
                     </Button>
                   )}
                </div>

                <div className="text-center">
                   <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter mb-4">
                     {status === 'COUNT_IN' ? countIn : status === 'QUIZ_PLAYING' ? 'LISTENING...' : 'IDENTIFY'}
                   </h2>
                   <div className="flex gap-2 justify-center">
                     {Array.from({ length: 16 }).map((_, i) => (
                       <div 
                        key={i} 
                        className={cn(
                          "w-2 h-2 rounded-full transition-all duration-75",
                          playhead === i && (status === 'QUIZ_PLAYING' || status === 'IDLE') ? "bg-primary scale-150" : "bg-white/10",
                          i % 4 === 0 && "w-3 bg-white/20"
                        )} 
                       />
                     ))}
                   </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {RHYTHM_CONFIG.map(p => {
                    const isCorrect = p.id === targetPatternId;
                    const isGuessed = p.id === lastGuess;
                    
                    let variantClass = "bg-white/5 border-white/10 hover:border-white/30";
                    if (lastGuess) {
                      if (isCorrect) variantClass = "bg-[#00E676] border-[#00E676] text-black shadow-[0_0_20px_#00E67644] scale-105";
                      else if (isGuessed) variantClass = "bg-destructive border-destructive text-white opacity-100";
                      else variantClass = "opacity-20";
                    }

                    return (
                      <Button
                        key={p.id}
                        disabled={!!lastGuess || status !== 'IDLE'}
                        onClick={() => handleGuess(p.id)}
                        className={cn("h-20 rounded-2xl font-black uppercase italic tracking-widest transition-all", variantClass)}
                      >
                        {p.name}
                      </Button>
                    );
                  })}
                </div>

                {status === 'FEEDBACK' && (
                  <div className="flex flex-col items-center gap-8 animate-in zoom-in-95">
                    <div className={cn(
                      "px-10 py-5 rounded-full border-2 text-2xl font-black uppercase italic tracking-tighter",
                      lastGuess === targetPatternId ? "border-[#00E676] text-[#00E676]" : "border-destructive text-destructive"
                    )}>
                      {lastGuess === targetPatternId ? "Pattern Match" : "Sync Error"}
                    </div>
                    <Button onClick={nextRound} className="w-full h-20 bg-white text-black text-xl font-black uppercase italic rounded-2xl shadow-xl">
                      {round < TOTAL_ROUNDS ? "Next Round" : "View Results"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {status === 'RESULTS' && (
              <div className="text-center space-y-12 animate-in zoom-in-95 py-10">
                <Trophy className="w-24 h-24 text-[#FFEA00] mx-auto drop-shadow-[0_0_40px_#FFEA0044]" />
                <div>
                  <h3 className="text-7xl font-black italic uppercase tracking-tighter text-gradient leading-none pr-10">
                    {Math.round(sessionScores.reduce((a,b) => a+b, 0) / TOTAL_ROUNDS)}%
                  </h3>
                  <p className="text-xs uppercase font-black tracking-[0.4em] opacity-30 mt-4">Recognition Accuracy</p>
                </div>
                <div className="flex gap-4">
                  <Button onClick={startQuiz} variant="outline" className="flex-1 h-20 rounded-xl border-white/10 uppercase font-black italic text-lg hover:bg-white/5">Retry</Button>
                  <Link href="/" className="flex-1">
                    <Button className="w-full h-20 bg-white text-black rounded-xl font-black uppercase italic text-lg shadow-xl">Finish Lab</Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="p-8 shrink-0 flex justify-center opacity-20">
        <div className="flex items-center gap-4">
          <Volume2 className="w-5 h-5" />
          <span className="text-[10px] font-black uppercase tracking-[0.5em]">Sample-Accurate Timing System</span>
        </div>
      </footer>
    </div>
  );
};
