
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Game, Level, TriggerPattern, PatternProgress } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Trophy, 
  Zap, 
  Activity, 
  CheckCircle2, 
  XCircle,
  Music,
  Target,
  Brain,
  Volume2
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, increment, setDoc, serverTimestamp, collection, query } from 'firebase/firestore';

const SOUND_MAPPING: Record<string, string> = {
  'kick': 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FKICK1.mp3?alt=media&token=23415b38-2c12-4462-bb74-385533ad1c57',
  'clave': 'https://actions.google.com/sounds/v1/impacts/wood_block_impact.ogg'
};

interface RhythmTrainerViewProps {
  game: Game;
  level: Level;
}

type ViewStatus = 'IDLE' | 'COUNT_IN' | 'QUIZ_PLAYING' | 'FEEDBACK' | 'RESULTS';

export const RhythmTrainerView: React.FC<RhythmTrainerViewProps> = ({ game, level }) => {
  const db = useFirestore();
  const { user } = useUser();

  const [mode, setMode] = useState<'explore' | 'quiz'>('explore');
  const [status, setStatus] = useState<ViewStatus>('IDLE');
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0); 
  const [countIn, setCountIn] = useState<number | null>(null);
  const [isPadPressed, setIsPadPressed] = useState(false);
  
  const [userTaps, setUserTaps] = useState<{ step: number, offset: number }[]>([]);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const playheadRef = useRef(0);

  const bpm = 120; 
  const stepTime = (60 / bpm) / 4 * 1000;

  const patternsQuery = useMemoFirebase(() => db ? query(collection(db, 'patterns')) : null, [db]);
  const { data: patterns } = useCollection<TriggerPattern>(patternsQuery);

  const progressQuery = useMemoFirebase(() => user && db ? query(collection(db, 'users', user.uid, 'patternProgress')) : null, [user, db]);
  const { data: patternProgress } = useCollection<PatternProgress>(progressQuery);

  const selectedPattern = useMemo(() => patterns?.find(p => p.id === selectedPatternId), [patterns, selectedPatternId]);

  useEffect(() => {
    if (patterns && patterns.length > 0 && !selectedPatternId) {
      setSelectedPatternId(patterns[0].id);
    }
  }, [patterns, selectedPatternId]);

  useEffect(() => {
    return () => stopPlayback();
  }, []);

  const getSoundForPattern = (patternId: string) => {
    return patternId.toLowerCase().includes('kick') ? SOUND_MAPPING['kick'] : SOUND_MAPPING['clave'];
  };

  const handleTap = useCallback(() => {
    if (!audioEngine) return;
    const soundUrl = selectedPattern ? getSoundForPattern(selectedPattern.id) : SOUND_MAPPING['clave'];
    audioEngine.playOneShot(soundUrl);
    
    setIsPadPressed(true);
    setTimeout(() => setIsPadPressed(false), 80);

    if (status === 'QUIZ_PLAYING') {
      const currentTime = audioEngine.getContextTime();
      const startTime = (audioEngine as any).startTime || 0;
      const elapsed = (currentTime - startTime) * 1000;
      const currentStep = elapsed / stepTime;
      setUserTaps(prev => [...prev, { step: Math.round(currentStep), offset: currentStep % 1 }]);
    }
  }, [selectedPattern, status, stepTime]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'a') handleTap();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTap]);

  const startPlayback = async (pattern: TriggerPattern) => {
    if (!audioEngine) return;
    await audioEngine.resume();
    const soundUrl = getSoundForPattern(pattern.id);
    await audioEngine.preloadAudio([soundUrl, (audioEngine as any).constructor.METRONOME_URL]);
    
    setIsPlaying(true);
    playheadRef.current = 0;
    const tick = () => {
      const currentStep = playheadRef.current;
      setPlayhead(currentStep);
      if (currentStep % 4 === 0) audioEngine.playOneShot((audioEngine as any).constructor.METRONOME_URL);
      if (pattern.steps.includes(currentStep % 16)) audioEngine.playOneShot(soundUrl);
      playheadRef.current = (currentStep + 1);
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

  const startPerformanceQuiz = async () => {
    if (!selectedPattern || !audioEngine) return;
    setMode('quiz');
    setStatus('COUNT_IN');
    setUserTaps([]);
    setFinalScore(null);
    stopPlayback();

    await audioEngine.resume();
    const startTime = audioEngine.getContextTime() + (4 * (60/bpm));
    (audioEngine as any).startTime = startTime;

    await audioEngine.playCountIn(bpm, (beat) => setCountIn(5 - beat));
    setCountIn(null);
    setStatus('QUIZ_PLAYING');

    let step = 0;
    const tick = () => {
      if (step % 4 === 0) audioEngine.playOneShot((audioEngine as any).constructor.METRONOME_URL);
      setPlayhead(step);
      step++;
      if (step < 16) {
        setTimeout(tick, stepTime);
      } else {
        finishPerformanceQuiz();
      }
    };
    tick();
  };

  const finishPerformanceQuiz = () => {
    if (!selectedPattern) return;
    setStatus('RESULTS');
    
    const targetSteps = selectedPattern.steps.filter(s => s < 16);
    let hits = 0;
    const matchedUserTaps = new Set();

    targetSteps.forEach(target => {
      const match = userTaps.find((tap, idx) => !matchedUserTaps.has(idx) && Math.abs(tap.step - target) <= 1);
      if (match) {
        hits++;
        matchedUserTaps.add(userTaps.indexOf(match));
      }
    });

    const accuracy = Math.round((hits / Math.max(targetSteps.length, userTaps.length)) * 100) || 0;
    setFinalScore(accuracy);

    if (user && db) {
      setDoc(doc(db, 'users', user.uid, 'patternProgress', selectedPattern.id), { 
        patternId: selectedPattern.id, 
        accuracy, 
        completedAt: serverTimestamp() 
      }, { merge: true });
      setDoc(doc(db, 'users', user.uid), { streetCred: increment(accuracy * 2) }, { merge: true });
    }
  };

  const getMastery = (patternId: string) => {
    return patternProgress?.find(p => p.patternId === patternId)?.accuracy || 0;
  };

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-4 font-body overflow-hidden selection:bg-primary">
      <header className="flex justify-between items-center h-20 shrink-0 z-50 px-6 bg-black/40 backdrop-blur-xl border-b border-white/5 rounded-t-3xl">
        <div className="flex items-center gap-4">
          <Link href="/">
            <ArrowLeft className="w-6 h-6 text-white/40 hover:text-white transition-all hover:scale-110" />
          </Link>
          <div>
            <h1 className="text-xl font-black uppercase italic tracking-tighter text-gradient leading-none">RHYTHM MASTER</h1>
            <p className="text-[10px] opacity-30 uppercase font-black tracking-[0.2em] mt-1">MIDI Lab Interface</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-3 opacity-30 text-[10px] font-black uppercase tracking-widest">
           <Music className="w-4 h-4 text-primary" /> Sync Active
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start p-6 md:p-12 relative overflow-y-auto">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#FF3399 1.5px, transparent 1.5px)', backgroundSize: '40px 40px' }} />

        {mode === 'explore' && (
          <div className="w-full max-w-4xl space-y-12 animate-in zoom-in-95 duration-500">
            <div className="text-center">
              <h2 className="text-4xl md:text-7xl font-black uppercase italic tracking-tighter mb-6 text-gradient">
                RHYTHM MASTER
              </h2>
              <div className="flex gap-2 justify-center max-w-md mx-auto mb-12">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className={cn(
                    "h-1.5 rounded-full transition-all flex-1",
                    playhead % 16 === i && isPlaying ? "bg-primary scale-y-[3] shadow-[0_0_20px_#FF3399]" : "bg-white/10",
                    !isPlaying && selectedPattern?.steps.includes(i) && "bg-primary/40"
                  )} />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {patterns?.map(p => {
                const mastery = getMastery(p.id);
                return (
                  <div key={p.id} className="gemini-border group">
                    <div className="p-6 bg-black/60 rounded-xl flex flex-col gap-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xl font-black uppercase italic tracking-tighter group-hover:text-primary transition-colors">{p.name}</h4>
                        <div className="text-[10px] font-black uppercase tracking-widest text-[#00E676]">{mastery}% Mastery</div>
                      </div>
                      <Progress value={mastery} className="h-1.5 bg-white/5" />
                      <div className="flex gap-3">
                        <Button 
                          variant="ghost" 
                          onClick={() => { setSelectedPatternId(p.id); if(isPlaying) stopPlayback(); startPlayback(p); }}
                          className="flex-1 bg-white/5 h-12 text-[10px] font-black uppercase tracking-widest"
                        >
                          Listen
                        </Button>
                        <Button 
                          onClick={() => { setSelectedPatternId(p.id); startPerformanceQuiz(); }}
                          className="flex-1 bg-primary text-white h-12 text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(255,51,153,0.2)]"
                        >
                          Start Quiz
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button onClick={toggleExplore} className="w-full h-24 rounded-3xl text-2xl font-black uppercase italic transition-all active:scale-95 bg-white text-black">
              {isPlaying ? <Pause className="mr-4 w-10 h-10" /> : <Play className="mr-4 w-10 h-10" />}
              {isPlaying ? "Deactivate Pulse" : "Preview Selected"}
            </Button>
          </div>
        )}

        {mode === 'quiz' && (
          <div className="w-full max-w-2xl text-center space-y-12 pt-10 animate-in slide-in-from-bottom-8">
            <h2 className="text-5xl md:text-8xl font-black uppercase italic tracking-tighter text-gradient">
              {status === 'COUNT_IN' ? countIn : status === 'QUIZ_PLAYING' ? 'RECORDING...' : 'FINISHED'}
            </h2>

            <div className="flex gap-2 justify-center max-w-md mx-auto">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className={cn(
                  "h-1.5 rounded-full transition-all flex-1",
                  playhead === i ? "bg-primary scale-y-150" : "bg-white/10"
                )} />
              ))}
            </div>

            <div className="flex justify-center">
              <Button
                onPointerDown={handleTap}
                disabled={status !== 'QUIZ_PLAYING' && status !== 'COUNT_IN'}
                className={cn(
                  "w-56 h-56 md:w-64 md:h-64 rounded-[2.5rem] border-4 flex flex-col items-center justify-center transition-all select-none touch-none bg-black/40",
                  isPadPressed ? "scale-90 border-primary shadow-[0_0_50px_rgba(255,51,153,0.5)]" : "border-white/10 hover:border-white/20"
                )}
              >
                <Target className={cn("w-12 h-12 mb-4", isPadPressed ? "text-primary" : "text-white/20")} />
                <span className="text-xs font-black uppercase italic tracking-widest opacity-40">Tap Rhythm</span>
              </Button>
            </div>

            {status === 'RESULTS' && (
              <div className="space-y-10 animate-in zoom-in-95">
                <div className="text-7xl font-black italic text-gradient">{finalScore}% Sync</div>
                <div className="flex gap-4">
                  <Button onClick={startPerformanceQuiz} variant="outline" className="flex-1 h-20 rounded-2xl font-black uppercase italic border-white/10">Retry</Button>
                  <Button onClick={() => setMode('explore')} className="flex-1 h-20 bg-white text-black rounded-2xl font-black uppercase italic">Dashboard</Button>
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
