
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
  Brain,
  Music
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
    id: '8th-shaker', 
    name: '8th Shaker', 
    steps: [0, 2, 4, 6, 8, 10, 12, 14], 
    soundUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2Foooh.wav?alt=media&token=bf90be29-fd25-4fad-bc2c-9483840246ba' 
  },
  { 
    id: '16th-trap-hats', 
    name: 'Trap Hi-Hats', 
    steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 
    soundUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FSHE_HiHat_03.wav?alt=media&token=a5e7b4ac-3af8-49ab-bb6b-557a6e3551bd' 
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
  const bpm = game.bpm || 128;
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
    <div className="flex flex-col h-screen bg-[#050505] text-white p-4 font-body overflow-hidden selection:bg-primary">
      <header className="flex justify-between items-center h-20 shrink-0 z-50 px-6 bg-black/40 backdrop-blur-xl border-b border-white/5 rounded-t-3xl">
        <div className="flex items-center gap-4">
          <Link href="/">
            <ArrowLeft className="w-6 h-6 text-white/40 hover:text-white transition-all hover:scale-110" />
          </Link>
          <div>
            <h1 className="text-xl font-black uppercase italic tracking-tighter text-gradient leading-none pr-8">RHYTHM MASTER</h1>
            <p className="text-[10px] opacity-30 uppercase font-black tracking-[0.2em] mt-1">MIDI Lab Interface</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-3 opacity-30 text-[10px] md:text-xs font-black uppercase tracking-widest">
           <Music className="w-4 h-4 text-primary" />
           Sync Active
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
          <div className="w-full max-w-4xl space-y-12 animate-in zoom-in-95 duration-500">
            {/* Visualizer Header - Same as Quiz */}
            <div className="text-center">
              <h2 className="text-4xl md:text-7xl font-black uppercase italic tracking-tighter mb-6 text-gradient">
                {isPlaying ? 'PLAYING...' : 'PREVIEW'}
              </h2>
              <div className="flex gap-2 justify-center max-w-md mx-auto mb-16">
                {Array.from({ length: 16 }).map((_, i) => {
                  const isStep = selectedPattern.steps.includes(i);
                  const isCurrent = playhead === i && isPlaying;
                  const isBeat = i % 4 === 0;

                  return (
                    <div 
                      key={i} 
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-75 flex-1",
                        isCurrent ? "bg-primary scale-y-[3] shadow-[0_0_20px_#FF3399]" : "bg-white/10",
                        !isCurrent && isStep && "bg-primary/40",
                        !isCurrent && !isStep && isBeat && "bg-white/30"
                      )} 
                    />
                  );
                })}
              </div>
            </div>

            {/* Pattern Selection Buttons */}
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
                    "h-16 md:h-20 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all",
                    selectedPatternId === p.id 
                      ? "bg-primary border-primary text-white shadow-[0_0_15px_rgba(255,51,153,0.3)]" 
                      : "bg-white/5 border-white/5 hover:border-white/20 text-white/40"
                  )}
                >
                  <span className="text-xs font-black uppercase italic tracking-tighter">{p.name}</span>
                </Button>
              ))}
            </div>

            <Button 
              onClick={toggleExplore}
              className={cn(
                "w-full h-24 rounded-3xl text-2xl font-black uppercase italic transition-all active:scale-95 shadow-2xl",
                isPlaying ? "bg-destructive text-white" : "bg-white text-black"
              )}
            >
              {isPlaying ? <Pause className="mr-4 w-10 h-10" fill="currentColor" /> : <Play className="mr-4 w-10 h-10" fill="currentColor" />}
              {isPlaying ? "Deactivate Pulse" : "Initiate Rhythm"}
            </Button>
          </div>
        )}

        {mode === 'quiz' && (
          <div className="w-full max-w-2xl">
            {status === 'IDLE' && !lastGuess && sessionScores.length === 0 && (
              <div className="text-center space-y-10 animate-in zoom-in-95 mt-10">
                <div className="w-28 h-28 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20 shadow-[0_0_40px_rgba(255,51,153,0.1)]">
                  <Brain className="w-14 h-14 text-primary" />
                </div>
                <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">Recognition Lab</h2>
                <p className="text-[10px] opacity-40 uppercase tracking-[0.4em] max-w-xs mx-auto leading-relaxed">Listen to the MIDI stream.<br/>Identify the core pattern.</p>
                <Button 
                  onClick={startQuiz}
                  className="w-full h-28 bg-primary text-white text-2xl font-black uppercase italic rounded-3xl hover:scale-105 transition-all shadow-2xl shadow-primary/30"
                >
                  Enter Training
                </Button>
              </div>
            )}

            {(status === 'COUNT_IN' || status === 'QUIZ_PLAYING' || status === 'IDLE') && targetPatternId && (
              <div className="space-y-12 pt-8 animate-in fade-in">
                <div className="flex justify-between items-center bg-white/5 p-6 rounded-2xl border border-white/5 backdrop-blur-xl">
                   <div className="text-xs font-black uppercase tracking-widest opacity-40 italic">
                     Round {round} / {TOTAL_ROUNDS}
                   </div>
                   {status === 'IDLE' && (
                     <Button 
                      variant="ghost" 
                      onClick={() => playPatternOnce(RHYTHM_CONFIG.find(p => p.id === targetPatternId)!)}
                      className="h-10 px-8 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
                     >
                       Replay Sound
                     </Button>
                   )}
                </div>

                <div className="text-center">
                   <h2 className="text-4xl md:text-7xl font-black uppercase italic tracking-tighter mb-6 text-gradient">
                     {status === 'COUNT_IN' ? countIn : status === 'QUIZ_PLAYING' ? 'SCANNING...' : 'IDENTIFY'}
                   </h2>
                   <div className="flex gap-2 justify-center max-w-md mx-auto">
                     {Array.from({ length: 16 }).map((_, i) => (
                       <div 
                        key={i} 
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-75 flex-1",
                          playhead === i && (status === 'QUIZ_PLAYING' || status === 'IDLE') ? "bg-primary scale-y-150" : "bg-white/10",
                          i % 4 === 0 && "bg-white/30"
                        )} 
                       />
                     ))}
                   </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {RHYTHM_CONFIG.map(p => {
                    const isCorrect = p.id === targetPatternId;
                    const isGuessed = p.id === lastGuess;
                    
                    let variantClass = "bg-white/5 border-white/5 hover:border-white/20";
                    if (lastGuess) {
                      if (isCorrect) variantClass = "bg-[#00E676] border-[#00E676] text-black shadow-[0_0_30px_#00E67644] scale-105 z-10";
                      else if (isGuessed) variantClass = "bg-destructive border-destructive text-white";
                      else variantClass = "opacity-10";
                    }

                    return (
                      <Button
                        key={p.id}
                        disabled={!!lastGuess || status !== 'IDLE'}
                        onClick={() => handleGuess(p.id)}
                        className={cn("h-24 rounded-2xl font-black uppercase italic tracking-widest transition-all text-sm md:text-base border-2", variantClass)}
                      >
                        {p.name}
                      </Button>
                    );
                  })}
                </div>

                {status === 'FEEDBACK' && (
                  <div className="flex flex-col items-center gap-8 animate-in zoom-in-95">
                    <div className={cn(
                      "px-14 py-6 rounded-full border-2 text-2xl font-black uppercase italic tracking-tighter shadow-2xl",
                      lastGuess === targetPatternId ? "border-[#00E676] text-[#00E676] bg-[#00E676]/5" : "border-destructive text-destructive bg-destructive/5"
                    )}>
                      {lastGuess === targetPatternId ? "Pattern Match" : "Sync Error"}
                    </div>
                    <Button onClick={nextRound} className="w-full h-24 bg-white text-black text-2xl font-black uppercase italic rounded-3xl shadow-2xl hover:scale-105 transition-all">
                      {round < TOTAL_ROUNDS ? "Next Round" : "Lab Results"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {status === 'RESULTS' && (
              <div className="text-center space-y-12 animate-in zoom-in-95 py-10 mt-6">
                <div className="relative inline-block">
                  <div className="w-28 h-28 bg-white/5 rounded-full flex items-center justify-center border border-white/5 shadow-[0_0_60px_rgba(255,234,0,0.2)]">
                    <Trophy className="w-14 h-14 text-[#FFEA00]" />
                  </div>
                  <Zap className="absolute -top-2 -right-2 w-10 h-10 text-[#FFEA00] animate-pulse" fill="currentColor" />
                </div>

                <div>
                  <h3 className="text-7xl md:text-9xl font-black italic uppercase tracking-tighter text-gradient leading-none pr-10">
                    {Math.round(sessionScores.reduce((a,b) => a+b, 0) / TOTAL_ROUNDS)}%
                  </h3>
                  <p className="text-[10px] uppercase font-black tracking-[0.5em] opacity-30 mt-6">Recognition Accuracy</p>
                </div>
                
                <div className="flex gap-6 pt-10">
                  <Button onClick={startQuiz} variant="outline" className="flex-1 h-20 rounded-2xl border-white/10 uppercase font-black italic text-xl hover:bg-white/5">Retry Lab</Button>
                  <Link href="/" className="flex-1">
                    <Button className="w-full h-20 bg-white text-black rounded-2xl font-black uppercase italic text-xl shadow-2xl">Return to Hub</Button>
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
          <span className="text-[10px] font-black uppercase tracking-[0.5em]">Sample-Accurate MIDI Engine • v4.0</span>
        </div>
      </footer>
    </div>
  );
};
