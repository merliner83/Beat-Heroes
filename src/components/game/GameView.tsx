
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Game, Level, Sound, GameScore, SoundType, TriggerPattern, getAccuracyColor } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { SamplerPad, FlashType } from './SamplerPad';
import { NoteLane } from './NoteLane';
import { Button } from '@/components/ui/button';
import { Music2, Trophy, Loader2, XCircle, ArrowLeft, Sparkles, Percent } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore } from '@/firebase';
import { doc, increment, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';

export const SYNC_OFFSET = 0.08;

const PAD_COLORS: Record<SoundType, string> = { kick: '#993DEB', clap: '#FF3D00', percs: '#FFEA00', misc: '#3838FA' };
const PAD_LABELS: Record<SoundType, string> = { kick: 'PAD 1', clap: 'PAD 2', percs: 'PAD 3', misc: 'PAD 4' };
const SHORTCUTS: Record<SoundType, string> = { kick: 'A', clap: 'S', percs: 'K', misc: 'L' };
const PASS_THRESHOLD = 80;

interface GameViewProps { game: Game; level: Level; sounds: Sound[]; patterns: TriggerPattern[]; }

export const GameView: React.FC<GameViewProps> = ({ game, level, sounds, patterns }) => {
  const db = useFirestore();
  const { user } = useUser();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [countIn, setCountIn] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [score, setScore] = useState<GameScore>({ hits: 0, misses: 0, accuracy: 100 });
  const [isFinished, setIsFinished] = useState(false);
  const [hasStartedFade, setHasStartedFade] = useState(false);
  const [hitPosition, setHitPosition] = useState(400);
  const [globalFlash, setGlobalFlash] = useState<{ type: FlashType, key: number }>({ type: null, key: 0 });
  const [padFlashes, setPadFlashes] = useState<Record<SoundType, { type: FlashType, key: number }>>({ kick: { type: null, key: 0 }, clap: { type: null, key: 0 }, percs: { type: null, key: 0 }, misc: { type: null, key: 0 } });
  
  const frameRef = useRef<number>(null);
  const clearedNotesRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();

  const bpm = game.bpm || 128;
  const TOTAL_STEPS = 320; 
  const SESSION_DURATION = (20 * 4 * 60) / bpm; 
  const FADE_DURATION = 2;

  useEffect(() => {
    const handleResize = () => { setHitPosition(window.innerWidth > 768 ? window.innerHeight * 0.45 : window.innerHeight * 0.4); };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeSoundTypes: SoundType[] = ['kick'];
  if (level.difficulty >= 2) activeSoundTypes.push('clap');
  if (level.difficulty >= 3) activeSoundTypes.push('percs');
  if (level.difficulty >= 4) activeSoundTypes.push('misc');

  const soundsWithPatterns = sounds.filter(s => activeSoundTypes.includes(s.type)).map(sound => {
    const uniqueSteps = new Set<number>();
    const patternOffsets = [0, 128, 192]; 
    sound.patternIds?.forEach((pId, index) => {
      const pattern = patterns.find(p => p.id === pId);
      if (pattern && index < patternOffsets.length) {
        const offset = patternOffsets[index];
        pattern.steps.forEach(s => { const actualStep = s + offset; if (actualStep < TOTAL_STEPS) uniqueSteps.add(actualStep); });
      }
    });
    return { ...sound, triggerSteps: Array.from(uniqueSteps).sort((a, b) => a - b) };
  });

  useEffect(() => {
    const preload = async () => {
      if (!audioEngine) return;
      await audioEngine.preloadAudio([game.backingTrackUrl || '', ...sounds.filter(s => activeSoundTypes.includes(s.type)).map(s => s.sampleUrl)]);
      setIsAudioReady(true);
    };
    preload();
  }, [game.backingTrackUrl, sounds, activeSoundTypes]);

  useEffect(() => { return () => { audioEngine?.stop(); if (frameRef.current) cancelAnimationFrame(frameRef.current); }; }, []);

  const handlePadPress = useCallback((type: SoundType) => {
    if (!audioEngine || !isPlaying || !activeSoundTypes.includes(type)) return;
    const sound = soundsWithPatterns.find(s => s.type === type);
    if (!sound) return;
    audioEngine.playOneShot(sound.sampleUrl);
    const time = audioEngine.getCurrentTime();
    const currentStep = (time - SYNC_OFFSET) / ((60 / bpm) / 4);
    const tolerance = level.difficulty <= 2 ? 1.6 : 1.2; 
    let hitNoteId: string | null = null;
    let minDiff = Infinity;
    sound.triggerSteps.forEach(step => {
      const noteId = `${type}-${step}`;
      if (clearedNotesRef.current.has(noteId)) return;
      const diff = Math.abs(currentStep - step);
      if (diff <= tolerance && diff < minDiff) { minDiff = diff; hitNoteId = noteId; }
    });
    if (hitNoteId) {
      setPadFlashes(prev => ({ ...prev, [type]: { type: 'hit', key: Date.now() } }));
      setGlobalFlash({ type: 'hit', key: Date.now() });
      clearedNotesRef.current.add(hitNoteId);
      setScore(prev => { const nextHits = prev.hits + 1; const total = nextHits + prev.misses; return { hits: nextHits, misses: prev.misses, accuracy: Math.round((nextHits / total) * 100) }; });
    } else {
      setPadFlashes(prev => ({ ...prev, [type]: { type: 'miss', key: Date.now() } }));
      setGlobalFlash({ type: 'miss', key: Date.now() });
      setScore(prev => { const nextMisses = prev.misses + 1; const total = prev.hits + nextMisses; return { hits: prev.hits, misses: nextMisses, accuracy: total === 0 ? 100 : Math.round((prev.hits / total) * 100) }; });
    }
  }, [isPlaying, soundsWithPatterns, bpm, activeSoundTypes, level.difficulty]);

  const startLevel = async () => {
    if (!audioEngine) return;
    setIsLoadingAudio(true);
    setHasStartedFade(false);
    try {
      await audioEngine.resume();
      clearedNotesRef.current = new Set();
      setScore({ hits: 0, misses: 0, accuracy: 100 });
      setIsFinished(false);
      const now = audioEngine.getContextTime();
      const actualStartTime = now + (4 * (60 / bpm));
      audioEngine.setStartTime(actualStartTime);
      await audioEngine.playCountIn(bpm, (beat) => setCountIn(5 - beat));
      setCountIn(null);
      setIsPlaying(true); 
      await audioEngine.startBackingTrack(game.backingTrackUrl || '', actualStartTime);
    } catch (e) { toast({ variant: "destructive", title: "Audio Error" }); } finally { setIsLoadingAudio(false); }
  };

  useEffect(() => {
    if (isPlaying) {
      const update = () => {
        if (audioEngine) {
          const t = audioEngine.getCurrentTime();
          setCurrentTime(t);
          const currentStep = (t - SYNC_OFFSET) / ((60 / bpm) / 4);
          const tolerance = level.difficulty <= 2 ? 1.6 : 1.2;
          if (t >= SESSION_DURATION && !hasStartedFade) { setHasStartedFade(true); audioEngine.fadeBackingTrack(FADE_DURATION); }
          let passiveMisses = 0;
          soundsWithPatterns.forEach(sound => {
            sound.triggerSteps.forEach(step => {
              const noteId = `${sound.type}-${step}`;
              if (!clearedNotesRef.current.has(noteId) && currentStep > step + tolerance) { clearedNotesRef.current.add(noteId); passiveMisses++; }
            });
          });
          if (passiveMisses > 0) setScore(prev => { const total = prev.hits + prev.misses + passiveMisses; return { hits: prev.hits, misses: prev.misses + passiveMisses, accuracy: Math.round((prev.hits / total) * 100) }; });
          if (t >= SESSION_DURATION + FADE_DURATION) { setIsPlaying(false); setIsFinished(true); audioEngine.stop(); }
        }
        frameRef.current = requestAnimationFrame(update);
      };
      frameRef.current = requestAnimationFrame(update);
    }
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [isPlaying, bpm, soundsWithPatterns, level.difficulty, SESSION_DURATION, hasStartedFade]);

  useEffect(() => {
    if (isFinished && score.accuracy >= PASS_THRESHOLD && user && db) {
      const save = async () => {
        const progRef = doc(db, 'users', user.uid, 'progress', level.id);
        const snap = await getDoc(progRef);
        const oldAcc = snap.exists() ? snap.data().accuracy : 0;
        if (score.accuracy > oldAcc) {
          await setDoc(progRef, { levelId: level.id, accuracy: score.accuracy, completedAt: serverTimestamp() }, { merge: true });
          const deltaSC = Math.round(((score.accuracy - oldAcc) / 100) * (game.maxPoints || 500));
          await setDoc(doc(db, 'users', user.uid), { streetCred: increment(deltaSC) }, { merge: true });
        }
      };
      save();
    }
  }, [isFinished, score.accuracy, user, db, level, game]);

  const accColor = getAccuracyColor(score.accuracy);

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-3 max-w-6xl mx-auto overflow-hidden">
      <header className="flex justify-between items-center mb-2 px-4 h-12 relative z-[60]">
        <div className="flex items-center gap-4"><Link href={`/studio/${game.studioId}`}><ArrowLeft className="w-6 h-6 text-white/50 hover:text-white" /></Link>
          <div className="flex flex-col"><h1 className="text-xs font-black uppercase italic tracking-tighter leading-none">BEAT HERO</h1><p className="text-[9px] uppercase font-black opacity-30 tracking-widest">{game.name}</p></div>
        </div>
        <div className="bg-black/60 backdrop-blur-xl px-5 py-2 rounded-full border border-white/10 flex items-center gap-2.5 h-10">
          <Percent className="w-4 h-4" style={{ color: accColor }} /><p className="text-lg md:text-3xl font-black italic leading-none transition-colors" style={{ color: accColor }}>{score.accuracy}</p>
        </div>
      </header>
      <main className="relative flex-1 gemini-border overflow-hidden bg-black/40 rounded-3xl z-10">
        <div className="absolute inset-0 z-0"><div className="flex h-full px-2 relative">{activeSoundTypes.map(type => <NoteLane key={type} notes={soundsWithPatterns.find(s => s.type === type)?.triggerSteps || []} currentTime={currentTime} bpm={bpm} isActive={isPlaying} color={PAD_COLORS[type]} hitPosition={hitPosition} />)}</div></div>
        <div key={globalFlash.key} className="absolute left-0 right-0 z-20 pointer-events-none transition-all duration-300" style={{ top: `${hitPosition - 60}px`, height: '120px', background: globalFlash.type === 'hit' ? 'linear-gradient(to bottom, transparent, rgba(0, 230, 118, 0.4) 50%, transparent)' : globalFlash.type === 'miss' ? 'linear-gradient(to bottom, transparent, rgba(255, 61, 0, 0.4) 50%, transparent)' : 'linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.05) 50%, transparent)' }} />
        <div className="absolute left-0 right-0 z-40 px-6 pointer-events-none" style={{ top: `${hitPosition + 120}px` }}>
          <div className={cn("grid gap-4 mx-auto pointer-events-auto bg-black/20 backdrop-blur-sm p-4 rounded-3xl border border-white/5 shadow-2xl", activeSoundTypes.length === 1 ? "max-w-[140px]" : activeSoundTypes.length === 2 ? "grid-cols-2 max-w-[280px]" : "grid-cols-4 max-w-xl")}>
            {activeSoundTypes.map(type => <SamplerPad key={type} label={PAD_LABELS[type]} shortcut={SHORTCUTS[type]} onPress={() => handlePadPress(type)} color={PAD_COLORS[type]} flash={padFlashes[type].type} flashKey={padFlashes[type].key} />)}
          </div>
        </div>
        {!isPlaying && !isFinished && countIn === null && (
          <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-[70] backdrop-blur-sm">
            <div className="text-center"><Sparkles className="w-16 h-16 text-[#993DEB] mx-auto mb-6 animate-pulse-neon" /><h2 className="text-2xl md:text-5xl font-black mb-10 uppercase italic tracking-tighter text-gradient">BEAT HERO</h2><Button onClick={startLevel} disabled={isLoadingAudio || !isAudioReady} className="w-56 md:w-80 h-16 md:h-24 text-base md:text-3xl font-black uppercase italic bg-white text-black rounded-3xl transition-all shadow-xl">{!isAudioReady ? "Loading..." : "Initiate Pulse"}</Button></div>
          </div>
        )}
        {countIn !== null && <div className="absolute inset-0 flex items-center justify-center z-[70] pointer-events-none"><div className="text-[10rem] font-black italic text-[#FFEA00] animate-in zoom-in-50">{countIn}</div></div>}
        {isFinished && (
          <div className="absolute inset-0 bg-black/98 flex items-center justify-center p-8 z-[80] backdrop-blur-2xl">
            <div className="text-center space-y-8"><Trophy className={cn("w-20 h-20 mx-auto", score.accuracy >= PASS_THRESHOLD ? "text-[#FFEA00]" : "text-white/10")} /><h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter">{score.accuracy >= PASS_THRESHOLD ? "Gold Mastered" : "Desynced"}</h2><p className="font-black text-3xl italic" style={{ color: getAccuracyColor(score.accuracy) }}>{score.accuracy}% Sync</p>
              <div className="flex gap-6 pt-12"><Button onClick={startLevel} variant="outline" className="flex-1 h-16 rounded-2xl uppercase font-black italic">Retry</Button><Link href={`/studio/${game.studioId}`} className="flex-1"><Button className="w-full h-16 bg-white text-black font-black uppercase italic rounded-2xl">Return</Button></Link></div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
