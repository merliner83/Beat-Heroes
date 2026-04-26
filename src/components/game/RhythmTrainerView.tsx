
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Game, Level, TriggerPattern, PatternProgress, getAccuracyColor } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  Play, 
  Square,
  Trophy, 
  Zap, 
  Target, 
  Brain,
  Volume2,
  X,
  Music
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, increment, setDoc, serverTimestamp, collection, query } from 'firebase/firestore';

const SOUND_MAPPING: Record<string, string> = {
  'kick': 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FKICK1.mp3?alt=media&token=23415b38-2c12-4462-bb74-385533ad1c57',
  'clave': 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FClaves.mp3?alt=media&token=1162b3f6-19d7-4a41-a3b6-9c243cd5d36a'
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
  const [tapFeedback, setTapFeedback] = useState<'hit' | 'active' | null>(null);
  
  const [userTaps, setUserTaps] = useState<{ step: number }[]>([]);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  const schedulerRef = useRef<number | null>(null);
  const playheadRef = useRef(0);
  const startTimeRef = useRef<number>(0);
  const frameRef = useRef<number>(null);

  const bpm = 120; 
  const beatTime = 60 / bpm;
  const stepTime = beatTime / 4; // 16th note
  const QUIZ_STEPS = 64; 

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

  const getSoundForPattern = (pattern: TriggerPattern) => {
    return pattern.sampleUrl || SOUND_MAPPING['clave'];
  };

  const handleTap = useCallback(() => {
    if (!audioEngine || !selectedPattern) return;
    
    const soundUrl = getSoundForPattern(selectedPattern);
    audioEngine.playOneShot(soundUrl);

    const currentTime = audioEngine.getContextTime();
    if (startTimeRef.current === 0) {
      setTapFeedback('active');
      setTimeout(() => setTapFeedback(null), 100);
      return;
    }

    const elapsed = currentTime - startTimeRef.current;
    const currentStepRaw = elapsed / stepTime;
    const tolerance = 0.5; 
    
    let isHit = false;
    const targetSteps = selectedPattern.steps;
    const currentPos = (status === 'QUIZ_PLAYING' || isPlaying) ? currentStepRaw : 0;
    
    // Check hit against pattern steps
    isHit = targetSteps.some(s => {
      const diff = Math.abs(s - (isPlaying ? (currentPos % 128) : currentPos));
      if (isPlaying) {
        // Handle wrap-around for loop
        const wrap1 = Math.abs(s - ((currentPos % 128) - 128));
        const wrap2 = Math.abs((s - 128) - (currentPos % 128));
        return diff <= tolerance || wrap1 <= tolerance || wrap2 <= tolerance;
      }
      return diff <= tolerance;
    });

    if (isHit) {
      setTapFeedback('hit');
      if (status === 'QUIZ_PLAYING') {
        setUserTaps(prev => [...prev, { step: currentStepRaw }]);
      }
    } else {
      setTapFeedback('active');
    }
    
    setTimeout(() => setTapFeedback(null), 100);
  }, [selectedPattern, status, isPlaying, stepTime]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'a' && !e.repeat) {
        handleTap();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTap]);

  const scheduleNextNotes = () => {
    if (!audioEngine || !selectedPattern) return;
    
    const contextTime = audioEngine.getContextTime();
    const lookahead = 0.1; 
    const scheduleInterval = 0.025; 

    // Static helper to avoid 'this' issues in the closure
    const playNote = (time: number, url: string) => {
      const source = (audioEngine as any).context.createBufferSource();
      source.buffer = (audioEngine as any).buffers.get(url);
      if (source.buffer) {
        source.connect((audioEngine as any).masterGain);
        source.start(time);
      }
    };

    const nextNoteTime = startTimeRef.current + (playheadRef.current * stepTime);

    if (nextNoteTime < contextTime + lookahead) {
      const step = playheadRef.current;
      const soundUrl = getSoundForPattern(selectedPattern);
      const metronomeUrl = (audioEngine as any).constructor.METRONOME_URL;

      // Always play metronome on beats
      if (step % 4 === 0) {
        playNote(nextNoteTime, metronomeUrl);
      }

      // Play pattern automatically only in explore mode
      if (mode === 'explore' && selectedPattern.steps.includes(step % 128)) {
        playNote(nextNoteTime, soundUrl);
      }

      playheadRef.current++;

      // Stop Quiz automatically
      if (status === 'QUIZ_PLAYING' && playheadRef.current >= QUIZ_STEPS) {
        const delay = (nextNoteTime - contextTime) * 1000;
        schedulerRef.current = window.setTimeout(finishPerformanceQuiz, delay + 100);
        return;
      }
    }

    schedulerRef.current = window.setTimeout(scheduleNextNotes, scheduleInterval * 1000);
  };

  const updatePlayheadUI = () => {
    if (!audioEngine || startTimeRef.current === 0) return;
    const elapsed = audioEngine.getContextTime() - startTimeRef.current;
    const currentStep = Math.floor(elapsed / stepTime);
    setPlayhead(currentStep);
    frameRef.current = requestAnimationFrame(updatePlayheadUI);
  };

  const startPlayback = async (pattern: TriggerPattern) => {
    if (!audioEngine) return;
    await audioEngine.resume();
    const soundUrl = getSoundForPattern(pattern);
    await audioEngine.preloadAudio([soundUrl, (audioEngine as any).constructor.METRONOME_URL]);
    
    setIsPlaying(true);
    playheadRef.current = 0;
    const now = audioEngine.getContextTime();
    startTimeRef.current = now + 0.1;

    scheduleNextNotes();
    updatePlayheadUI();
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    if (schedulerRef.current) {
      clearTimeout(schedulerRef.current);
      schedulerRef.current = null;
    }
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setPlayhead(0);
    playheadRef.current = 0;
    startTimeRef.current = 0;
  };

  const toggleExplore = () => {
    if (!selectedPattern) return;
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback(selectedPattern);
    }
  };

  const startPerformanceQuiz = async () => {
    if (!selectedPattern || !audioEngine) return;
    setMode('quiz');
    setStatus('COUNT_IN');
    setUserTaps([]);
    setFinalScore(null);
    stopPlayback();

    await audioEngine.resume();
    const metronomeUrl = (audioEngine as any).constructor.METRONOME_URL;
    const soundUrl = getSoundForPattern(selectedPattern);
    await audioEngine.preloadAudio([soundUrl, metronomeUrl]);

    await audioEngine.playCountIn(bpm, (beat) => setCountIn(5 - beat));
    
    setCountIn(null);
    setStatus('QUIZ_PLAYING');
    
    const now = audioEngine.getContextTime();
    startTimeRef.current = now + 0.05;
    playheadRef.current = 0;

    scheduleNextNotes();
    updatePlayheadUI();
  };

  const finishPerformanceQuiz = () => {
    if (!selectedPattern) return;
    
    stopPlayback();
    setStatus('RESULTS');

    const targetSteps = selectedPattern.steps.filter(s => s < QUIZ_STEPS);
    let hits = 0;
    const matchedTaps = new Set<number>();
    const tolerance = 0.5;

    targetSteps.forEach(target => {
      let bestMatchIdx = -1;
      let minDiff = Infinity;

      userTaps.forEach((tap, idx) => {
        if (matchedTaps.has(idx)) return;
        const diff = Math.abs(tap.step - target);
        if (diff <= tolerance && diff < minDiff) {
          minDiff = diff;
          bestMatchIdx = idx;
        }
      });

      if (bestMatchIdx !== -1) {
        hits++;
        matchedTaps.add(bestMatchIdx);
      }
    });

    const maxPoints = Math.max(targetSteps.length, userTaps.length, 1);
    const accuracy = Math.round((hits / maxPoints) * 100);
    
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
    <div className="flex flex-col h-screen bg-[#050505] text-white p-4 font-body overflow-hidden select-none">
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

        <div className="w-full max-w-5xl space-y-12 animate-in zoom-in-95 duration-500 pb-20">
          <div className="text-center">
            <h2 className="text-4xl md:text-7xl font-black uppercase italic tracking-tighter mb-6 text-gradient">
              RHYTHM MASTER
            </h2>
            
            <div className="flex gap-1 md:gap-2 justify-center w-full max-w-2xl mx-auto mb-10">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className={cn(
                  "h-10 md:h-14 flex-1 rounded-md border transition-all duration-75 flex items-center justify-center",
                  (playhead % 16 === i && (status === 'QUIZ_PLAYING' || isPlaying)) ? "border-primary bg-primary shadow-[0_0_15px_rgba(255,51,153,0.5)] scale-y-110" : 
                  (selectedPattern?.steps.some(s => s % 16 === i)) ? "border-primary/40 bg-primary/20" : 
                  "border-white/5 bg-white/5"
                )}>
                  <div className={cn(
                    "text-[8px] font-black opacity-20",
                    (i % 4 === 0) && "opacity-40",
                    ((playhead % 16 === i && (status === 'QUIZ_PLAYING' || isPlaying))) && "opacity-100 text-black"
                  )}>
                    {i + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-12 md:gap-24 mb-12">
             <div className="flex flex-col items-center gap-3">
               <div className="rounded-2xl border border-white/10 overflow-hidden">
                 <Button
                  onClick={toggleExplore}
                  disabled={status !== 'IDLE' && status !== 'RESULTS'}
                  className={cn(
                    "w-20 h-20 md:w-24 md:h-24 rounded-none border-none flex flex-col items-center justify-center transition-all bg-black/40 hover:bg-black/60",
                    isPlaying ? "text-primary" : "text-white/40"
                  )}
                >
                  {isPlaying ? <Square className="w-6 h-6 fill-primary text-primary" /> : <Play className="w-6 h-6 fill-white text-white" />}
                </Button>
               </div>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Training</span>
             </div>

             <div className="rounded-[3rem] border border-white/5 overflow-hidden">
               <Button
                onPointerDown={handleTap}
                className={cn(
                  "w-44 h-44 md:w-52 md:h-52 rounded-none border-none flex flex-col items-center justify-center transition-all select-none touch-none bg-black/40 hover:bg-black/40 duration-75",
                  tapFeedback === 'active' && "scale-95 brightness-110",
                  tapFeedback === 'hit' && "scale-105 bg-[#00E676] shadow-[0_0_120px_#00E676] border border-[#00E676] ring-8 ring-[#00E676]/20"
                )}
              >
                <Target className={cn(
                  "w-12 h-12 mb-3 transition-colors", 
                  tapFeedback === 'hit' ? "text-white" : "text-white/20"
                )} />
                <span className={cn(
                  "text-[11px] font-black uppercase italic tracking-widest transition-opacity",
                  tapFeedback === 'hit' ? "opacity-100 text-black" : "opacity-40"
                )}>
                  {tapFeedback === 'hit' ? 'BOOM!' : 'Tap Rhythm'}
                </span>
              </Button>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="rounded-2xl border border-white/10 overflow-hidden">
                <Button
                  onClick={startPerformanceQuiz}
                  disabled={status === 'COUNT_IN' || status === 'QUIZ_PLAYING'}
                  className="w-20 h-20 md:w-24 md:h-24 rounded-none border-none bg-black/40 hover:bg-black/60 group"
                >
                  <Brain className="w-6 h-6 text-white group-hover:text-primary transition-colors" />
                </Button>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Start Quiz</span>
            </div>
          </div>

          {(status === 'COUNT_IN' || status === 'QUIZ_PLAYING') && (
            <div className="w-full max-w-2xl mx-auto text-center space-y-12 animate-in slide-in-from-bottom-8">
              <div className="absolute top-4 right-4 md:right-10 z-[60]">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => { stopPlayback(); setStatus('IDLE'); }}
                  className="w-12 h-12 rounded-full text-white/20 hover:text-white hover:bg-white/10 transition-all border border-white/5 bg-black/40 backdrop-blur-xl"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>
              <h2 className="text-5xl md:text-8xl font-black uppercase italic tracking-tighter text-gradient">
                {status === 'COUNT_IN' ? countIn : 'RECORDING...'}
              </h2>
            </div>
          )}

          {status === 'RESULTS' && (
            <div className="w-full max-w-2xl mx-auto text-center space-y-12 animate-in zoom-in-95">
              <h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter">PERFORMANCE</h2>
              <div className="text-7xl font-black italic transition-colors duration-500" style={{ color: getAccuracyColor(finalScore || 0) }}>
                {finalScore}%
              </div>
              <div className="flex gap-4">
                <Button onClick={startPerformanceQuiz} variant="outline" className="flex-1 h-20 rounded-2xl font-black uppercase italic border-white/10">Retry</Button>
                <Button onClick={() => setStatus('IDLE')} className="flex-1 h-20 bg-white text-black rounded-2xl font-black uppercase italic">Finish</Button>
              </div>
            </div>
          )}

          {status === 'IDLE' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {patterns?.map(p => {
                const mastery = getMastery(p.id);
                const isSelected = selectedPatternId === p.id;
                
                return (
                  <div 
                    key={p.id} 
                    onClick={() => {
                      stopPlayback();
                      setSelectedPatternId(p.id);
                    }}
                    className={cn(
                      "cursor-pointer transition-all rounded-xl border p-4",
                      isSelected ? "border-primary/50 bg-black/80" : "bg-black/40 border-white/5 hover:border-white/10"
                    )}
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className={cn(
                          "text-sm font-black uppercase italic tracking-tighter line-clamp-1",
                          isSelected ? "text-primary" : "text-white/80"
                        )}>
                          {p.name}
                        </h4>
                        <div className="text-[10px] font-black italic whitespace-nowrap" style={{ color: getAccuracyColor(mastery) }}>
                          {mastery}%
                        </div>
                      </div>
                      <Progress value={mastery} className="h-1" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <footer className="p-8 shrink-0 flex justify-center opacity-20">
        <div className="flex items-center gap-4">
          <Volume2 className="w-5 h-5" />
          <span className="text-[10px] font-black uppercase tracking-[0.5em]">Sample-Accurate Audio Engine • v6.0</span>
        </div>
      </footer>
    </div>
  );
};
