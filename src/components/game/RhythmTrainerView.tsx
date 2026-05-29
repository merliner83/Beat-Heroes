
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Game, Level, TriggerPattern, PatternProgress, getAccuracyColor } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Play, Square, Trophy, Target, Brain, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, increment, setDoc, serverTimestamp, collection, query, getDoc } from 'firebase/firestore';

const SOUND_MAPPING: Record<string, string> = {
  'kick': 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FKICK1.mp3?alt=media&token=23415b38-2c12-4462-bb74-385533ad1c57',
  'clave': 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FClaves.mp3?alt=media&token=1162b3f6-19d7-4a41-a3b6-9c243cd5d36a'
};

const QUIZ_STEPS = 64; 

interface RhythmTrainerViewProps { game: Game; level: Level; }
type ViewStatus = 'IDLE' | 'COUNT_IN' | 'PLAYING' | 'RESULTS';

export const RhythmTrainerView: React.FC<RhythmTrainerViewProps> = ({ game, level }) => {
  const db = useFirestore();
  const { user } = useUser();
  const [mode, setMode] = useState<'explore' | 'quiz'>('explore');
  const [status, setStatus] = useState<ViewStatus>('IDLE');
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0); 
  const [countIn, setCountIn] = useState<number | null>(null);
  const [lastHitTime, setLastHitTime] = useState(0);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastScheduledStepRef = useRef<number>(-1);
  const frameRef = useRef<number | null>(null);
  const userTapsRef = useRef<{ step: number }[]>([]);
  const bpm = 120; 
  const stepTime = (60 / bpm) / 4; 

  const patternsQuery = useMemoFirebase(() => db ? query(collection(db, 'patterns')) : null, [db]);
  const { data: patterns } = useCollection<TriggerPattern>(patternsQuery);

  const selectedPattern = useMemo(() => patterns?.find(p => p.id === selectedPatternId), [patterns, selectedPatternId]);

  useEffect(() => { if (patterns?.length && !selectedPatternId) setSelectedPatternId(patterns[0].id); }, [patterns, selectedPatternId]);

  const finishQuiz = useCallback(async (taps: { step: number }[]) => {
    if (!selectedPattern) return;
    const targetSteps = selectedPattern.steps.filter(s => s < QUIZ_STEPS);
    let hits = 0;
    const matchedTaps = new Set<number>();
    targetSteps.forEach(target => {
      let bestMatchIdx = -1;
      let minDiff = Infinity;
      taps.forEach((tap, idx) => {
        if (matchedTaps.has(idx)) return;
        const diff = Math.abs(tap.step - target);
        if (diff <= 0.5 && diff < minDiff) { minDiff = diff; bestMatchIdx = idx; }
      });
      if (bestMatchIdx !== -1) { hits++; matchedTaps.add(bestMatchIdx); }
    });
    const accuracy = targetSteps.length > 0 ? Math.round((hits / targetSteps.length) * 100) : 0;
    setFinalScore(accuracy);
    setStatus('RESULTS');
    if (user && db) {
      const progRef = doc(db, 'users', user.uid, 'patternProgress', selectedPattern.id);
      const snap = await getDoc(progRef);
      const oldAcc = snap.exists() ? (snap.data().accuracy || 0) : 0;
      if (accuracy > oldAcc) {
        await setDoc(progRef, { patternId: selectedPattern.id, accuracy, completedAt: serverTimestamp() }, { merge: true });
        const deltaAcc = accuracy - oldAcc;
        const deltaSC = Math.round((deltaAcc / 100) * (game.maxPoints || 500));
        await setDoc(doc(db, 'users', user.uid), { streetCred: increment(deltaSC) }, { merge: true });
      }
    }
  }, [selectedPattern, user, db, game]);

  const stopPlayback = useCallback(() => {
    if (frameRef.current) { cancelAnimationFrame(frameRef.current); frameRef.current = null; }
    setStatus('IDLE'); setPlayhead(0); startTimeRef.current = 0; lastScheduledStepRef.current = -1;
  }, []);

  const loop = useCallback(() => {
    if (!audioEngine || startTimeRef.current === 0) return;
    const now = audioEngine.getContextTime();
    const elapsed = now - startTimeRef.current;
    if (elapsed < 0) { frameRef.current = requestAnimationFrame(loop); return; }
    const currentStepInt = Math.floor(elapsed / stepTime);
    if (mode === 'quiz' && currentStepInt >= QUIZ_STEPS) { const finalTaps = [...userTapsRef.current]; stopPlayback(); finishQuiz(finalTaps); return; }
    if (currentStepInt > lastScheduledStepRef.current) {
      if (currentStepInt % 4 === 0) audioEngine.playOneShot((audioEngine as any).constructor.METRONOME_URL);
      if (mode === 'explore' && selectedPattern?.steps.includes(currentStepInt % 128)) audioEngine.playOneShot(selectedPattern.sampleUrl || SOUND_MAPPING['clave']);
      lastScheduledStepRef.current = currentStepInt;
      setPlayhead(currentStepInt % 16);
    }
    frameRef.current = requestAnimationFrame(loop);
  }, [selectedPattern, mode, stepTime, finishQuiz, stopPlayback]);

  const handleTap = useCallback(() => {
    if (!audioEngine || !selectedPattern) return;
    audioEngine.playOneShot(selectedPattern.sampleUrl || SOUND_MAPPING['clave']);
    if (startTimeRef.current === 0 || status !== 'PLAYING') return;
    const elapsed = audioEngine.getContextTime() - startTimeRef.current;
    if (elapsed < 0) return;
    const currentStepRaw = elapsed / stepTime;
    const normalizedPos = currentStepRaw % 128;
    if (selectedPattern.steps.some(s => Math.min(Math.abs(s - normalizedPos), Math.abs(s - (normalizedPos - 128)), Math.abs(s - (normalizedPos + 128))) <= 0.5)) setLastHitTime(Date.now());
    if (mode === 'quiz') userTapsRef.current.push({ step: currentStepRaw });
  }, [selectedPattern, status, mode, stepTime]);

  const startSession = async (newMode: 'explore' | 'quiz') => {
    if (!audioEngine || !selectedPattern) return;
    setMode(newMode); stopPlayback(); userTapsRef.current = []; setFinalScore(null);
    await audioEngine.resume();
    await audioEngine.preloadAudio([selectedPattern.sampleUrl || '', (audioEngine as any).constructor.METRONOME_URL]);
    if (newMode === 'quiz') { setStatus('COUNT_IN'); await audioEngine.playCountIn(bpm, (beat) => setCountIn(5 - beat)); setCountIn(null); }
    setStatus('PLAYING'); startTimeRef.current = audioEngine.getContextTime() + 0.1; lastScheduledStepRef.current = -1;
    frameRef.current = requestAnimationFrame(loop);
  };

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-4 font-body overflow-hidden select-none">
      <header className="flex justify-between items-center h-20 px-6 bg-black/40 backdrop-blur-xl border-b border-white/5 rounded-t-3xl">
        <div className="flex items-center gap-4"><Link href="/"><ArrowLeft className="w-6 h-6 text-white/40 hover:text-white transition-all hover:scale-110" /></Link>
          <div className="flex flex-col"><h1 className="text-xl font-black uppercase italic tracking-tighter text-gradient leading-none">RHYTHM MASTER</h1><p className="text-[10px] opacity-30 uppercase font-black tracking-[0.2em] mt-1">MIDI Lab Interface</p></div>
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center p-6 relative overflow-y-auto">
        <div className="w-full max-w-5xl space-y-12 animate-in zoom-in-95 duration-500">
          <div className="text-center"><h2 className="text-4xl md:text-7xl font-black uppercase italic tracking-tighter mb-6 text-gradient h-20 flex items-center justify-center">{status === 'COUNT_IN' ? countIn : status === 'RESULTS' ? 'FINISHED' : 'RHYTHM MASTER'}</h2>
            <div className="flex gap-1 justify-center max-w-2xl mx-auto mb-10">{Array.from({ length: 16 }).map((_, i) => (<div key={i} className={cn("h-10 flex-1 rounded-md border transition-all", (playhead === i && status === 'PLAYING') ? "border-[#00E676] bg-[#00E676]/20 scale-y-110" : (selectedPattern?.steps.some(s => s % 16 === i)) ? "border-primary/40 bg-primary/20" : "border-white/5 bg-white/5")} />))}</div>
          </div>
          <div className="flex items-center justify-center gap-12">
             <Button onClick={() => (status === 'PLAYING' || status === 'COUNT_IN') ? stopPlayback() : startSession('explore')} className={cn("w-20 h-20 rounded-2xl border bg-black/40", (status === 'PLAYING' || status === 'COUNT_IN') && mode === 'explore' ? "text-primary border-primary" : "text-white/40")}>{(status === 'PLAYING' || status === 'COUNT_IN') && mode === 'explore' ? <Square className="w-6 h-6 fill-primary" /> : <Play className="w-6 h-6 fill-white" />}</Button>
             <Button onPointerDown={(e) => { e.preventDefault(); handleTap(); }} className={cn("w-44 h-44 rounded-[3rem] border-4 transition-all duration-75 bg-black/40", Date.now() - lastHitTime < 150 ? "border-[#00E676] bg-[#00E676] scale-105" : "border-white/10")}><Target className={cn("w-12 h-12", Date.now() - lastHitTime < 150 ? "text-black" : "text-white/20")} /></Button>
             <Button onClick={() => startSession('quiz')} disabled={status === 'COUNT_IN' || (status === 'PLAYING' && mode === 'quiz')} className={cn("w-20 h-20 rounded-2xl border bg-black/40", (status === 'PLAYING' || status === 'COUNT_IN') && mode === 'quiz' ? "text-primary border-primary" : "text-white/40")}><Brain className="w-6 h-6" /></Button>
          </div>
          {status === 'RESULTS' && (
            <div className="text-center space-y-12 bg-black/90 p-10 rounded-[3rem] border border-white/10 shadow-2xl max-w-lg mx-auto">
              <Trophy className="w-20 h-20 text-[#FFEA00] mx-auto" />
              <h2 className="text-5xl font-black italic text-gradient">{finalScore}%</h2>
              <div className="flex gap-4"><Button onClick={() => startSession('quiz')} variant="outline" className="flex-1 h-16 rounded-xl font-black italic">Retry</Button><Button onClick={() => setStatus('IDLE')} className="flex-1 h-16 bg-white text-black rounded-xl font-black italic">Done</Button></div>
            </div>
          )}
        </div>
      </main>
      <footer className="p-8 shrink-0 flex justify-center opacity-20"><div className="flex items-center gap-4"><Volume2 className="w-5 h-5" /><span className="text-[10px] font-black uppercase tracking-[0.5em]">Sample-Accurate Sync Engine</span></div></footer>
    </div>
  );
};
