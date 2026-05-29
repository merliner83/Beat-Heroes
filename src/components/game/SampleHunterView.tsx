"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Game, Level, Sound, GameScore, SoundType, getAccuracyColor } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trophy, Loader2, Sparkles, XCircle, LayoutGrid, ArrowLeft, Percent, Disc, Music, Radio, Mic, MoveDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useUser, useFirestore } from '@/firebase';
import { doc, increment, setDoc, serverTimestamp } from 'firebase/firestore';

const PASS_THRESHOLD = 80;
const DIFFICULTY_REWARDS: Record<number, number> = { 1: 50, 2: 100, 3: 200, 4: 1000 };

const OBJECT_ICONS: Record<SoundType, any> = {
  kick: Disc,
  clap: Music,
  percs: Radio,
  misc: Mic,
};

const OBJECT_COLORS: Record<SoundType, string> = {
  kick: '#FF3399',
  clap: '#00FFFF',
  percs: '#FFEA00',
  misc: '#3838FA',
};

interface GameNote {
  id: string;
  sound: Sound;
  pos: { x: number, y: number };
  status: 'active' | 'hit' | 'missed' | 'sucking';
  spawnTime: number;
}

interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
}

interface SampleHunterViewProps {
  game: Game;
  level: Level;
  sounds: Sound[];
}

