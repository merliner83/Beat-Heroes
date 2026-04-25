
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Game, Level, LevelProgress } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Trophy, 
  Zap, 
  Headphones, 
  Activity, 
  CheckCircle2, 
  XCircle,
  BarChart3,
  X
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, increment, setDoc, serverTimestamp, collection, query, where } from 'firebase/firestore';

const FREQUENCY_CONFIG = [
  { freq: 31, label: 'Sub-Bass', q: 0.7 },
  { freq: 63, label: 'Kick-Grundton', q: 0.8 },
  { freq: 125, label: 'Mumpf', q: 0.9 },
  { freq: 250, label: 'Boxiness', q: 1.0 },
  { freq: 500, label: 'Körper', q: 1.1 },
  { freq: 1000, label: 'Telefon', q: 1.2 },
  { freq: 2000, label: 'Präsenz', q: 1.4 },
  { freq: 4000, label: 'Klarheit', q: 1.6 },
  { freq: 8000, label: 'Brillanz', q: 1.8 },
  { freq: 16000, label: 'Luftigkeit', q: 2.0 },
];

const FREQUENCY_STEPS = FREQUENCY_CONFIG.map(c => c.freq);
const TOTAL_ROUNDS = 6;

interface EarTrainingViewProps {
  game: Game;
  level: Level;
}

type QuizStatus = 'IDLE' | 'PLAYING' | 'FEEDBACK' | 'RESULTS';

