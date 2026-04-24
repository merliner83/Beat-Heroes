
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Game, Level, TriggerPattern } from '@/lib/game/types';
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
  Music,
  Target
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, increment, setDoc, serverTimestamp, collection, query, where } from 'firebase/firestore';

const TOTAL_ROUNDS = 5;

const SOUND_MAPPING: Record<string, string> = {
  'kick': 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FKICK1.mp3?alt=media&token=23415b38-2c12-4462-bb74-385533ad1c57',
  'clap': 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FSHE_Clap_01.wav?alt=media&token=6d31cec5-6412-47af-a039-2d980d669929',
  'hats': 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FSHE_HiHat_03.wav?alt=media&token=a5e7b4ac-3af8-49ab-bb6b-557a6e3551bd',
  'clave': 'https://actions.google.com/sounds/v1/impacts/wood_block_impact.ogg'
};

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
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0); // 0-15
  const [countIn, setCountIn] = useState<number | null>(null);
  const [isPadPressed, setIsPadPressed] = useState(false);

  // Quiz State
  const [round, setRound] = useState(1);
  const [targetPatternId, setTargetPatternId] = useState<string | null>(null);
  const [lastGuess, setLastGuess] = useState<string | null>(null);
  const [sessionScores, setSessionScores] = useState<number[]>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const playheadRef = useRef(0);

  const bpm = game.bpm || 128;
  const stepTime = (60 / bpm) / 4 * 1000;

  const patternsQuery = useMemoFirebase(() => db ? query(collection(db, 'patterns')) : null, [db]);
  const { data: patterns } = useCollection<TriggerPattern>(patternsQuery);

  const selectedPattern = useMemo(() => patterns?.find(p => p.id === selectedPatternId), [patterns, selectedPatternId]);

  useEffect(() => {
    if (patterns && patterns.length > 0 && !selectedPatternId) {
      setSelectedPatternId(patterns[0].id);
    }
  }, [patterns, selectedPatternId]);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  const getSoundForPattern = (patternId: string) => {
    if (patternId.includes('kick')) return SOUND_MAPPING['kick'];
    if (patternId.includes('clap')) return SOUND_MAPPING['clap'];
    if (patternId.includes('hats')) return SOUND_MAPPING['hats'];
    return SOUND_MAPPING['clave'];
  };

  const handleTap = useCallback(() => {
    if (!audioEngine) return;
    const pId = mode === 'quiz' ? targetPatternId : selectedPatternId;
    const soundUrl = pId ? getSoundForPattern(pId) : SOUND_MAPPING['clave'];
    
    if (soundUrl) {
      audioEngine.playOneShot(soundUrl);
    }
    setIsPadPressed(true);
    setTimeout(() => setIsPadPressed(false), 100);
  }, [mode, targetPatternId, selectedPatternId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'a') {
        handleTap();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTap]);

  const startPlayback = async (pattern: TriggerPattern) => {
    if (!audioEngine) return;
    await audioEngine.resume();
    const soundUrl = getSoundForPattern(pattern.id);
    await audioEngine.preloadAudio([soundUrl, audioEngine.constructor.METRONOME_URL]);
    
    setIsPlaying(true);
    playheadRef.current = 0;
    setPlayhead(0);

    const tick = () => {
      const currentStep = playheadRef.current;
      setPlayhead(currentStep);

      if (currentStep % 4 === 0) {
        audioEngine.playOneShot(audioEngine.constructor.METRONOME_URL);
      }

      // We only play/show the first 16 steps (1 bar) for the Rhythm Master trainer
      if (pattern.steps.includes(currentStep)) {
        audioEngine.playOneShot(soundUrl);
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
    else if (selectedPattern) startPlayback(selectedPattern);
  };

  const startQuiz = async () => {
    setMode('quiz');
    setRound(1);
    setSessionScores([]);
    generateNewQuizTarget();
  };

  const generateNewQuizTarget = async () => {
    stopPlayback();
    if (!patterns || patterns.length === 0) return;
    const randomPattern = patterns[Math.floor(Math.random() * patterns.length)];
    setTargetPatternId(randomPattern.id);
    setLastGuess(null);
    setStatus('COUNT_IN');

    if (!audioEngine) return;
    await audioEngine.resume();
    
    await audioEngine.playCountIn(bpm, (beat) => setCountIn(5 - beat));
    setCountIn(null);
    
    setStatus('QUIZ_PLAYING');
    await playPatternOnce(randomPattern);
    setStatus('IDLE');
  };

  const playPatternOnce = (pattern: TriggerPattern): Promise<void> => {
    return new Promise((resolve) => {
      let step = 0;
      const soundUrl = getSoundForPattern(pattern.id);
      const tick = () => {
        if (step % 4 === 0) {
          audioEngine?.playOneShot(audioEngine.constructor.METRONOME_URL);
        }
        // Only first 16 steps
        if (pattern.steps.includes(step)) {
          audioEngine?.playOneShot(soundUrl);
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
        
        {mode === 'quiz' && status !== 'RESULTS' && status !== 'IDLE' && (
           <div className="hidden sm:flex items-center gap-3 bg-white/5 px-6 py-2 rounded-full border border-white/10">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40 italic">Round</span>
              <span className="text-lg font-black italic text-primary">{round} / {TOTAL_ROUNDS}</span>
           </div>
        )}

        <div className="hidden sm:flex items-center gap-3 opacity-30 text-[10px] md:text-xs font-black uppercase tracking-widest">
           <Music className="w-4 h-4 text-primary" />
           Sync Active
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start p-6 md:p-12 relative overflow-y-auto">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#FF3399 1.5px, transparent 1.5px)', backgroundSize: '40px 40px' }} />

        {/* Mode Toggle */}
        {status === 'IDLE' && !lastGuess && sessionScores.length === 0 && (
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
            {/* Visualizer Header */}
            <div className="text-center">
              <h2 className="text-4xl md:text-7xl font-black uppercase italic tracking-tighter mb-6 text-gradient">
                {isPlaying ? 'PLAYING...' : 'PREVIEW'}
              </h2>
              <div className="flex gap-2 justify-center max-w-md mx-auto mb-12">
                {Array.from({ length: 16 }).map((_, i) => {
                  const isStep = selectedPattern?.steps.includes(i);
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

            {/* Central Tap Pad */}
            <div className="flex justify-center mb-8">
              <Button
                onPointerDown={handleTap}
                className={cn(
                  "w-48 h-48 md:w-64 md:h-64 rounded-[2.5rem] border-4 flex flex-col items-center justify-center transition-all duration-75 select-none touch-none bg-black/40",
                  isPadPressed ? "scale-90 border-primary shadow-[0_0_50px_rgba(255,51,153,0.5)] brightness-125" : "border-white/10 hover:border-white/20"
                )}
              >
                <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 mb-2">Trigger [A]</div>
                <Music className={cn("w-12 h-12 mb-4 transition-colors", isPadPressed ? "text-primary" : "text-white/20")} />
                <span className="text-xs font-black uppercase italic tracking-widest opacity-40">Tap Pad</span>
              </Button>
            </div>

            {/* Pattern Selection Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {patterns?.map(p => (
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

            {(status === 'COUNT_IN' || status === 'QUIZ_PLAYING' || status === 'IDLE' || status === 'FEEDBACK') && targetPatternId && (
              <div className="space-y-12 pt-8 animate-in fade-in">
                {/* Visualizer Header */}
                <div className="text-center">
                   <h2 className="text-4xl md:text-7xl font-black uppercase italic tracking-tighter mb-6 text-gradient">
                     {status === 'COUNT_IN' ? countIn : status === 'QUIZ_PLAYING' ? 'SCANNING...' : 'IDENTIFY'}
                   </h2>
                   <div className="flex gap-2 justify-center max-w-md mx-auto mb-12">
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

                {/* Central Tap Pad in Quiz */}
                <div className="flex justify-center mb-10">
                  <Button
                    onPointerDown={handleTap}
                    className={cn(
                      "w-48 h-48 md:w-56 md:h-56 rounded-[2.5rem] border-4 flex flex-col items-center justify-center transition-all duration-75 select-none touch-none bg-black/40",
                      isPadPressed ? "scale-90 border-primary shadow-[0_0_40px_rgba(255,51,153,0.4)] brightness-125" : "border-white/5 hover:border-white/10"
                    )}
                  >
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-20 mb-2">Trigger [A]</div>
                    <Target className={cn("w-10 h-10 mb-4 transition-colors", isPadPressed ? "text-primary" : "text-white/10")} />
                    <span className="text-[10px] font-black uppercase italic tracking-widest opacity-20">Tap to test</span>
                  </Button>
                </div>

                {status === 'IDLE' && !lastGuess && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-bottom-4 duration-500">
                    {patterns?.map(p => (
                      <Button
                        key={p.id}
                        onClick={() => handleGuess(p.id)}
                        className="h-20 rounded-2xl bg-white/5 border-2 border-white/5 hover:border-primary/50 font-black uppercase italic tracking-widest transition-all text-sm"
                      >
                        {p.name}
                      </Button>
                    ))}
                  </div>
                )}

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