export const SampleHunterView: React.FC<SampleHunterViewProps> = ({ game, level, sounds }) => {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [countIn, setCountIn] = useState<number | null>(null);
  const [score, setScore] = useState<GameScore>({ hits: 0, misses: 0, accuracy: 100 });
  const [isFinished, setIsFinished] = useState(false);
  
  const [activeNote, setActiveNote] = useState<GameNote | null>(null);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragCurrent, setDragCurrent] = useState({ x: 0, y: 0 });
  const [hasStartedFade, setHasStartedFade] = useState(false);
  const [showHint, setShowHint] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(null);

  const bpm = game.bpm || 128;
  const SESSION_DURATION = (20 * 4 * 60) / bpm; 
  const FADE_DURATION = 2;
  const MPC_POS = { x: 50, y: 75 }; 

  const MPC_IMAGE_URL = "https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/games%2Fio-808-browser-drum-machine-768x429.png?alt=media&token=bfafaecb-2fc6-4010-944a-b033f3082010";

  const SAMPLE_LIFETIME = 
    level.difficulty === 1 ? 3000 : 
    level.difficulty === 2 ? 2200 : 
    level.difficulty === 3 ? 1500 : 900; 

  useEffect(() => {
    return () => {
      audioEngine?.stop();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const spawnNextNote = useCallback(() => {
    if (sounds.length === 0) return;

    const randomSound = sounds[Math.floor(Math.random() * sounds.length)];
    const newNote: GameNote = {
      id: `note-${Date.now()}-${Math.random()}`,
      sound: randomSound,
      pos: {
        x: Math.random() * 80 + 10,
        y: Math.random() * 40 + 5 
      },
      status: 'active',
      spawnTime: Date.now()
    };
    setActiveNote(newNote);
  }, [sounds]);

  const handleHit = useCallback((note: GameNote) => {
    setActiveNote(prev => prev ? { ...prev, status: 'sucking' } : null);
    audioEngine?.playOneShot(note.sound.sampleUrl);
    setScore(prev => {
      const nextHits = prev.hits + 1;
      const total = nextHits + prev.misses;
      return { hits: nextHits, misses: prev.misses, accuracy: Math.round((nextHits / total) * 100) };
    });
    setTimeout(spawnNextNote, 600);
  }, [spawnNextNote]);

  const handleMiss = useCallback((noteId: string) => {
    setActiveNote(prev => (prev?.id === noteId ? { ...prev, status: 'missed' } : prev));
    setScore(prev => {
      const nextMisses = prev.misses + 1;
      const total = prev.hits + nextMisses;
      return { hits: prev.hits, misses: nextMisses, accuracy: total === 0 ? 100 : Math.round((prev.hits / total) * 100) };
    });
    setTimeout(spawnNextNote, 300);
  }, [spawnNextNote]);

  const updateGame = useCallback(() => {
    if (!isPlaying) return;

    const currentTime = audioEngine?.getCurrentTime() || 0;

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

    setProjectiles(prev => {
      const next = prev.map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        rotation: p.rotation + 15
      })).filter(p => p.y > -10 && p.x > -10 && p.x < 110);

      if (currentTime < SESSION_DURATION && activeNote && activeNote.status === 'active') {
        const hitProjectile = next.find(p => {
          const dx = p.x - activeNote.pos.x;
          const dy = p.y - activeNote.pos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          return distance < 12; // Adjust collision radius for percentage coords
        });

        if (hitProjectile) {
          handleHit(activeNote);
        } else if (Date.now() - activeNote.spawnTime > SAMPLE_LIFETIME) {
          handleMiss(activeNote.id);
        }
      }

      return next;
    });

    requestRef.current = requestAnimationFrame(updateGame);
  }, [isPlaying, activeNote, SESSION_DURATION, hasStartedFade, SAMPLE_LIFETIME, handleHit, handleMiss]);

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(updateGame);
    } else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, updateGame]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isPlaying || (audioEngine?.getCurrentTime() || 0) >= SESSION_DURATION) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragCurrent({ x: e.clientX, y: e.clientY });
    if (showHint) setShowHint(false);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      setDragCurrent({ x: e.clientX, y: e.clientY });
    }
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const dx = dragStart.x - dragCurrent.x;
    const dy = dragStart.y - dragCurrent.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 30) {
      const rect = containerRef.current?.getBoundingClientRect();
      const w = rect?.width || 1000;
      const h = rect?.height || 800;

      // Slingshot logic: direction is opposite to pull
      const angle = Math.atan2(dy, dx);
      const powerBase = Math.min(dist / 10, 40);
      
      // Calculate velocities in percentage units per frame
      // Power is scaled to container dimensions to prevent distortion
      const vx = (Math.cos(angle) * powerBase * (100 / w)) * 1.5;
      const vy = (Math.sin(angle) * powerBase * (100 / h)) * 1.5;

      const newProjectile: Projectile = {
        id: `p-${Date.now()}`,
        x: MPC_POS.x,
        y: MPC_POS.y,
        vx,
        vy,
        rotation: 0
      };
      
      setProjectiles(prev => [...prev, newProjectile]);
      audioEngine?.playOneShot('https://actions.google.com/sounds/v1/swishes/fast_swish.ogg');
    }
  };

  const startLevel = async () => {
    if (!audioEngine) return;
    setIsLoadingAudio(true);
    setHasStartedFade(false);
    try {
      await audioEngine.resume();
      await audioEngine.preloadAudio([
        game.backingTrackUrl || '', 
        ...sounds.map(s => s.sampleUrl), 
        'https://actions.google.com/sounds/v1/swishes/fast_swish.ogg'
      ]);
      setScore({ hits: 0, misses: 0, accuracy: 100 });
      setIsFinished(false);
      setProjectiles([]);
      
      const secondsPerBeat = 60 / bpm;
      const now = audioEngine.getContextTime();
      const actualStartTime = now + (4 * secondsPerBeat);
      audioEngine.setStartTime(actualStartTime);
      
      await audioEngine.playCountIn(bpm, (beat) => setCountIn(5 - beat));
      setCountIn(null);
      
      setIsPlaying(true);
      await audioEngine.startBackingTrack(game.backingTrackUrl || '', actualStartTime);
      spawnNextNote();
    } catch (e) {
      toast({ variant: "destructive", title: "Sync Failed" });
    } finally {
      setIsLoadingAudio(false);
    }
  };

  useEffect(() => {
    if (isFinished && score.accuracy >= PASS_THRESHOLD && user && db) {
      const reward = DIFFICULTY_REWARDS[level.difficulty] || 0;
      setDoc(doc(db, 'users', user.uid), { streetCred: increment(reward) }, { merge: true });
      setDoc(doc(db, 'users', user.uid, 'progress', level.id), { 
        levelId: level.id, 
        accuracy: score.accuracy, 
        completedAt: serverTimestamp() 
      }, { merge: true });
    }
  }, [isFinished, score.accuracy, user, db, level]);

  const getAimingLine = () => {
    if (!isDragging) return null;
    const dx = dragStart.x - dragCurrent.x;
    const dy = dragStart.y - dragCurrent.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 20) return null;

    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    return { angle, length: Math.min(dist * 2.8, 650) };
  };

  const aiming = getAimingLine();
  const pull = isDragging ? { 
    x: (dragStart.x - dragCurrent.x) / 6, 
    y: (dragStart.y - dragCurrent.y) / 6 
  } : null;

  const accColor = getAccuracyColor(score.accuracy);

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-2 md:p-4 overflow-hidden select-none font-body relative touch-none">
      <header className="flex justify-between items-center mb-1 px-6 h-14 shrink-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5 rounded-t-[2.5rem] select-none">
        <div className="flex items-center gap-4">
          <Link href={`/studio/${game.studioId}`}>
            <ArrowLeft className="w-5 h-5 text-white/40 hover:text-white transition-all hover:scale-110" />
          </Link>
          <div>
            <h1 className="text-[10px] md:text-xs font-black uppercase italic tracking-tighter text-primary leading-none">VINYL HUNTER</h1>
            <p className="text-[7px] md:text-[8px] opacity-30 uppercase font-black tracking-widest">{game.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-black/80 px-5 py-2 rounded-full border border-white/10 h-10 backdrop-blur-md shadow-2xl">
            <Percent className="w-4 h-4" style={{ color: accColor }} />
            <p className="text-xl md:text-2xl font-black italic tracking-tighter transition-colors duration-500" style={{ color: accColor }}>
              {score.accuracy}
            </p>
          </div>
        </div>
      </header>

      <main 
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex-1 relative overflow-hidden rounded-b-[2.5rem] border-x border-b border-white/5 z-20 pointer-events-auto touch-none bg-gradient-to-b from-transparent to-black/40 select-none"
      >
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

        {aiming && (
          <div 
            className="absolute z-10 origin-left pointer-events-none select-none transition-opacity duration-200"
            style={{ 
              left: `${MPC_POS.x}%`, 
              top: `${MPC_POS.y}%`, 
              width: `${aiming.length}px`,
              transform: `rotate(${aiming.angle}deg)`,
              height: '240px', 
              marginTop: '-120px', 
              background: 'linear-gradient(90deg, rgba(255, 51, 153, 0.8) 0%, rgba(0, 255, 255, 0.3) 60%, transparent 100%)',
              clipPath: 'polygon(0 48%, 100% 0, 100% 100%, 0 52%)',
              boxShadow: '0 0 80px rgba(255, 51, 153, 0.4)',
              opacity: 0.7,
              filter: 'blur(3px)'
            }}
          />
        )}

        <div 
          className="absolute z-50 pointer-events-none transition-all duration-300 select-none w-[280px] sm:w-[380px] md:w-[480px]"
          style={{ 
            left: `${MPC_POS.x}%`, 
            top: `${MPC_POS.y}%`, 
            transform: `translate(-50%, -50%) ${pull ? `translate(${-pull.x}px, ${-pull.y}px)` : ''}`
          }}
        >
          <div className="relative w-full aspect-[768/429] flex items-center justify-center">
            {/* Hint Icon */}
            {isPlaying && showHint && !isDragging && (
              <div className="absolute top-[-80px] left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center animate-bounce">
                <MoveDown className="w-10 h-10 text-primary drop-shadow-[0_0_10px_rgba(255,51,153,0.8)]" />
              </div>
            )}

            <div className="absolute -inset-10 bg-primary/20 blur-[80px] pointer-events-none rounded-full" />
            <div className="relative w-full h-full rounded-2xl overflow-hidden border-2 border-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.9)] bg-black/80">
               <Image 
                  src={MPC_IMAGE_URL}
                  data-ai-hint="drum machine"
                  alt="808 Drummachine"
                  fill
                  className="object-contain p-2"
                  sizes="(max-width: 768px) 100vw, 800px"
                  priority
               />
               <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            </div>
          </div>
        </div>

        {isPlaying && activeNote && (
          <div
            className={cn(
              "absolute z-30 flex items-center justify-center transition-all duration-500 ease-in-out select-none",
              activeNote.status === 'sucking' && "scale-0 blur-md opacity-0",
              activeNote.status === 'missed' && "scale-90 opacity-0 bg-[#FF3D00]/20 rounded-full"
            )}
            style={{ 
              left: activeNote.status === 'sucking' ? `${MPC_POS.x}%` : `${activeNote.pos.x}%`, 
              top: activeNote.status === 'sucking' ? `${MPC_POS.y}%` : `${activeNote.pos.y}%`,
              transform: 'translate(-50%, -50%)',
              width: '120px',
              height: '120px'
            }}
          >
            <div className="relative flex items-center justify-center w-full h-full">
              <div 
                className={cn(
                  "absolute inset-0 rounded-full blur-[40px] opacity-20 transition-all duration-500 animate-pulse",
                  activeNote.status === 'sucking' ? "bg-[#00FF66] opacity-100 scale-150" : 
                  activeNote.status === 'missed' ? "bg-[#FF3D00] opacity-100" : ""
                )} 
                style={{ backgroundColor: activeNote.status === 'active' ? OBJECT_COLORS[activeNote.sound.type] : undefined }} 
              />
              
              {React.createElement(OBJECT_ICONS[activeNote.sound.type], {
                className: "w-16 h-16 md:w-20 md:h-20 transition-all duration-200 drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]",
                strokeWidth: 1.0,
                style: { 
                  color: activeNote.status === 'sucking' ? '#00FF66' : 
                         activeNote.status === 'missed' ? '#FF3D00' : 
                         OBJECT_COLORS[activeNote.sound.type],
                  filter: `drop-shadow(0 0 25px ${
                    activeNote.status === 'sucking' ? '#00FF66' : 
                    activeNote.status === 'missed' ? '#FF3D00' : 
                    OBJECT_COLORS[activeNote.sound.type]
                  }88)`
                }
              })}
            </div>
          </div>
        )}

        {projectiles.map(p => (
          <div
            key={p.id}
            className="absolute z-40 text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.6)] select-none"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              transform: `translate(-50%, -50%) rotate(${p.rotation}deg)`
            }}
          >
            <div className="relative">
              <Disc className="w-12 h-12 md:w-16 md:h-16" strokeWidth={1.2} />
              <div className="absolute inset-2 rounded-full border border-white/20 animate-spin-slow" />
            </div>
          </div>
        ))}

        {!isPlaying && !isFinished && countIn === null && (
          <div className="absolute inset-0 bg-black/98 flex items-center justify-center z-[100] backdrop-blur-3xl select-none">
            <Card className="p-12 bg-black/50 border-none gemini-border text-center max-w-sm mx-4 shadow-[0_0_100px_rgba(255,51,153,0.1)]">
              <div className="bg-primary/20 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 border border-primary/30 shadow-[0_0_40px_rgba(255,51,153,0.2)]">
                <LayoutGrid className="w-12 h-12 text-primary animate-pulse" />
              </div>
              <h2 className="text-3xl md:text-4xl font-black mb-3 uppercase italic tracking-tighter">VINYL HUNTER</h2>
              <p className="text-[10px] uppercase font-bold tracking-[0.4em] opacity-30 mb-6 leading-relaxed">20 Bars Session<br/>Capture as many as you can</p>
              <Button onClick={startLevel} disabled={isLoadingAudio} className="w-full h-18 bg-white text-black font-black uppercase italic rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_20px_60px_rgba(255,255,255,0.1)]">
                {isLoadingAudio ? <Loader2 className="animate-spin" /> : "Initiate Catch"}
              </Button>
            </Card>
          </div>
        )}

        {countIn !== null && (
          <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none select-none">
            <div className="text-[12rem] md:text-[20rem] font-black italic text-[#FFEA00] drop-shadow-[0_0_80px_rgba(255,234,0,0.6)] animate-pulse">
              {countIn}
            </div>
          </div>
        )}

        {isFinished && (
          <div className="absolute inset-0 bg-black/98 flex items-center justify-center z-[110] p-6 backdrop-blur-3xl select-none">
            <div className="text-center space-y-10 max-w-sm">
              {score.accuracy >= PASS_THRESHOLD ? (
                <>
                  <div className="relative inline-block">
                    <Trophy className="w-24 h-24 text-[#FFEA00] mx-auto drop-shadow-[0_0_50px_rgba(255,234,0,0.5)]" />
                    <Sparkles className="absolute -top-4 -right-4 w-8 h-8 text-[#FFEA00] animate-pulse" />
                  </div>
                  <h2 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter">Gold Mastered</h2>
                  <p className="text-4xl font-black italic transition-colors duration-500" style={{ color: getAccuracyColor(score.accuracy) }}>
                    {score.accuracy}% Sync
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="w-24 h-24 text-[#FF3D00] mx-auto drop-shadow-[0_0_50px_rgba(255,61,0,0.5)]" />
                  <h2 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter">Desynced</h2>
                  <p className="text-xl opacity-40 uppercase tracking-[0.4em] font-black italic">Accuracy failure</p>
                </>
              )}
              <div className="flex gap-4 pt-4">
                <Button onClick={startLevel} variant="outline" className="flex-1 h-16 bg-white/5 hover:bg-white/10 text-xs md:text-sm uppercase font-black italic rounded-[1.5rem] border-white/10">Retry</Button>
                <Link href={`/studio/${game.studioId}`} className="flex-1">
                  <Button className="w-full h-16 bg-white text-black font-black uppercase italic rounded-[1.5rem]">Return</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};