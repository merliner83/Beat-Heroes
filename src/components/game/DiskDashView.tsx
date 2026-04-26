
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Game, Level, Sound, GameScore, getAccuracyColor } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { Button } from '@/components/ui/button';
import { Trophy, Loader2, Sparkles, XCircle, Disc, Headphones, Mic, Speaker, ArrowLeft, Percent, Circle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore } from '@/firebase';
import { doc, increment, setDoc, serverTimestamp } from 'firebase/firestore';

const PASS_THRESHOLD = 80;

const DASH_ICONS = [Disc, Headphones, Mic, Speaker];
const TARGETS = [
  { id: 't1', x: 25, y: 30, color: '#FF3399' },
  { id: 't2', x: 75, y: 30, color: '#00FFFF' },
  { id: 't3', x: 25, y: 70, color: '#FFEA00' },
  { id: 't4', x: 75, y: 70, color: '#3838FA' },
];

interface DashItem {
  id: string;
  iconIdx: number;
  targetId: string;
  startTime: number;
  startX: number;
  startY: number;
  status: 'active' | 'hit' | 'missed';
}

interface DiskDashViewProps {
  game: Game;
  level: Level;
  sounds: Sound[];
}

export const DiskDashView: React.FC<DiskDashViewProps> = ({ game, level, sounds }) => {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [countIn, setCountIn] = useState<number | null>(null);
  const [score, setScore] = useState<GameScore>({ hits: 0, misses: 0, accuracy: 100 });
  const [isFinished, setIsFinished] = useState(false);
  const [activeItems, setActiveItems] = useState<DashItem[]>([]);
  const [targetFeedback, setTargetFeedback] = useState<Record<string, { time: number, type: 'hit' | 'miss' }>>({});
  const [hasStartedFade, setHasStartedFade] = useState(false);

  const frameRef = useRef<number>(null);
  const lastSpawnRef = useRef<number>(0);

  const bpm = game.bpm || 128;
  const SESSION_DURATION = (20 * 4 * 60) / bpm; 
  const FADE_DURATION = 2;
  const FLIGHT_TIME = 1800; 

  useEffect(() => {
    return () => {
      audioEngine?.stop();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const spawnItem = useCallback(() => {
    const availableTargets = Math.min(level.difficulty, TARGETS.length);
    const targetIdx = Math.floor(Math.random() * availableTargets);
    const target = TARGETS[targetIdx];
    
    const side = Math.floor(Math.random() * 4);
    let startX = 0, startY = 0;

    if (side === 0) { startX = -15; startY = Math.random() * 100; }
    else if (side === 1) { startX = 115; startY = Math.random() * 100; }
    else if (side === 2) { startX = Math.random() * 100; startY = -15; }
    else { startX = Math.random() * 100; startY = 115; }

    const newItem: DashItem = {
      id: `dash-${Date.now()}-${Math.random()}`,
      iconIdx: Math.floor(Math.random() * DASH_ICONS.length),
      targetId: target.id,
      startTime: Date.now(),
      startX,
      startY,
      status: 'active'
    };
    setActiveItems(prev => [...prev, newItem]);
  }, [level.difficulty]);

  const updateGame = useCallback(() => {
    if (!isPlaying) return;

    const currentTime = audioEngine?.getCurrentTime() || 0;
    const now = Date.now();

    if (currentTime >= SESSION_DURATION && !hasStartedFade) {
      setHasStartedFade(true);
      audioEngine?.fadeBackingTrack(FADE_DURATION);
    }

    if (currentTime >= SESSION_DURATION + FADE_DURATION) {
      setIsPlaying(false);
      setIsFinished(true);
      audioEngine?.stop();
      return;
    }

    const spawnMultiplier = level.difficulty === 1 ? 1.5 : level.difficulty === 2 ? 1.2 : 0.8;
    const spawnInterval = (60 / bpm) * 1000 * spawnMultiplier;
    
    if (now - lastSpawnRef.current > spawnInterval && currentTime < SESSION_DURATION) {
      spawnItem();
      lastSpawnRef.current = now;
    }

    setActiveItems(prev => {
      return prev.map(item => {
        if (item.status === 'active' && now - item.startTime > FLIGHT_TIME + 250) {
          handleAutoMiss(item.id);
          return { ...item, status: 'missed' as const };
        }
        return item;
      }).filter(item => item.status === 'active');
    });

    frameRef.current = requestAnimationFrame(updateGame);
  }, [isPlaying, bpm, SESSION_DURATION, hasStartedFade, spawnItem, level.difficulty]);

  useEffect(() => {
    if (isPlaying) {
      frameRef.current = requestAnimationFrame(updateGame);
    } else if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [isPlaying, updateGame]);

  const handleAutoMiss = (itemId: string) => {
    setScore(s => {
      const nextMisses = s.misses + 1;
      const total = s.hits + nextMisses;
      return { ...s, misses: nextMisses, accuracy: Math.round((s.hits / total) * 100) };
    });
  };

  const onTargetClick = (targetId: string) => {
    if (!isPlaying) return;
    
    const now = Date.now();
    const targetItem = activeItems
      .filter(item => item.targetId === targetId && item.status === 'active')
      .sort((a, b) => (a.startTime + FLIGHT_TIME) - (b.startTime + FLIGHT_TIME))[0];

    const precision = targetItem ? Math.abs(now - (targetItem.startTime + FLIGHT_TIME)) : Infinity;
    const tolerance = level.difficulty >= 3 ? 200 : 350;

    if (targetItem && precision <= tolerance) {
      setScore(s => {
        const nextHits = s.hits + 1;
        const total = nextHits + s.misses;
        return { ...s, hits: nextHits, accuracy: Math.round((nextHits / total) * 100) };
      });
      setTargetFeedback(p => ({ ...p, [targetId]: { time: Date.now(), type: 'hit' } }));
      setActiveItems(prev => prev.filter(i => i.id !== targetItem.id));
      
      const catchSound = sounds.find(s => s.id.includes('catch'))?.sampleUrl || 'https://actions.google.com/sounds/v1/impacts/wood_block_impact.ogg';
      audioEngine?.playOneShot(catchSound);
    } else {
      setTargetFeedback(p => ({ ...p, [targetId]: { time: Date.now(), type: 'miss' } }));
      setScore(s => {
        const nextMisses = s.misses + 1;
        const total = s.hits + nextMisses;
        return { ...s, misses: nextMisses, accuracy: Math.round((s.hits / total) * 100) };
      });
    }
  };

  const startLevel = async () => {
    if (!audioEngine) return;
    setIsLoadingAudio(true);
    setHasStartedFade(false);
    try {
      await audioEngine.resume();
      await audioEngine.preloadAudio([game.backingTrackUrl || '', ...sounds.map(s => s.sampleUrl)]);
      setScore({ hits: 0, misses: 0, accuracy: 100 });
      setIsFinished(false);
      setActiveItems([]);
      
      const secondsPerBeat = 60 / bpm;
      const now = audioEngine.getContextTime();
      const actualStartTime = now + (4 * secondsPerBeat);
      audioEngine.setStartTime(actualStartTime);
      
      await audioEngine.playCountIn(bpm, (beat) => setCountIn(5 - beat));
      setCountIn(null);
      
      setIsPlaying(true);
      lastSpawnRef.current = Date.now();
      await audioEngine.startBackingTrack(game.backingTrackUrl || '', actualStartTime);
    } catch (e) {
      toast({ variant: "destructive", title: "Sync Failed" });
    } finally {
      setIsLoadingAudio(false);
    }
  };

  useEffect(() => {
    if (isFinished && score.accuracy >= PASS_THRESHOLD && user && db) {
      setDoc(doc(db, 'users', user.uid, 'progress', level.id), { 
        levelId: level.id, 
        accuracy: score.accuracy, 
        completedAt: serverTimestamp() 
      }, { merge: true });
      setDoc(doc(db, 'users', user.uid), { streetCred: increment(400) }, { merge: true });
    }
  }, [isFinished, score.accuracy, user, db, level]);

  const accColor = getAccuracyColor(score.accuracy);

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-4 overflow-hidden select-none font-body relative">
      <header className="flex justify-between items-center mb-1 px-6 h-14 shrink-0 z-50 bg-black/60 backdrop-blur-2xl border-b border-white/5 rounded-t-[2.5rem]">
        <div className="flex items-center gap-4">
          <Link href={`/studio/${game.studioId}`}>
            <ArrowLeft className="w-5 h-5 text-white/40 hover:text-white transition-all hover:scale-110" />
          </Link>
          <div>
            <h1 className="text-xs font-black uppercase italic tracking-tighter text-primary">SAMPLE CATCHER</h1>
            <p className="text-[8px] opacity-30 uppercase font-black tracking-widest">{game.name}</p>
          </div>
        </div>
        <div className="bg-black/80 px-5 py-2 rounded-full border border-white/10 flex items-center gap-2 h-10 shadow-2xl">
          <Percent className="w-4 h-4" style={{ color: accColor }} />
          <p className="text-xl font-black italic tracking-tighter transition-colors duration-500" style={{ color: accColor }}>{score.accuracy}</p>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden rounded-b-[2.5rem] bg-black/40 border-x border-b border-white/5 z-20">
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, #FF3399 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        
        {TARGETS.map(t => {
          const feedback = targetFeedback[t.id];
          const isActive = feedback && Date.now() - feedback.time < 300;
          const isHit = feedback?.type === 'hit';
          const isMiss = feedback?.type === 'miss';

          return (
            <div
              key={t.id}
              onClick={() => onTargetClick(t.id)}
              className="absolute w-32 h-32 md:w-40 md:h-40 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-all duration-300 cursor-pointer group"
              style={{ left: `${t.x}%`, top: `${t.y}%` }}
            >
              <div 
                className={cn(
                  "absolute inset-0 rounded-full border-2 transition-all duration-200",
                  isActive ? "scale-125 border-4" : "opacity-20 scale-100",
                  isHit && isActive ? "opacity-100 border-[#00E676]" : "",
                  isMiss && isActive ? "opacity-100 border-[#FF3D00]" : ""
                )}
                style={{ 
                  borderColor: (!isHit && !isMiss) ? t.color : undefined,
                  boxShadow: isActive ? `0 0 60px ${isHit ? '#00E676' : isMiss ? '#FF3D00' : t.color}` : 'none' 
                }}
              />
              <div className="relative">
                 <Circle className={cn(
                   "w-10 h-10 transition-all",
                   isActive ? "scale-150" : "opacity-10 animate-pulse"
                 )} style={{ color: isActive ? (isHit ? '#00E676' : isMiss ? '#FF3D00' : t.color) : t.color }} />
              </div>
            </div>
          );
        })}

        {activeItems.map(item => {
          const target = TARGETS.find(t => t.id === item.targetId)!;
          const elapsed = Date.now() - item.startTime;
          const progress = Math.min(elapsed / FLIGHT_TIME, 1.2);
          
          const curX = item.startX + (target.x - item.startX) * progress;
          const curY = item.startY + (target.y - item.startY) * progress;
          const Icon = DASH_ICONS[item.iconIdx];
          const opacity = progress > 1.0 ? 1 - (progress - 1.0) * 5 : 1;

          return (
            <div
              key={item.id}
              className="absolute z-40 pointer-events-none transition-transform"
              style={{ 
                left: `${curX}%`, 
                top: `${curY}%`, 
                transform: `translate(-50%, -50%) scale(${0.8 + progress * 0.4})`,
                color: target.color,
                opacity,
                filter: `drop-shadow(0 0 20px ${target.color}cc)`
              }}
            >
              <Icon className="w-12 h-12 md:w-16 md:h-16 animate-spin-slow" strokeWidth={1.5} />
            </div>
          );
        })}

        {!isPlaying && !isFinished && countIn === null && (
          <div className="absolute inset-0 bg-black/98 flex items-center justify-center z-[100] backdrop-blur-3xl">
            <div className="text-center space-y-10 max-w-sm px-6">
              <div className="relative">
                <div className="w-28 h-28 bg-primary/20 rounded-full flex items-center justify-center mx-auto animate-pulse border border-primary/30 shadow-[0_0_50px_rgba(255,51,153,0.3)]">
                  <Sparkles className="w-14 h-14 text-primary" />
                </div>
              </div>
              <div>
                <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-2">SAMPLE CATCHER</h2>
                <p className="text-[10px] uppercase font-bold tracking-[0.4em] opacity-30 leading-relaxed">Catch incoming samples<br/>Tap the circles at the right time</p>
              </div>
              <Button onClick={startLevel} disabled={isLoadingAudio} className="w-full h-20 bg-white text-black font-black uppercase italic rounded-[2rem] hover:scale-105 active:scale-95 transition-all shadow-[0_20px_60px_rgba(255,255,255,0.1)]">
                {isLoadingAudio ? <Loader2 className="animate-spin" /> : "Initiate Catch"}
              </Button>
            </div>
          </div>
        )}

        {countIn !== null && (
          <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
            <div className="text-[15rem] font-black italic text-[#FFEA00] drop-shadow-[0_0_80px_rgba(255,234,0,0.6)] animate-in zoom-in-50 duration-200">
              {countIn}
            </div>
          </div>
        )}

        {isFinished && (
          <div className="absolute inset-0 bg-black/98 flex items-center justify-center z-[110] p-6 backdrop-blur-3xl">
            <div className="text-center space-y-12 max-sm">
              <div className="relative inline-block">
                <Trophy className={cn("w-28 h-28 mx-auto", score.accuracy >= PASS_THRESHOLD ? "text-[#FFEA00] drop-shadow-[0_0_50px_rgba(255,234,0,0.5)]" : "text-white/10")} />
                {score.accuracy >= PASS_THRESHOLD && <Sparkles className="absolute -top-4 -right-4 w-10 h-10 text-[#FFEA00] animate-pulse" />}
              </div>
              <div>
                <h2 className="text-5xl font-black uppercase italic tracking-tighter mb-2">
                  {score.accuracy >= PASS_THRESHOLD ? "Gold Mastered" : "Desynced"}
                </h2>
                <p className="text-4xl font-black italic transition-colors duration-500" style={{ color: getAccuracyColor(score.accuracy) }}>
                  {score.accuracy}% Sync
                </p>
              </div>
              <div className="flex gap-4 pt-4">
                <Button onClick={startLevel} variant="outline" className="flex-1 h-18 uppercase font-black italic rounded-[1.5rem] border-white/10 hover:bg-white/5 transition-all">Retry</Button>
                <Link href={`/studio/${game.studioId}`} className="flex-1">
                  <Button className="w-full h-18 bg-white text-black font-black uppercase italic rounded-[1.5rem] shadow-[0_15px_40px_rgba(255,255,255,0.1)]">Return</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
