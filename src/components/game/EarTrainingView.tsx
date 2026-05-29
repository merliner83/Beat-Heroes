
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Game, Level, LevelProgress, getAccuracyColor } from '@/lib/game/types';
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
import { doc, increment, setDoc, serverTimestamp, collection, query, where, getDoc } from 'firebase/firestore';

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
    return query(collection(db, 'users', user.uid, 'progress'), where('levelId', '==', level.id));
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

  useEffect(() => { return () => { audioEngine?.stop(); }; }, []);

  const toggleNoise = async (freqOverride?: number) => {
    if (!audioEngine) return;
    if (isPlaying) {
      audioEngine.stopNoise();
      setIsPlaying(false);
    } else {
      const freq = freqOverride !== undefined ? freqOverride : (mode === 'quiz' ? targetFreq : currentFreq);
      const config = FREQUENCY_CONFIG.find(c => c.freq === freq);
      await audioEngine.startNoise(freq, config?.q || 1, 'peaking');
      setIsPlaying(true);
    }
  };

  const handleFrequencyChange = (val: number[]) => {
    const freq = FREQUENCY_STEPS[val[0]];
    const config = FREQUENCY_CONFIG.find(c => c.freq === freq);
    setCurrentFreq(freq);
    if (mode === 'explore' && isPlaying) audioEngine?.updateFilter(freq, config?.q || 1);
  };

  const startQuizSession = () => { setMode('quiz'); setQuizStatus('PLAYING'); setRound(1); setSessionScores([]); generateNewTarget(); };
  const cancelQuiz = () => { setQuizStatus('IDLE'); setMode('explore'); audioEngine?.stopNoise(); setIsPlaying(false); };

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
    setSessionScores(prev => [...prev, isMatch ? 100 : 0]);
    setQuizStatus('FEEDBACK');
  };

  const nextRound = () => { if (round < TOTAL_ROUNDS) { setRound(r => r + 1); generateNewTarget(); } else { finishQuiz(); } };

  const finishQuiz = async () => {
    const avgScore = Math.round(sessionScores.reduce((a, b) => a + b, 0) / TOTAL_ROUNDS);
    setQuizStatus('RESULTS');
    if (user && db) {
      const progRef = doc(db, 'users', user.uid, 'progress', level.id);
      const snap = await getDoc(progRef);
      const oldAcc = snap.exists() ? snap.data().accuracy : 0;
      
      if (avgScore > oldAcc) {
        await setDoc(progRef, { levelId: level.id, accuracy: avgScore, completedAt: serverTimestamp() }, { merge: true });
        const deltaAcc = avgScore - oldAcc;
        const deltaSC = Math.round((deltaAcc / 100) * (game.maxPoints || 1000));
        await setDoc(doc(db, 'users', user.uid), { streetCred: increment(deltaSC) }, { merge: true });
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-4 font-body overflow-hidden">
      <header className="flex justify-between items-center h-20 shrink-0 z-50 px-6 bg-black/40 backdrop-blur-xl border-b border-white/5 rounded-t-3xl">
        <div className="flex items-center gap-4">
          <Link href="/"><ArrowLeft className="w-6 h-6 text-white/40 hover:text-white transition-all hover:scale-110" /></Link>
          <div className="pr-12">
            <h1 className="text-lg md:text-xl font-black uppercase italic tracking-tighter text-gradient whitespace-nowrap">EAR TRAINING</h1>
            <p className="text-[10px] opacity-30 uppercase font-black tracking-[0.2em] mt-1">Master the Spectrum</p>
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-start p-6 relative overflow-y-auto">
        {(quizStatus === 'IDLE' || mode === 'explore') && (
          <div className="relative z-50 animate-in fade-in slide-in-from-top-4 duration-500 mb-10">
            <div className="inline-flex p-1.5 bg-white/5 rounded-xl border border-white/5 backdrop-blur-xl shadow-2xl">
              <Button variant="ghost" onClick={() => { setMode('explore'); setQuizStatus('IDLE'); }} className={cn("rounded-lg px-8 py-6 text-base font-black uppercase tracking-widest", mode === 'explore' ? "bg-white/10 text-white" : "text-white/20")}>Explore</Button>
              <Button variant="ghost" onClick={() => { setMode('quiz'); if(quizStatus === 'RESULTS' || quizStatus === 'IDLE') setQuizStatus('IDLE'); }} className={cn("rounded-lg px-8 py-6 text-base font-black uppercase tracking-widest", mode === 'quiz' ? "bg-primary text-white" : "text-white/20")}>Quiz Mode</Button>
            </div>
          </div>
        )}
        {mode === 'explore' && (
          <div className="w-full max-w-2xl space-y-16 animate-in zoom-in-95 duration-700">
            <div className="gemini-border-primary">
              <div className="p-10 bg-black/60 backdrop-blur-3xl space-y-8 rounded-xl border border-white/5">
                <div className="flex flex-col items-center">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl md:text-6xl font-black italic text-gradient">{currentFreq >= 1000 ? currentFreq / 1000 : currentFreq}</span>
                    <span className="text-lg font-black opacity-20 uppercase tracking-[0.4em]">{currentFreq >= 1000 ? "KHZ" : "HZ"}</span>
                  </div>
                  <span className="text-sm font-black opacity-40 uppercase tracking-widest mt-2">{FREQUENCY_CONFIG.find(c => c.freq === currentFreq)?.label}</span>
                </div>
                <Slider min={0} max={FREQUENCY_STEPS.length - 1} step={1} value={[FREQUENCY_STEPS.indexOf(currentFreq)]} onValueChange={handleFrequencyChange} className="py-8" />
              </div>
            </div>
            <Button onClick={() => toggleNoise()} className={cn("w-full h-20 rounded-2xl text-xl font-black uppercase italic shadow-xl", isPlaying ? "bg-[#FF3D00] text-white" : "bg-white text-black")}>
              {isPlaying ? <><Pause className="mr-4 w-7 h-7" fill="currentColor" /> Stop Engine</> : <><Play className="mr-4 w-7 h-7" fill="currentColor" /> Play Noise</>}
            </Button>
          </div>
        )}
        {mode === 'quiz' && (
          <div className="w-full max-w-3xl animate-in slide-in-from-bottom-8 duration-700">
            {quizStatus === 'IDLE' && (
              <div className="text-center space-y-10 mt-6">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20"><Headphones className="w-10 h-10 text-primary" /></div>
                <div><h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter mb-3">EAR TRAINING</h2><p className="text-[11px] opacity-40 uppercase tracking-[0.3em]">6 Rounds frequency identification</p></div>
                <Button onClick={startQuizSession} className="w-full h-20 md:h-32 bg-primary text-white text-xl md:text-3xl font-black uppercase italic rounded-2xl shadow-2xl">Start Quiz</Button>
                {weeklyAverage > 0 && <div className="flex items-center justify-center gap-3 text-sm opacity-30 font-black uppercase tracking-widest pt-4"><BarChart3 className="w-5 h-5" /> Weekly Average: <span style={{ color: getAccuracyColor(weeklyAverage) }}>{weeklyAverage}%</span></div>}
              </div>
            )}
            {(quizStatus === 'PLAYING' || quizStatus === 'FEEDBACK') && (
              <div className="space-y-8 pt-10">
                <div className="flex justify-between items-center bg-white/5 px-6 py-4 rounded-xl border border-white/5">
                   <div className="text-[10px] font-black uppercase tracking-widest opacity-40">Round {round} / {TOTAL_ROUNDS}</div>
                   <Button variant="ghost" onClick={() => toggleNoise()} className={cn("h-10 rounded-lg px-6 text-[9px] font-black uppercase tracking-widest border", isPlaying ? "bg-primary text-white border-primary" : "bg-white/5 border-white/10")}>{isPlaying ? "Pause" : "Play Sound"}</Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {FREQUENCY_STEPS.map(freq => (
                    <Button key={freq} disabled={quizStatus === 'FEEDBACK'} onClick={() => handleGuess(freq)} className={cn("w-full h-16 rounded-lg border flex flex-col items-center justify-center transition-all", quizStatus === 'FEEDBACK' ? (freq === targetFreq ? "bg-[#00E676] text-black shadow-lg" : freq === lastGuess ? "bg-[#FF3D00] text-white" : "opacity-10 bg-transparent") : "bg-white/5 border-white/10")}>
                      <span className="text-base font-black italic">{freq >= 1000 ? freq / 1000 : freq}</span>
                      <span className="text-[8px] font-black opacity-50 uppercase">{freq >= 1000 ? "KHZ" : "HZ"}</span>
                    </Button>
                  ))}
                </div>
                {quizStatus === 'FEEDBACK' && <Button onClick={nextRound} className="w-full h-16 bg-white text-black text-lg font-black uppercase italic rounded-xl shadow-xl">Next Round</Button>}
              </div>
            )}
            {quizStatus === 'RESULTS' && (
              <div className="text-center space-y-12 animate-in zoom-in-95 mt-6">
                <Trophy className="w-20 h-20 mx-auto text-[#FFEA00]" />
                <h3 className="text-6xl font-black italic uppercase tracking-tighter" style={{ color: getAccuracyColor(Math.round(sessionScores.reduce((a,b) => a+b, 0) / TOTAL_ROUNDS)) }}>{Math.round(sessionScores.reduce((a,b) => a+b, 0) / TOTAL_ROUNDS)}%</h3>
                <div className="flex gap-4"><Button onClick={startQuizSession} variant="outline" className="flex-1 h-16 rounded-xl uppercase font-black italic">New Quiz</Button><Link href="/" className="flex-1"><Button className="w-full h-16 bg-white text-black rounded-xl font-black uppercase italic shadow-xl">Finish</Button></Link></div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
