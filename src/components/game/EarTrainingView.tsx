
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Game, Level } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ArrowLeft, Play, Pause, RefreshCw, Trophy, Zap, Info, Headphones, Activity } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore } from '@/firebase';
import { doc, increment, setDoc, serverTimestamp } from 'firebase/firestore';

const FREQUENCY_STEPS = [
  63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000
];

interface EarTrainingViewProps {
  game: Game;
  level: Level;
}

export const EarTrainingView: React.FC<EarTrainingViewProps> = ({ game, level }) => {
  const db = useFirestore();
  const { user } = useUser();

  const [mode, setMode] = useState<'explore' | 'quiz'>('explore');
  const [isPlaying, setIsPlaying] = useState(false);
  const [targetFreq, setTargetFreq] = useState(1000);
  const [currentFreq, setCurrentFreq] = useState(1000);
  const [guessFreq, setGuessFreq] = useState(1000);
  const [isFinished, setIsFinished] = useState(false);
  const [feedback, setFeedback] = useState<{ score: number, deviation: number } | null>(null);

  useEffect(() => {
    return () => {
      audioEngine?.stop();
    };
  }, []);

  const toggleNoise = async () => {
    if (!audioEngine) return;
    if (isPlaying) {
      audioEngine.stopNoise();
      setIsPlaying(false);
    } else {
      const initialFreq = mode === 'quiz' ? targetFreq : currentFreq;
      await audioEngine.startNoise(initialFreq, mode === 'quiz' ? 2 : 1, 'peaking');
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

  const startNewQuiz = async () => {
    const randomFreq = FREQUENCY_STEPS[Math.floor(Math.random() * FREQUENCY_STEPS.length)];
    setTargetFreq(randomFreq);
    setMode('quiz');
    setIsPlaying(false);
    setIsFinished(false);
    setFeedback(null);
    setGuessFreq(1000);
  };

  const submitGuess = () => {
    audioEngine?.stopNoise();
    setIsPlaying(false);
    
    // Calculate log deviation (octaves)
    const deviation = Math.abs(Math.log2(guessFreq / targetFreq));
    const score = Math.max(0, Math.round(100 * (1 - deviation)));
    
    setFeedback({ score, deviation });
    setIsFinished(true);

    if (score >= 80 && user && db) {
      setDoc(doc(db, 'users', user.uid, 'progress', level.id), { 
        levelId: level.id, 
        accuracy: score, 
        completedAt: serverTimestamp() 
      }, { merge: true });
      setDoc(doc(db, 'users', user.uid), { streetCred: increment(250) }, { merge: true });
    }
  };

  // Convert linear slider value to log frequency for explore
  const logToFreq = (val: number) => Math.pow(10, val);
  const freqToLog = (freq: number) => Math.log10(freq);

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-4 font-body overflow-hidden">
      <header className="flex justify-between items-center h-16 shrink-0 z-50 px-4 md:px-8">
        <div className="flex items-center gap-4">
          <Link href="/">
            <ArrowLeft className="w-5 h-5 text-white/40 hover:text-white" />
          </Link>
          <div>
            <h1 className="text-sm font-black uppercase italic tracking-tighter text-gradient">Ear Training</h1>
            <p className="text-[10px] opacity-30 uppercase font-black tracking-widest">Golden Ears Lab</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => { setMode('explore'); setIsFinished(false); setFeedback(null); }}
            className={cn("rounded-full px-6 text-[10px] font-black uppercase tracking-widest", mode === 'explore' ? "bg-white/10 text-white" : "text-white/30")}
          >
            Explore
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={startNewQuiz}
            className={cn("rounded-full px-6 text-[10px] font-black uppercase tracking-widest", mode === 'quiz' ? "bg-primary text-white" : "text-white/30")}
          >
            Quiz
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#FF3399 1.5px, transparent 1.5px)', backgroundSize: '40px 40px' }} />

        {mode === 'explore' ? (
          <div className="w-full max-w-2xl space-y-12 animate-in fade-in zoom-in-95 duration-700">
            <div className="text-center">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10 shadow-[0_0_50px_rgba(255,255,255,0.05)]">
                <Activity className={cn("w-10 h-10 transition-all", isPlaying ? "text-[#00E676] scale-110" : "text-white/20")} />
              </div>
              <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-2">Frequency Scanner</h2>
              <p className="text-xs opacity-40 uppercase tracking-widest">Move the slider to identify the filter peak</p>
            </div>

            <div className="p-10 bg-black/40 backdrop-blur-3xl rounded-[2.5rem] border border-white/5 space-y-8">
              <div className="flex justify-between items-end mb-4">
                <span className="text-[10px] font-black opacity-20 uppercase tracking-[0.3em]">Spectrum</span>
                <span className="text-4xl font-black italic text-gradient">{Math.round(currentFreq)}<span className="text-xs ml-1 not-italic opacity-30">Hz</span></span>
              </div>
              <Slider 
                min={freqToLog(20)} 
                max={freqToLog(20000)} 
                step={0.01} 
                value={[freqToLog(currentFreq)]} 
                onValueChange={(v) => handleFrequencyChange([logToFreq(v[0])])}
                className="py-4"
              />
              <div className="flex justify-between text-[9px] font-black opacity-20 uppercase tracking-widest">
                <span>20 Hz</span>
                <span>1 kHz</span>
                <span>20 kHz</span>
              </div>
            </div>

            <Button 
              onClick={toggleNoise}
              className={cn(
                "w-full h-20 rounded-[2rem] text-xl font-black uppercase italic transition-all active:scale-95",
                isPlaying ? "bg-[#FF3D00] text-white" : "bg-white text-black"
              )}
            >
              {isPlaying ? <><Pause className="mr-3 w-6 h-6" fill="currentColor" /> Stop Noise</> : <><Play className="mr-3 w-6 h-6" fill="currentColor" /> Play Pink Noise</>}
            </Button>
          </div>
        ) : (
          <div className="w-full max-w-2xl space-y-8 animate-in slide-in-from-bottom-8 duration-700">
            {!isFinished ? (
              <>
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-4">
                    <Zap className="w-3 h-3 text-primary" fill="currentColor" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">Frequency ID Quiz</span>
                  </div>
                  <h2 className="text-4xl font-black uppercase italic tracking-tighter">Listen Closely</h2>
                  <p className="text-xs opacity-40 max-w-sm mx-auto leading-relaxed">A band-pass filter has been applied to the pink noise. Where is the center frequency?</p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {FREQUENCY_STEPS.map(freq => (
                    <Button
                      key={freq}
                      variant="outline"
                      onClick={() => setGuessFreq(freq)}
                      className={cn(
                        "h-20 rounded-2xl border-white/5 text-lg font-black italic transition-all",
                        guessFreq === freq ? "bg-primary border-primary text-white scale-105 shadow-xl shadow-primary/20" : "bg-white/5 hover:bg-white/10"
                      )}
                    >
                      {freq >= 1000 ? `${freq/1000}k` : freq}
                    </Button>
                  ))}
                </div>

                <div className="flex gap-4">
                  <Button 
                    onClick={toggleNoise}
                    variant="outline"
                    className="flex-1 h-16 rounded-2xl border-white/10 uppercase font-black tracking-widest"
                  >
                    {isPlaying ? "Pause" : "Play Reference"}
                  </Button>
                  <Button 
                    onClick={submitGuess}
                    className="flex-[2] h-16 bg-white text-black rounded-2xl font-black uppercase italic tracking-tighter text-xl active:scale-95"
                  >
                    Submit Guess
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center space-y-8 animate-in zoom-in-95">
                <div className="relative inline-block">
                  <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                    <Trophy className={cn("w-16 h-16", feedback!.score >= 80 ? "text-[#FFEA00]" : "text-white/20")} />
                  </div>
                  {feedback!.score >= 80 && <Zap className="absolute -top-2 -right-2 w-8 h-8 text-[#FFEA00] animate-pulse" fill="currentColor" />}
                </div>

                <div>
                  <h3 className="text-5xl font-black italic uppercase tracking-tighter mb-2">{feedback!.score}% <span className="text-xl not-italic opacity-30">Accuracy</span></h3>
                  <p className="text-xs uppercase font-black tracking-[0.3em] opacity-40">
                    {feedback!.deviation < 0.2 ? "Perfect Pitch!" : feedback!.deviation < 1 ? "In the range" : "Way off track"}
                  </p>
                </div>

                <div className="p-8 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-30">
                    <span>Target: {targetFreq} Hz</span>
                    <span>Your Guess: {guessFreq} Hz</span>
                  </div>
                  <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-primary transition-all duration-1000" style={{ width: `${feedback!.score}%` }} />
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button onClick={startNewQuiz} variant="outline" className="flex-1 h-16 rounded-2xl uppercase font-black italic">Next Round</Button>
                  <Link href="/" className="flex-1">
                    <Button className="w-full h-16 bg-white text-black rounded-2xl font-black uppercase italic">Finish</Button>
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
