
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
  BarChart3
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, increment, setDoc, serverTimestamp, collection, query, where } from 'firebase/firestore';

const FREQUENCY_STEPS = [
  63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000
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

  // Fetch previous progress for Weekly Average
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
    const freq = val[0];
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

  const generateNewTarget = () => {
    const randomFreq = FREQUENCY_STEPS[Math.floor(Math.random() * FREQUENCY_STEPS.length)];
    setTargetFreq(randomFreq);
    setQuizStatus('PLAYING');
    setLastGuess(null);
    setIsPlaying(false);
    // Auto-play noise for the new round
    setTimeout(() => toggleNoise(randomFreq), 300);
  };

  const handleGuess = (freq: number) => {
    if (quizStatus !== 'PLAYING') return;
    
    audioEngine?.stopNoise();
    setIsPlaying(false);
    
    setLastGuess(freq);
    const isMatch = freq === targetFreq;
    const score = isMatch ? 100 : 0; // Binary match/miss for quiz rounds
    
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

  const logToFreq = (val: number) => Math.pow(10, val);
  const freqToLog = (freq: number) => Math.log10(freq);

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-4 font-body overflow-hidden">
      <header className="flex justify-between items-center h-16 shrink-0 z-50 px-4 md:px-8 bg-black/40 backdrop-blur-xl border-b border-white/5 rounded-t-3xl">
        <div className="flex items-center gap-4">
          <Link href="/">
            <ArrowLeft className="w-5 h-5 text-white/40 hover:text-white transition-all" />
          </Link>
          <div>
            <h1 className="text-sm font-black uppercase italic tracking-tighter text-gradient">Ear Training</h1>
            <p className="text-[10px] opacity-30 uppercase font-black tracking-widest">Master the Spectrum</p>
          </div>
        </div>
        <div className="flex gap-2 bg-white/5 p-1 rounded-full border border-white/5">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => { setMode('explore'); setQuizStatus('IDLE'); }}
            className={cn("rounded-full px-6 text-[10px] font-black uppercase tracking-widest h-8 transition-all", mode === 'explore' ? "bg-white/10 text-white" : "text-white/30")}
          >
            Explore
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => { setMode('quiz'); if(quizStatus === 'RESULTS' || quizStatus === 'IDLE') setQuizStatus('IDLE'); }}
            className={cn("rounded-full px-6 text-[10px] font-black uppercase tracking-widest h-8 transition-all", mode === 'quiz' ? "bg-primary text-white" : "text-white/30")}
          >
            Quiz
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative overflow-y-auto">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#FF3399 1.5px, transparent 1.5px)', backgroundSize: '40px 40px' }} />

        {mode === 'explore' && (
          <div className="w-full max-w-2xl space-y-10 animate-in fade-in zoom-in-95 duration-700">
            <div className="text-center">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10 shadow-[0_0_50px_rgba(255,51,153,0.1)]">
                <Activity className={cn("w-10 h-10 transition-all", isPlaying ? "text-[#00E676] scale-110" : "text-white/20")} />
              </div>
              <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-2">Frequency Scanner</h2>
              <p className="text-xs opacity-40 uppercase tracking-widest">Train your ears by sweeping through the bands</p>
            </div>

            <div className="p-10 bg-black/40 backdrop-blur-3xl rounded-[2.5rem] border border-white/5 space-y-8 shadow-2xl">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black opacity-20 uppercase tracking-[0.3em]">Current Peek</span>
                <span className="text-5xl font-black italic text-gradient">{Math.round(currentFreq)}<span className="text-xs ml-1 not-italic opacity-30">Hz</span></span>
              </div>
              <Slider 
                min={freqToLog(20)} 
                max={freqToLog(20000)} 
                step={0.01} 
                value={[freqToLog(currentFreq)]} 
                onValueChange={(v) => handleFrequencyChange([logToFreq(v[0])])}
                className="py-4"
              />
              <div className="flex justify-between text-[10px] font-black opacity-20 uppercase tracking-widest">
                <span>20 Hz</span>
                <span>1 kHz</span>
                <span>20 kHz</span>
              </div>
            </div>

            <Button 
              onClick={() => toggleNoise()}
              className={cn(
                "w-full h-20 rounded-[2rem] text-xl font-black uppercase italic transition-all active:scale-95 shadow-xl",
                isPlaying ? "bg-[#FF3D00] text-white shadow-[#FF3D00]/20" : "bg-white text-black shadow-white/10"
              )}
            >
              {isPlaying ? <><Pause className="mr-3 w-6 h-6" fill="currentColor" /> Stop Engine</> : <><Play className="mr-3 w-6 h-6" fill="currentColor" /> Play Pink Noise</>}
            </Button>
          </div>
        )}

        {mode === 'quiz' && (
          <div className="w-full max-w-2xl animate-in slide-in-from-bottom-8 duration-700">
            {quizStatus === 'IDLE' && (
              <div className="text-center space-y-8">
                <div className="w-28 h-28 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20">
                  <Headphones className="w-12 h-12 text-primary" />
                </div>
                <div>
                  <h2 className="text-5xl font-black uppercase italic tracking-tighter mb-2">Golden Ears Quiz</h2>
                  <p className="text-sm opacity-40 uppercase tracking-widest">6 Rounds of pure frequency identification</p>
                </div>
                <Button 
                  onClick={startQuizSession}
                  className="w-full h-20 bg-primary text-white text-2xl font-black uppercase italic rounded-3xl hover:scale-105 transition-all shadow-2xl shadow-primary/30"
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
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                   <div className="bg-white/5 px-4 py-2 rounded-full border border-white/5 text-[10px] font-black uppercase tracking-widest opacity-40">
                     Round {round} / {TOTAL_ROUNDS}
                   </div>
                   <Button 
                     variant="ghost" 
                     onClick={() => toggleNoise()}
                     className={cn("h-10 rounded-full px-6 text-[10px] font-black uppercase tracking-widest border border-white/10", isPlaying ? "bg-primary text-white" : "bg-white/5")}
                   >
                     {isPlaying ? "Pause Reference" : "Play Sound"}
                   </Button>
                </div>

                <div className="text-center">
                   <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-2">
                     Identify Target
                   </h2>
                   <p className="text-xs opacity-40 uppercase tracking-widest">Which frequency has the peak?</p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {FREQUENCY_STEPS.map(freq => {
                    const isCorrect = freq === targetFreq;
                    const isGuessed = freq === lastGuess;
                    
                    let btnClass = "bg-white/5 hover:bg-white/10 border-white/5";
                    if (quizStatus === 'FEEDBACK') {
                      if (isCorrect) btnClass = "bg-[#00E676] text-black border-[#00E676] scale-105 z-10 shadow-[0_0_30px_#00E67644]";
                      else if (isGuessed) btnClass = "bg-[#FF3D00] text-white border-[#FF3D00] opacity-100";
                      else btnClass = "opacity-20";
                    } else if (isGuessed) {
                      btnClass = "bg-primary border-primary text-white";
                    }

                    return (
                      <Button
                        key={freq}
                        disabled={quizStatus === 'FEEDBACK'}
                        onClick={() => handleGuess(freq)}
                        className={cn(
                          "h-24 rounded-2xl border text-xl font-black italic transition-all duration-300",
                          btnClass
                        )}
                      >
                        {freq >= 1000 ? `${freq/1000}k` : freq}
                      </Button>
                    );
                  })}
                </div>

                {quizStatus === 'FEEDBACK' && (
                  <div className="flex flex-col items-center gap-6 animate-in zoom-in-95 duration-300">
                    <div className={cn(
                      "flex items-center gap-3 px-8 py-4 rounded-full border-2 text-2xl font-black uppercase italic tracking-tighter",
                      lastGuess === targetFreq ? "border-[#00E676] text-[#00E676] bg-[#00E676]/5" : "border-[#FF3D00] text-[#FF3D00] bg-[#FF3D00]/5"
                    )}>
                      {lastGuess === targetFreq ? (
                        <><CheckCircle2 className="w-8 h-8" /> Match</>
                      ) : (
                        <><XCircle className="w-8 h-8" /> Miss</>
                      )}
                    </div>
                    <Button 
                      onClick={nextRound}
                      className="w-full h-16 bg-white text-black text-lg font-black uppercase italic rounded-2xl shadow-xl hover:scale-105 transition-all"
                    >
                      {round < TOTAL_ROUNDS ? "Next Round" : "View Results"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {quizStatus === 'RESULTS' && (
              <div className="text-center space-y-10 animate-in zoom-in-95">
                <div className="relative inline-block">
                  <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center border border-white/10 shadow-[0_0_60px_rgba(255,51,153,0.15)]">
                    <Trophy className={cn("w-16 h-16", sessionScores.filter(s => s === 100).length >= 4 ? "text-[#FFEA00]" : "text-white/20")} />
                  </div>
                  <Zap className="absolute -top-2 -right-2 w-10 h-10 text-[#FFEA00] animate-pulse" fill="currentColor" />
                </div>

                <div>
                  <h3 className="text-6xl font-black italic uppercase tracking-tighter mb-2">
                    {Math.round(sessionScores.reduce((a,b) => a+b, 0) / TOTAL_ROUNDS)}%
                  </h3>
                  <p className="text-[10px] uppercase font-black tracking-[0.5em] opacity-30">Session Accuracy</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-2">Weekly Average</p>
                    <p className="text-3xl font-black italic text-[#00E676]">{weeklyAverage}%</p>
                  </div>
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-2">Matches</p>
                    <p className="text-3xl font-black italic text-primary">{sessionScores.filter(s => s === 100).length} / {TOTAL_ROUNDS}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button onClick={startQuizSession} variant="outline" className="flex-1 h-16 rounded-2xl border-white/10 uppercase font-black italic text-lg hover:bg-white/5">New Quiz</Button>
                  <Link href="/" className="flex-1">
                    <Button className="w-full h-16 bg-white text-black rounded-2xl font-black uppercase italic text-lg shadow-xl">Finish</Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="p-8 shrink-0 flex justify-center opacity-20">
        <div className="flex items-center gap-3">
          <Headphones className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em]">Optimized for Studio Monitors</span>
        </div>
      </footer>
    </div>
  );
};
