
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Game, Level, Sound, GameScore } from '@/lib/game/types';
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
  spawnTime: number;
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
  const [targetHits, setTargetHits] = useState<Record<string, number>>({});
  const [hasStartedFade, setHasStartedFade] = useState(false);

  const frameRef = useRef<number>(null);
  const lastSpawnRef = useRef<number>(0);

  const bpm = game.bpm || 128;
  const SESSION_DURATION = (24 * 4 * 60) / bpm; // 24 Bars
  const FADE_DURATION = 2;
  const FLIGHT_TIME = 1500; // ms to reach target

  useEffect(() => {
    return () => {
      audioEngine?.stop();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const spawnItem = useCallback(() => {
    const targetIdx = Math.floor(Math.random() * Math.min(level.difficulty, TARGETS.length));
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
      spawnTime: Date.now(),
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

    const spawnInterval = (60 / bpm) * 1000;
    if (now - lastSpawnRef.current > spawnInterval && currentTime < SESSION_DURATION) {
      spawnItem();
      lastSpawnRef.current = now;
    }

    setActiveItems(prev => {
      const next = prev.map(item => {
        if (item.status === 'active' && now - item.startTime > FLIGHT_TIME + 250) {
          handleMiss(item.id);
          return { ...item, status: 'missed' as const };
        }
        return item;
      }).filter(item => item.status === 'active');
      return next;
    });

    frameRef.current = requestAnimationFrame(updateGame);
  }, [isPlaying, bpm, SESSION_DURATION, hasStartedFade, spawnItem]);

  useEffect(() => {
    if (isPlaying) {
      frameRef.current = requestAnimationFrame(updateGame);
    } else if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [isPlaying, updateGame]);

  const handleHit = (itemId: string, targetId: string) => {
    const now = Date.now();
    setActiveItems(prev => {
      const item = prev.find(i => i.id === itemId);
      if (!item || item.status !== 'active') return prev;

      const timeInFlight = now - item.startTime;
      const precision = Math.abs(timeInFlight - FLIGHT_TIME);
      
      const tolerance = level.difficulty >= 3 ? 180 : 280;

      if (precision <= tolerance) {
        setScore(s => {
          const nextHits = s.hits + 1;
          const total = nextHits + s.misses;
          return { ...s, hits: nextHits, accuracy: Math.round((nextHits / total) * 100) };
        });
        setTargetHits(p => ({ ...p, [targetId]: Date.now() }));
        audioEngine?.playOneShot(sounds[0]?.sampleUrl || 'https://actions.google.com/sounds/v1/impacts/wood_block_impact.ogg');
        return prev.filter(i => i.id !== itemId);
      } else {
        handleMiss(itemId);
        return prev.filter(i => i.id !== itemId);
      }
    });
  };

  const handleMiss = (itemId: string) => {
    setScore(s => {
      const nextMisses = s.misses + 1;
      const total = s.hits + nextMisses;
      return { ...s, misses: nextMisses, accuracy: Math.round((s.hits / total) * 100) };
    });
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
      setDoc(doc(db, 'users', user.uid), { streetCred: increment(350) }, { merge: true });
    }
  }, [isFinished, score.accuracy, user, db, level]);

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-4 overflow-hidden select-none font-body relative">
      <header className="flex justify-between items-center mb-1 px-6 h-14 shrink-0 z-50 bg-black/60 backdrop-blur-2xl border-b border-white/5 rounded-t-[2.5rem]">
        <div className="flex items-center gap-4">
          <Link href={`/studio/${game.studioId}`}>
            <ArrowLeft className="w-5 h-5 text-white/40 hover:text-white transition-all hover:scale-110" />
          </Link>
          <div>
            <h1 className="text-xs font-black uppercase italic tracking-tighter text-primary">Sonic Dash</h1>
            <p className="text-[8px] opacity-30 uppercase font-black tracking-widest">{game.name}</p>
          </div>
        </div>
        <div className="bg-black/80 px-5 py-2 rounded-full border border-white/10 flex items-center gap-2 h-10 shadow-2xl">
          <Percent className="w-4 h-4 text-[#FFEA00]" />
          <p className={cn("text-xl font-black italic tracking-tighter", score.accuracy >= PASS_THRESHOLD ? "text-[#00FF66]" : "text-[#FF3D00]")}>{score.accuracy}</p>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden rounded-b-[2.5rem] bg-black/40 border-x border-b border-white/5 z-20">
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, #FF3399 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        
        {TARGETS.map(t => {
          const isGlowing = targetHits[t.id] && Date.now() - targetHits[t.id] < 350;
          return (
            <div
              key={t.id}
              className="absolute w-32 h-32 md:w-40 md:h-40 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-all duration-500"
              style={{ left: `${t.x}%`, top: `${t.y}%` }}
            >
              <div 
                className={cn(
                  "absolute inset-0 rounded-full border-2 transition-all duration-300",
                  isGlowing ? "scale-125 opacity-100 border-4" : "opacity-20 scale-100"
                )}
                style={{ 
                  borderColor: t.color, 
                  boxShadow: isGlowing ? `0 0 60px ${t.color}` : 'none' 
                }}
              />
              <div className="relative">
                 <Circle className="w-10 h-10 opacity-10 animate-pulse" style={{ color: t.color }} />
                 <div className="absolute inset-0 bg-white/5 rounded-full blur-xl" />
              </div>
            </div>
          );
        })}

        {activeItems.map(item => {
          const target = TARGETS.find(t => t.id === item.targetId)!;
          const elapsed = Date.now() - item.startTime;
          const progress = Math.min(elapsed / FLIGHT_TIME, 1.3);
          
          const curX = item.startX + (target.x - item.startX) * progress;
          const curY = item.startY + (target.y - item.startY) * progress;
          const Icon = DASH_ICONS[item.iconIdx];

          const scale = progress < 0.1 ? progress * 10 : progress > 0.9 ? 1 + (progress - 0.9) * 2 : 1;

          return (
            <div
              key={item.id}
              onClick={() => handleHit(item.id, item.targetId)}
              className="absolute z-40 cursor-pointer transition-transform group"
              style={{ 
                left: `${curX}%`, 
                top: `${curY}%`, 
                transform: `translate(-50%, -50%) scale(${scale})`,
                color: target.color,
                filter: `drop-shadow(0 0 20px ${target.color}cc)`
              }}
            >
              <div className="relative">
                <Icon className="w-14 h-14 md:w-20 md:h-20 animate-spin-slow" strokeWidth={1.5} />
                <div 
                  className="absolute inset-0 blur-lg opacity-40 animate-pulse rounded-full"
                  style={{ backgroundColor: target.color }}
                />
              </div>
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
                <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-2">Sonic Dash</h2>
                <p className="text-[10px] uppercase font-bold tracking-[0.4em] opacity-30 leading-relaxed">Rhythm Pulse Activated<br/>Sync elements to zones</p>
              </div>
              <Button onClick={startLevel} disabled={isLoadingAudio} className="w-full h-20 bg-white text-black font-black uppercase italic rounded-[2rem] hover:scale-105 active:scale-95 transition-all shadow-[0_20px_60px_rgba(255,255,255,0.1)]">
                {isLoadingAudio ? <Loader2 className="animate-spin" /> : "Initiate Dash"}
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
            <div className="text-center space-y-12 max-w-sm">
              <div className="relative inline-block">
                <Trophy className={cn("w-28 h-28 mx-auto", score.accuracy >= PASS_THRESHOLD ? "text-[#FFEA00] drop-shadow-[0_0_50px_rgba(255,234,0,0.5)]" : "text-white/10")} />
                {score.accuracy >= PASS_THRESHOLD && <Sparkles className="absolute -top-4 -right-4 w-10 h-10 text-[#FFEA00] animate-pulse" />}
              </div>
              <div>
                <h2 className="text-5xl font-black uppercase italic tracking-tighter mb-2">
                  {score.accuracy >= PASS_THRESHOLD ? "Gold Mastered" : "Desynced"}
                </h2>
                <p className={cn("text-4xl font-black italic", score.accuracy >= PASS_THRESHOLD ? "text-[#00FF66]" : "text-[#FF3D00]")}>
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