export const EarTrainingView: React.FC<EarTrainingViewProps> = ({ game, level }) => {
  const db = useFirestore();
  const { user } = useUser();

  const [mode, setMode] = useState<'explore' | 'quiz'>('explore');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFreq, setCurrentFreq] = useState(1000);
  
  const [quizStatus, setQuizStatus] = useState<QuizStatus>('IDLE');
  const [round, setRound] = useState(1);
  const [targetFreq, setTargetFreq] = useState(1000);
  const [lastGuess, setLastGuess] = useState<number | null>(null);
  const [sessionScores, setSessionScores] = useState<number[]>([]);

  const progressQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'users', user.uid, 'progress'),
      where('levelId', '==', level.id)
    );
  }, [db, user, level.id]);

  const { data: history } = useCollection<LevelProgress>(progressQuery);

  const weeklyAverage = useMemo(() => {
    if (!history || history.length === 0) return 0;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const recentScores = history.filter(p => {
      if (!p.completedAt) return false;
      const date = new Date(p.completedAt.seconds ? p.completedAt.seconds * 1000 : p.completedAt);
      return date >= oneWeekAgo;
    });

    if (recentScores.length === 0) return 0;
    const sum = recentScores.reduce((acc, curr) => acc + curr.accuracy, 0);
    return Math.round(sum / recentScores.length);
  }, [history]);

  useEffect(() => {
    return () => {
      audioEngine?.stop();
    };
  }, []);

  const toggleNoise = async (freqOverride?: number) => {
    if (!audioEngine) return;
    if (isPlaying) {
      audioEngine.stopNoise();
      setIsPlaying(false);
    } else {
      const freq = freqOverride !== undefined ? freqOverride : (mode === 'quiz' ? targetFreq : currentFreq);
      const config = FREQUENCY_CONFIG.find(c => c.freq === freq);
      const q = config?.q || 1;
      await audioEngine.startNoise(freq, q, 'peaking');
      setIsPlaying(true);
    }
  };

  const handleFrequencyChange = (val: number[]) => {
    const freq = FREQUENCY_STEPS[val[0]];
    const config = FREQUENCY_CONFIG.find(c => c.freq === freq);
    setCurrentFreq(freq);
    if (mode === 'explore' && isPlaying) {
      audioEngine?.updateFilter(freq, config?.q || 1);
    }
  };

  const startQuizSession = () => {
    setMode('quiz');
    setQuizStatus('PLAYING');
    setRound(1);
    setSessionScores([]);
    generateNewTarget();
  };

  const cancelQuiz = () => {
    setQuizStatus('IDLE');
    setMode('explore');
    audioEngine?.stopNoise();
    setIsPlaying(false);
  };

  const generateNewTarget = () => {
    const randomFreq = FREQUENCY_STEPS[Math.floor(Math.random() * FREQUENCY_STEPS.length)];
    setTargetFreq(randomFreq);
    setQuizStatus('PLAYING');
    setLastGuess(null);
    setIsPlaying(false);
    setTimeout(() => toggleNoise(randomFreq), 300);
  };

  const handleGuess = (freq: number) => {
    if (quizStatus !== 'PLAYING') return;
    
    audioEngine?.stopNoise();
    setIsPlaying(false);
    
    setLastGuess(freq);
    const isMatch = freq === targetFreq;
    const score = isMatch ? 100 : 0;
    
    setSessionScores(prev => [...prev, score]);
    setQuizStatus('FEEDBACK');
  };

  const nextRound = () => {
    if (round < TOTAL_ROUNDS) {
      setRound(r => r + 1);
      generateNewTarget();
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = () => {
    const avgScore = Math.round(sessionScores.reduce((a, b) => a + b, 0) / TOTAL_ROUNDS);
    setQuizStatus('RESULTS');

    if (user && db) {
      setDoc(doc(db, 'users', user.uid, 'progress', level.id), { 
        levelId: level.id, 
        accuracy: avgScore, 
        completedAt: serverTimestamp() 
      }, { merge: true });
      setDoc(doc(db, 'users', user.uid), { streetCred: increment(avgScore * 5) }, { merge: true });
    }
  };

  const formatFreqValue = (freq: number) => {
    if (freq >= 1000) return `${freq / 1000}`;
    return `${freq}`;
  };

  const getFreqUnit = (freq: number) => {
    return freq >= 1000 ? "KHZ" : "HZ";
  };

  const currentConfig = FREQUENCY_CONFIG.find(c => c.freq === currentFreq);

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-4 font-body overflow-hidden selection:bg-primary">
      <header className="flex justify-between items-center h-20 shrink-0 z-50 px-6 md:px-10 bg-black/40 backdrop-blur-xl border-b border-white/5 rounded-t-3xl">
        <div className="flex items-center gap-4">
          <Link href="/">
            <ArrowLeft className="w-6 h-6 text-white/40 hover:text-white transition-all hover:scale-110" />
          </Link>
          <div className="pr-12">
            <h1 className="text-lg md:text-xl font-black uppercase italic tracking-tighter text-gradient leading-none whitespace-nowrap pr-10">
              EAR TRAINING
            </h1>
            <p className="text-[10px] opacity-30 uppercase font-black tracking-[0.2em] mt-1">Master the Spectrum</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-3 opacity-30 text-[10px] md:text-xs font-black uppercase tracking-widest">
           <Zap className="w-4 h-4 text-[#FFEA00]" fill="currentColor" />
           Rack Connected
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start p-6 md:p-12 relative overflow-y-auto">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#FF3399 1.5px, transparent 1.5px)', backgroundSize: '40px 40px' }} />

        {(quizStatus === 'IDLE' || mode === 'explore') && (
          <div className="relative z-50 animate-in fade-in slide-in-from-top-4 duration-500 mb-10 md:mb-16">
            <div className="inline-flex p-1.5 bg-white/5 rounded-xl border border-white/5 backdrop-blur-xl shadow-2xl">
              <div className={cn("rounded-lg transition-all", mode === 'explore' && "gemini-border-primary")}>
                <Button 
                  variant="ghost" 
                  onClick={() => { setMode('explore'); setQuizStatus('IDLE'); }}
                  className={cn(
                    "rounded-lg px-8 md:px-14 py-6 text-base md:text-xl font-black uppercase tracking-widest transition-all duration-300 border-none",
                    mode === 'explore' ? "bg-white/10 text-white" : "text-white/20 hover:text-white/40"
                  )}
                >
                  Explore
                </Button>
              </div>
              <div className={cn("rounded-lg transition-all", mode === 'quiz' && "gemini-border-primary")}>
                <Button 
                  variant="ghost" 
                  onClick={() => { setMode('quiz'); if(quizStatus === 'RESULTS' || quizStatus === 'IDLE') setQuizStatus('IDLE'); }}
                  className={cn(
                    "rounded-lg px-8 md:px-14 py-6 text-base md:text-xl font-black uppercase tracking-widest transition-all duration-300 border-none",
                    mode === 'quiz' ? "bg-primary text-white" : "text-white/20 hover:text-white/40"
                  )}
                >
                  Quiz Mode
                </Button>
              </div>
            </div>
          </div>
        )}

        {(quizStatus === 'PLAYING' || quizStatus === 'FEEDBACK') && (
          <div className="absolute top-4 right-4 md:right-10 z-[60]">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={cancelQuiz}
              className="w-12 h-12 rounded-full text-white/20 hover:text-white hover:bg-white/10 transition-all border border-white/5 bg-black/40 backdrop-blur-xl"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        )}

        {mode === 'explore' && (
          <div className="w-full max-w-2xl space-y-16 animate-in fade-in zoom-in-95 duration-700">
            <div className="text-center">
              <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10 shadow-[0_0_50px_rgba(255,51,153,0.1)]">
                <Activity className={cn("w-6 h-6 transition-all", isPlaying ? "text-[#00E676] scale-110" : "text-white/20")} />
              </div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-3">Scanner</h2>
              <p className="text-[10px] opacity-40 uppercase tracking-[0.3em]">Train your ears by peaking specific bands</p>
            </div>

            <div className="gemini-border-primary">
              <div className="p-10 md:p-14 bg-black/60 backdrop-blur-3xl space-y-8 rounded-xl border border-white/5 overflow-hidden">
                <div className="flex flex-col items-center px-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl md:text-6xl font-black italic text-gradient leading-tight pr-3">
                      {formatFreqValue(currentFreq)}
                    </span>
                    <span className="text-lg md:text-xl font-black opacity-20 uppercase tracking-[0.4em]">
                      {getFreqUnit(currentFreq)}
                    </span>
                  </div>
                  <span className="text-sm md:text-lg font-black opacity-40 uppercase tracking-widest mt-2">
                    {currentConfig?.label}
                  </span>
                </div>
                <Slider 
                  min={0} 
                  max={FREQUENCY_STEPS.length - 1} 
                  step={1} 
                  value={[FREQUENCY_STEPS.indexOf(currentFreq)]} 
                  onValueChange={handleFrequencyChange}
                  className="py-8"
                />
                <div className="flex justify-between text-[10px] font-black opacity-20 uppercase tracking-widest px-1">
                  <span>31 HZ</span>
                  <span>1 KHZ</span>
                  <span>16 KHZ</span>
                </div>
              </div>
            </div>

            <Button 
              onClick={() => toggleNoise()}
              className={cn(
                "w-full h-20 md:h-28 rounded-2xl text-xl md:text-2xl font-black uppercase italic transition-all active:scale-95 shadow-xl",
                isPlaying ? "bg-[#FF3D00] text-white" : "bg-white text-black"
              )}
            >
              {isPlaying ? <><Pause className="mr-4 w-7 h-7" fill="currentColor" /> Stop Engine</> : <><Play className="mr-4 w-7 h-7" fill="currentColor" /> Play Noise</>}
            </Button>
          </div>
        )}

        {mode === 'quiz' && (
          <div className="w-full max-w-3xl animate-in slide-in-from-bottom-8 duration-700">
            {quizStatus === 'IDLE' && (
              <div className="text-center space-y-10 mt-6">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20">
                  <Headphones className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter mb-3">EAR TRAINING</h2>
                  <p className="text-[11px] opacity-40 uppercase tracking-[0.3em]">6 Rounds frequency identification</p>
                </div>
                <Button 
                  onClick={startQuizSession}
                  className="w-full h-20 md:h-32 bg-primary text-white text-xl md:text-3xl font-black uppercase italic rounded-2xl hover:scale-105 transition-all shadow-2xl shadow-primary/30"
                >
                  Start Quiz
                </Button>
                {weeklyAverage > 0 && (
                   <div className="flex items-center justify-center gap-3 text-sm opacity-30 font-black uppercase tracking-widest pt-4">
                     <BarChart3 className="w-5 h-5" />
                     Weekly Average: {weeklyAverage}%
                   </div>
                )}
              </div>
            )}

            {(quizStatus === 'PLAYING' || quizStatus === 'FEEDBACK') && (
              <div className="space-y-8 md:space-y-12 pt-10 md:pt-16">
                <div className="flex justify-between items-center bg-white/5 px-6 py-4 md:px-8 md:py-5 rounded-xl border border-white/5 backdrop-blur-md">
                   <div className="text-[10px] md:text-[11px] font-black uppercase tracking-widest opacity-40">
                     Round {round} / {TOTAL_ROUNDS}
                   </div>
                   <Button 
                     variant="ghost" 
                     onClick={() => toggleNoise()}
                     className={cn(
                       "h-10 md:h-12 rounded-lg px-6 md:px-8 text-[9px] md:text-[10px] font-black uppercase tracking-widest border transition-all",
                       isPlaying ? "bg-primary text-white border-primary" : "bg-white/5 border-white/10"
                     )}
                   >
                     {isPlaying ? "Pause" : "Play Sound"}
                   </Button>
                </div>

                <div className="text-center">
                   <h2 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter mb-2">
                     Identify Peak
                   </h2>
                   <p className="text-[9px] md:text-[10px] opacity-40 uppercase tracking-[0.3em]">Which frequency is highlighted?</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
                  {FREQUENCY_STEPS.map(freq => {
                    const isCorrect = freq === targetFreq;
                    const isGuessed = freq === lastGuess;
                    
                    let containerClass = "bg-white/5 border-white/10 hover:border-white/20 transition-all duration-300";
                    let isNeon = !lastGuess;

                    if (quizStatus === 'FEEDBACK') {
                      if (isCorrect) {
                        containerClass = "bg-[#00E676] border-[#00E676] scale-105 z-10 shadow-[0_0_30px_#00E67644] text-black";
                        isNeon = true;
                      } else if (isGuessed) {
                        containerClass = "bg-[#FF3D00] border-[#FF3D00] text-white";
                        isNeon = false;
                      } else {
                        containerClass = "bg-transparent border-white/5 opacity-10 text-white";
                        isNeon = false;
                      }
                    }

                    return (
                      <div key={freq} className={cn("rounded-lg transition-all", isNeon && "gemini-border-primary")}>
                        <Button
                          disabled={quizStatus === 'FEEDBACK'}
                          onClick={() => handleGuess(freq)}
                          className={cn(
                            "w-full h-16 md:h-20 rounded-lg border flex flex-col items-center justify-center transition-all duration-300 gap-1",
                            containerClass
                          )}
                        >
                          <div className="flex items-baseline gap-1">
                            <span className="text-base md:text-xl font-black italic leading-none">
                              {formatFreqValue(freq)}
                            </span>
                            <span className="text-[8px] md:text-[9px] font-black opacity-50 uppercase tracking-widest">
                              {getFreqUnit(freq)}
                            </span>
                          </div>
                        </Button>
                      </div>
                    );
                  })}
                </div>

                {quizStatus === 'FEEDBACK' && (
                  <div className="flex flex-col items-center gap-6 md:gap-10 animate-in zoom-in-95 duration-300">
                    <div className={cn(
                      "flex items-center gap-4 md:gap-6 px-8 py-4 md:px-12 md:py-6 rounded-full border-2 text-xl md:text-3xl font-black uppercase italic tracking-tighter",
                      lastGuess === targetFreq ? "border-[#00E676] text-[#00E676] bg-[#00E676]/5" : "border-[#FF3D00] text-[#FF3D00] bg-[#FF3D00]/5"
                    )}>
                      {lastGuess === targetFreq ? (
                        <><CheckCircle2 className="w-6 h-6 md:w-8 md:h-8" /> Match</>
                      ) : (
                        <><XCircle className="w-6 h-6 md:w-8 md:h-8" /> Miss</>
                      )}
                    </div>
                    <Button 
                      onClick={nextRound}
                      className="w-full h-16 md:h-24 bg-white text-black text-lg md:text-2xl font-black uppercase italic rounded-xl shadow-xl hover:scale-105 transition-all"
                    >
                      {round < TOTAL_ROUNDS ? "Next Round" : "View Results"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {quizStatus === 'RESULTS' && (
              <div className="text-center space-y-12 md:space-y-16 animate-in zoom-in-95 mt-6">
                <div className="relative inline-block">
                  <div className="w-20 h-20 md:w-24 md:h-24 bg-white/5 rounded-full flex items-center justify-center border border-white/10 shadow-[0_0_60px_rgba(255,51,153,0.15)]">
                    <Trophy className={cn("w-10 h-10 md:w-12 md:h-12", sessionScores.filter(s => s === 100).length >= 4 ? "text-[#FFEA00]" : "text-white/20")} />
                  </div>
                  <Zap className="absolute -top-1 -right-1 w-8 h-8 md:w-10 md:h-10 text-[#FFEA00] animate-pulse" fill="currentColor" />
                </div>

                <div>
                  <h3 className="text-6xl md:text-8xl font-black italic uppercase tracking-tighter mb-3 text-gradient leading-tight pr-10">
                    {Math.round(sessionScores.reduce((a,b) => a+b, 0) / TOTAL_ROUNDS)}%
                  </h3>
                  <p className="text-[10px] uppercase font-black tracking-[0.5em] opacity-30">Session Accuracy</p>
                </div>

                <div className="grid grid-cols-2 gap-4 md:gap-8">
                  <div className="gemini-border-primary">
                    <div className="p-6 md:p-8 bg-black/60 rounded-xl border border-white/5">
                      <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest opacity-30 mb-2 md:mb-3">Weekly Average</p>
                      <p className="text-2xl md:text-3xl font-black italic text-[#00E676]">{weeklyAverage}%</p>
                    </div>
                  </div>
                  <div className="gemini-border-primary">
                    <div className="p-6 md:p-8 bg-black/60 rounded-xl border border-white/5">
                      <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest opacity-30 mb-2 md:mb-3">Matches</p>
                      <p className="text-2xl md:text-3xl font-black italic text-primary">{sessionScores.filter(s => s === 100).length} / {TOTAL_ROUNDS}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 md:gap-8">
                  <Button onClick={startQuizSession} variant="outline" className="flex-1 h-16 md:h-20 rounded-xl border-white/10 uppercase font-black italic text-lg md:text-xl hover:bg-white/5">New Quiz</Button>
                  <Link href="/" className="flex-1">
                    <Button className="w-full h-16 md:h-20 bg-white text-black rounded-xl font-black uppercase italic text-lg md:text-xl shadow-xl">Finish</Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="p-6 md:p-8 shrink-0 flex justify-center opacity-20">
        <div className="flex items-center gap-4">
          <Headphones className="w-5 h-5" />
          <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.5em]">Optimized for Studio Monitors</span>
        </div>
      </footer>
    </div>
  );
};
