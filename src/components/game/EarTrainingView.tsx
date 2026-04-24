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

const FREQUENCY_STEPS = [
  20, 40, 60, 125, 250, 500, 1000, 2000, 4000, 8000, 16000, 18000, 20000
];

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
  
  // Quiz State
  const [quizStatus, setQuizStatus] = useState<QuizStatus>('IDLE');
  const [round, setRound] = useState(1);
  const [targetFreq, setTargetFreq] = useState(1000);
  const [lastGuess, setLastGuess] = useState<number | null>(null);
  const [sessionScores, setSessionScores] = useState<number[]>([]);

  // Fetch previous progress
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
      await audioEngine.startNoise(freq, 2.5, 'peaking');
      setIsPlaying(true);
    }
  };

  const handleFrequencyChange = (val: number[]) => {
    const freq = FREQUENCY_STEPS[val[0]];
    setCurrentFreq(freq);
    if (mode === 'explore' && isPlaying) {
      audioEngine?.updateFilter(freq, 1);
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

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-4 font-body overflow-hidden selection:bg-primary">
      <header className="flex justify-between items-center h-20 shrink-0 z-50 px-6 md:px-10 bg-black/40 backdrop-blur-xl border-b border-white/5 rounded-t-3xl">
        <div className="flex items-center gap-4">
          <Link href="/">
            <ArrowLeft className="w-6 h-6 text-white/40 hover:text-white transition-all hover:scale-110" />
          </Link>
          <div className="pr-6">
            <h1 className="text-lg md:text-xl font-black uppercase italic tracking-tighter text-gradient leading-none whitespace-nowrap">
              EAR TRAINING
            </h1>
            <p className="text-[9px] opacity-30 uppercase font-black tracking-[0.2em] mt-1">Master the Spectrum</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-3 opacity-30 text-[10px] md:text-xs font-black uppercase tracking-widest">
           <Zap className="w-4 h-4 text-[#FFEA00]" fill="currentColor" />
           Rack Connected
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start p-4 md:p-8 relative overflow-y-auto">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#FF3399 1.5px, transparent 1.5px)', backgroundSize: '40px 40px' }} />

        {/* Mode Toggle */}
        {(quizStatus === 'IDLE' || mode === 'explore') && (
          <div className="relative z-50 animate-in fade-in slide-in-from-top-4 duration-500 mb-8">
            <div className="inline-flex p-1 bg-white/5 rounded-xl border border-white/5 backdrop-blur-xl shadow-2xl">
              <div className={cn("rounded-lg transition-all", mode === 'explore' && "gemini-border-primary")}>
                <Button 
                  variant="ghost" 
                  onClick={() => { setMode('explore'); setQuizStatus('IDLE'); }}
                  className={cn(
                    "rounded-lg px-8 md:px-12 py-6 text-sm md:text-lg font-black uppercase tracking-widest transition-all duration-300 border-none",
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
                    "rounded-lg px-8 md:px-12 py-6 text-sm md:text-lg font-black uppercase tracking-widest transition-all duration-300 border-none",
                    mode === 'quiz' ? "bg-primary text-white" : "text-white/20 hover:text-white/40"
                  )}
                >
                  Quiz Mode
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Quiz Cancel Button */}
        {(quizStatus === 'PLAYING' || quizStatus === 'FEEDBACK') && (
          <div className="absolute top-4 right-4 md:right-8 z-50">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={cancelQuiz}
              className="w-10 h-10 rounded-full text-white/20 hover:text-white hover:bg-white/10 transition-all border border-white/5"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        )}

        {mode === 'explore' && (
          <div className="w-full max-w-2xl space-y-8 animate-in fade-in zoom-in-95 duration-700">
            <div className="text-center">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10 shadow-[0_0_50px_rgba(255,51,153,0.1)]">
                <Activity className={cn("w-6 h-6 transition-all", isPlaying ? "text-[#00E676] scale-110" : "text-white/20")} />
              </div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-1">Scanner</h2>
              <p className="text-[9px] opacity-40 uppercase tracking-[0.3em]">Train your ears by peaking specific bands</p>
            </div>

            <div className="gemini-border-primary">
              <div className="p-8 bg-black/60 backdrop-blur-3xl space-y-6 rounded-xl border border-white/5">
                <div className="flex flex-col items-center">
                  <span className="text-4xl md:text-6xl font-black italic text-gradient leading-none">
                    {formatFreqValue(currentFreq)}
                  </span>
                  <span className="text-lg md:text-xl font-black opacity-20 uppercase tracking-[0.4em] mt-2">
                    {getFreqUnit(currentFreq)}
                  </span>
                </div>
                <Slider 
                  min={0} 
                  max={FREQUENCY_STEPS.length - 1} 
                  step={1} 
                  value={[FREQUENCY_STEPS.indexOf(currentFreq)]} 
                  onValueChange={handleFrequencyChange}
                  className="py-4"
                />
                <div className="flex justify-between text-[9px] font-black opacity-20 uppercase tracking-widest">
                  <span>20 HZ</span>
                  <span>1 KHZ</span>
                  <span>20 KHZ</span>
                </div>
              </div>
            </div>

            <Button 
              onClick={() => toggleNoise()}
              className={cn(
                "w-full h-16 md:h-20 rounded-2xl text-lg font-black uppercase italic transition-all active:scale-95 shadow-xl",
                isPlaying ? "bg-[#FF3D00] text-white" : "bg-white text-black"
              )}
            >
              {isPlaying ? <><Pause className="mr-3 w-5 h-5" fill="currentColor" /> Stop Engine</> : <><Play className="mr-3 w-5 h-5" fill="currentColor" /> Play Noise</>}
            </Button>
          </div>
        )}

        {mode === 'quiz' && (
          <div className="w-full max-w-2xl animate-in slide-in-from-bottom-8 duration-700">
            {quizStatus === 'IDLE' && (
              <div className="text-center space-y-6 mt-4">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20">
                  <Headphones className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-1">Golden Ears</h2>
                  <p className="text-xs opacity-40 uppercase tracking-[0.3em]">6 Rounds frequency identification</p>
                </div>
                <Button 
                  onClick={startQuizSession}
                  className="w-full h-18 md:h-24 bg-primary text-white text-xl font-black uppercase italic rounded-2xl hover:scale-105 transition-all shadow-2xl shadow-primary/30"
                >
                  Start Quiz
                </Button>
                {weeklyAverage > 0 && (
                   <div className="flex items-center justify-center gap-3 text-xs opacity-30 font-black uppercase tracking-widest">
                     <BarChart3 className="w-4 h-4" />
                     Weekly Average: {weeklyAverage}%
                   </div>
                )}
              </div>
            )}

            {(quizStatus === 'PLAYING' || quizStatus === 'FEEDBACK') && (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-white/5 px-6 py-2 rounded-xl border border-white/5 backdrop-blur-md">
                   <div className="text-[10px] font-black uppercase tracking-widest opacity-40">
                     Round {round} / {TOTAL_ROUNDS}
                   </div>
                   <Button 
                     variant="ghost" 
                     onClick={() => toggleNoise()}
                     className={cn(
                       "h-9 rounded-lg px-5 text-[9px] font-black uppercase tracking-widest border transition-all",
                       isPlaying ? "bg-primary text-white border-primary" : "bg-white/5 border-white/10"
                     )}
                   >
                     {isPlaying ? "Pause" : "Play Sound"}
                   </Button>
                </div>

                <div className="text-center">
                   <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-1">
                     Identify Peak
                   </h2>
                   <p className="text-[9px] opacity-40 uppercase tracking-[0.3em]">Which frequency is highlighted?</p>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
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
                            "w-full h-20 rounded-lg border flex flex-col items-center justify-center transition-all duration-300 gap-1",
                            containerClass
                          )}
                        >
                          <span className="text-base md:text-xl font-black italic leading-none">
                            {formatFreqValue(freq)}
                          </span>
                          <span className="text-[8px] font-black opacity-40 uppercase tracking-widest">
                            {getFreqUnit(freq)}
                          </span>
                        </Button>
                      </div>
                    );
                  })}
                </div>

                {quizStatus === 'FEEDBACK' && (
                  <div className="flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
                    <div className={cn(
                      "flex items-center gap-4 px-8 py-4 rounded-full border-2 text-xl font-black uppercase italic tracking-tighter",
                      lastGuess === targetFreq ? "border-[#00E676] text-[#00E676] bg-[#00E676]/5" : "border-[#FF3D00] text-[#FF3D00] bg-[#FF3D00]/5"
                    )}>
                      {lastGuess === targetFreq ? (
                        <><CheckCircle2 className="w-6 h-6" /> Match</>
                      ) : (
                        <><XCircle className="w-6 h-6" /> Miss</>
                      )}
                    </div>
                    <Button 
                      onClick={nextRound}
                      className="w-full h-16 bg-white text-black text-lg font-black uppercase italic rounded-xl shadow-xl hover:scale-105 transition-all"
                    >
                      {round < TOTAL_ROUNDS ? "Next Round" : "View Results"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {quizStatus === 'RESULTS' && (
              <div className="text-center space-y-8 animate-in zoom-in-95 mt-4">
                <div className="relative inline-block">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/10 shadow-[0_0_60px_rgba(255,51,153,0.15)]">
                    <Trophy className={cn("w-10 h-10", sessionScores.filter(s => s === 100).length >= 4 ? "text-[#FFEA00]" : "text-white/20")} />
                  </div>
                  <Zap className="absolute -top-1 -right-1 w-8 h-8 text-[#FFEA00] animate-pulse" fill="currentColor" />
                </div>

                <div>
                  <h3 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter mb-1 text-gradient">
                    {Math.round(sessionScores.reduce((a,b) => a+b, 0) / TOTAL_ROUNDS)}%
                  </h3>
                  <p className="text-[9px] uppercase font-black tracking-[0.5em] opacity-30">Session Accuracy</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="gemini-border-primary">
                    <div className="p-4 bg-black/60 rounded-xl border border-white/5">
                      <p className="text-[9px] font-black uppercase tracking-widest opacity-30 mb-1">Weekly Average</p>
                      <p className="text-2xl font-black italic text-[#00E676]">{weeklyAverage}%</p>
                    </div>
                  </div>
                  <div className="gemini-border-primary">
                    <div className="p-4 bg-black/60 rounded-xl border border-white/5">
                      <p className="text-[9px] font-black uppercase tracking-widest opacity-30 mb-1">Matches</p>
                      <p className="text-2xl font-black italic text-primary">{sessionScores.filter(s => s === 100).length} / {TOTAL_ROUNDS}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button onClick={startQuizSession} variant="outline" className="flex-1 h-16 rounded-xl border-white/10 uppercase font-black italic text-base hover:bg-white/5">New Quiz</Button>
                  <Link href="/" className="flex-1">
                    <Button className="w-full h-16 bg-white text-black rounded-xl font-black uppercase italic text-base shadow-xl">Finish</Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="p-4 shrink-0 flex justify-center opacity-20">
        <div className="flex items-center gap-3">
          <Headphones className="w-3 h-3" />
          <span className="text-[9px] font-black uppercase tracking-[0.5em]">Optimized for Studio Monitors</span>
        </div>
      </footer>
    </div>
  );
};