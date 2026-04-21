
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Game, Level, Sound, GameScore, SoundType } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trophy, Loader2, Sparkles, XCircle, Disc, Mic, Speaker, ArrowLeft, Percent, LayoutGrid } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore } from '@/firebase';
import { doc, increment, setDoc, serverTimestamp } from 'firebase/firestore';

const PASS_THRESHOLD = 80;
const DIFFICULTY_REWARDS: Record<number, number> = { 1: 50, 2: 100, 3: 200, 4: 1000 };

const OBJECT_ICONS: Record<SoundType, any> = {
  kick: Disc,
  clap: Mic,
  percs: Speaker,
  misc: Sparkles,
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
  status: 'active' | 'hit' | 'missed';
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

  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(null);

  const bpm = game.bpm || 120;
  // 16 Bars = 64 Beats
  const SESSION_DURATION = (64 * 60) / bpm;
  const FADE_DURATION = 2;

  // Difficulty scaling for note lifetime
  const SAMPLE_LIFETIME = level.difficulty === 1 ? 3000 : level.difficulty === 2 ? 2200 : 1500;

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
        y: Math.random() * 45 + 10
      },
      status: 'active',
      spawnTime: Date.now()
    };
    setActiveNote(newNote);
  }, [sounds]);

  const handleHit = useCallback((note: GameNote) => {
    setActiveNote(prev => prev ? { ...prev, status: 'hit' } : null);
    audioEngine?.playOneShot(note.sound.sampleUrl);
    setScore(prev => {
      const nextHits = prev.hits + 1;
      const total = nextHits + prev.misses;
      return { hits: nextHits, misses: prev.misses, accuracy: Math.round((nextHits / total) * 100) };
    });
    setTimeout(spawnNextNote, 200);
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

    // Session end
    if (currentTime >= SESSION_DURATION) {
      setIsPlaying(false);
      setIsFinished(true);
      audioEngine?.stop();
      return;
    }

    // Fade out backing track towards the end
    if (currentTime >= SESSION_DURATION - FADE_DURATION && !hasStartedFade) {
      setHasStartedFade(true);
      audioEngine?.fadeBackingTrack(FADE_DURATION);
    }

    setProjectiles(prev => {
      const next = prev.map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        rotation: p.rotation + 15
      })).filter(p => p.y > -10 && p.x > -10 && p.x < 110);

      // Collision detection with projectiles
      if (activeNote && activeNote.status === 'active') {
        const hitProjectile = next.find(p => {
          const dx = p.x - activeNote.pos.x;
          const dy = p.y - activeNote.pos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          return distance < 12; // Collision radius
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
    if (!isPlaying) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragCurrent({ x: e.clientX, y: e.clientY });
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
      const angle = Math.atan2(dy, dx);
      const power = Math.min(dist / 8, 35);
      
      const newProjectile: Projectile = {
        id: `p-${Date.now()}`,
        x: 50,
        y: 75,
        vx: (Math.cos(angle) * power) / 2.5,
        vy: (Math.sin(angle) * power) / 2.5,
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
      
      const secondsPerBeat = 60 / bpm;
      const now = audioEngine.getContextTime();
      const actualStartTime = now + (4 * secondsPerBeat);
      audioEngine.setStartTime(actualStartTime);
      
      await audioEngine.playCountIn(bpm, (beat) => setCountIn(5 - beat));
      setCountIn(null);
      
      // Order matters here for the spawnNextNote dependency
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

  const getPullVisuals = () => {
    if (!isDragging) return null;
    const dx = (dragStart.x - dragCurrent.x) / 5;
    const dy = (dragStart.y - dragCurrent.y) / 5;
    const limit = 25;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const scale = dist > limit ? limit / dist : 1;
    return { x: dx * scale, y: dy * scale };
  };

  const pull = getPullVisuals();
  const bgUrl = game.backgroundImageUrl || 'https://picsum.photos/seed/beathero-boombox/1080/1920';

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-2 md:p-4 overflow-hidden select-none font-body relative">
      <div 
        className="absolute inset-0 opacity-15 pointer-events-none bg-center bg-no-repeat z-10"
        style={{ 
          backgroundImage: `url(${bgUrl})`,
          backgroundSize: 'contain',
          maskImage: 'radial-gradient(circle at center, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 90%)',
          WebkitMaskImage: 'radial-gradient(circle at center, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 90%)'
        }}
      />
      
      <header className="flex justify-between items-center mb-1 px-6 h-14 shrink-0 z-50 bg-black/60 backdrop-blur-2xl border-b border-white/5 rounded-t-[2.5rem]">
        <div className="flex items-center gap-4">
          <Link href={`/studio/${game.studioId}`}>
            <ArrowLeft className="w-5 h-5 text-white/40 hover:text-white transition-all hover:scale-110" />
          </Link>
          <div>
            <h1 className="text-[10px] md:text-xs font-black uppercase italic tracking-tighter text-primary leading-none">Vinyl Hunter</h1>
            <p className="text-[7px] md:text-[8px] opacity-30 uppercase font-black tracking-widest">{game.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-black/80 px-5 py-2 rounded-full border border-white/10 h-10 backdrop-blur-md shadow-2xl">
            <Percent className="w-4 h-4 text-[#FFEA00]" />
            <p className={cn("text-xl md:text-2xl font-black italic tracking-tighter", score.accuracy >= PASS_THRESHOLD ? "text-[#00FF66]" : "text-[#FF3D00]")}>
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
        className="flex-1 relative overflow-hidden rounded-b-[2.5rem] border-x border-b border-white/5 z-20 pointer-events-auto touch-none bg-gradient-to-b from-transparent to-black/40"
      >
        {isPlaying && activeNote && (
          <div
            className={cn(
              "absolute z-30 flex items-center justify-center transition-all duration-300",
              activeNote.status === 'hit' && "scale-150 opacity-0 blur-xl",
              activeNote.status === 'missed' && "scale-90 opacity-0 bg-[#FF3D00]/20 rounded-full"
            )}
            style={{ 
              left: `${activeNote.pos.x}%`, 
              top: `${activeNote.pos.y}%`,
              transform: 'translate(-50%, -50%)',
              width: '120px',
              height: '120px'
            }}
          >
            <div className="relative flex items-center justify-center w-full h-full">
              <div 
                className={cn(
                  "absolute inset-0 rounded-full blur-[40px] opacity-20 transition-all duration-500 animate-pulse",
                  activeNote.status === 'hit' ? "bg-[#00FF66] opacity-100" : 
                  activeNote.status === 'missed' ? "bg-[#FF3D00] opacity-100" : ""
                )} 
                style={{ backgroundColor: activeNote.status === 'active' ? OBJECT_COLORS[activeNote.sound.type] : undefined }} 
              />
              
              {React.createElement(OBJECT_ICONS[activeNote.sound.type], {
                className: "w-16 h-16 md:w-20 md:h-20 transition-all duration-200 drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]",
                strokeWidth: 1.0,
                style: { 
                  color: activeNote.status === 'hit' ? '#00FF66' : 
                         activeNote.status === 'missed' ? '#FF3D00' : 
                         OBJECT_COLORS[activeNote.sound.type],
                  filter: `drop-shadow(0 0 25px ${
                    activeNote.status === 'hit' ? '#00FF66' : 
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
            className="absolute z-40 text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.6)]"
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

        <div className="absolute inset-0 pointer-events-none z-50">
          <svg className="w-full h-full">
            <circle cx="43%" cy="75%" r="3" fill="#333" />
            <circle cx="57%" cy="75%" r="3" fill="#333" />
            
            {isDragging && pull && (
              <>
                <line 
                  x1="43%" y1="75%" 
                  x2={`${50 + pull.x}%`} y2={`${75 + pull.y}%`} 
                  stroke="#00FF66" strokeWidth="2.5" opacity="0.6"
                />
                <line 
                  x1="57%" y1="75%" 
                  x2={`${50 + pull.x}%`} y2={`${75 + pull.y}%`} 
                  stroke="#00FF66" strokeWidth="2.5" opacity="0.6"
                />
                <line 
                  x1="50%" y1="75%" 
                  x2={`${50 - pull.x * 3}%`} y2={`${75 - pull.y * 3}%`} 
                  stroke="white" strokeWidth="1" strokeDasharray="4,8" opacity="0.15"
                />
              </>
            )}
          </svg>
        </div>

        {isPlaying && (
          <div 
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50"
            style={{
              transform: `translate(-50%, ${isDragging && pull ? pull.y * 1.5 : 0}px) translateX(${isDragging && pull ? pull.x * 1.5 : 0}px)`
            }}
          >
            <div className="relative flex flex-col items-center">
              <div className={cn(
                "relative w-32 h-28 md:w-40 md:h-36 bg-neutral-900 border-2 rounded-xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.8)] transition-all duration-75",
                isDragging ? "border-[#00FF66] bg-neutral-900/90 scale-95" : "border-white/10"
              )}>
                <div className="w-full h-1/4 bg-black/60 rounded border border-white/5 mb-3 flex items-center justify-center overflow-hidden">
                   <div className="w-full h-[2px] bg-[#00FF66]/20 animate-pulse" />
                </div>
                
                <div className="grid grid-cols-4 gap-1.5 h-3/5">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "rounded-sm border border-white/5 transition-all duration-75",
                        isDragging ? "bg-[#00FF66]/20 shadow-[0_0_5px_#00FF6622]" : "bg-neutral-800"
                      )} 
                    />
                  ))}
                </div>
              </div>

              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                <Disc className={cn(
                  "w-12 h-12 md:w-16 md:h-16 transition-all",
                  isDragging ? "text-[#00FF66] opacity-100 scale-110 drop-shadow-[0_0_15px_#00FF66]" : "text-white/40 opacity-0"
                )} />
              </div>
            </div>
          </div>
        )}

        {!isPlaying && !isFinished && countIn === null && (
          <div className="absolute inset-0 bg-black/98 flex items-center justify-center z-[100] backdrop-blur-3xl">
            <Card className="p-12 bg-black/50 border-none gemini-border text-center max-w-sm mx-4 shadow-[0_0_100px_rgba(255,51,153,0.1)]">
              <div className="bg-primary/20 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 border border-primary/30 shadow-[0_0_40px_rgba(255,51,153,0.2)]">
                <LayoutGrid className="w-12 h-12 text-primary animate-pulse" />
              </div>
              <h2 className="text-3xl md:text-4xl font-black mb-3 uppercase italic tracking-tighter">Vinyl Hunter</h2>
              <p className="text-[10px] uppercase font-bold tracking-[0.4em] opacity-30 mb-6 leading-relaxed">16 Bars Session<br/>Capture as many as you can</p>
              <Button onClick={startLevel} disabled={isLoadingAudio} className="w-full h-18 bg-white text-black font-black uppercase italic rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_20px_60px_rgba(255,255,255,0.1)]">
                {isLoadingAudio ? <Loader2 className="animate-spin" /> : "Initiate MPC"}
              </Button>
            </Card>
          </div>
        )}

        {countIn !== null && (
          <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
            <div className="text-[12rem] md:text-[20rem] font-black italic text-[#FFEA00] drop-shadow-[0_0_80px_rgba(255,234,0,0.6)] animate-pulse">
              {countIn}
            </div>
          </div>
        )}

        {isFinished && (
          <div className="absolute inset-0 bg-black/98 flex items-center justify-center z-[110] p-6 backdrop-blur-3xl">
            <div className="text-center space-y-10 max-w-sm">
              {score.accuracy >= PASS_THRESHOLD ? (
                <>
                  <div className="relative inline-block">
                    <Trophy className="w-24 h-24 text-[#FFEA00] mx-auto drop-shadow-[0_0_50px_rgba(255,234,0,0.5)]" />
                    <Sparkles className="absolute -top-4 -right-4 w-8 h-8 text-[#FFEA00] animate-pulse" />
                  </div>
                  <h2 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter">Gold Mastered</h2>
                  <p className="text-4xl text-[#00FF66] font-black italic">{score.accuracy}% Sync</p>
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

      <footer className="p-4 text-center shrink-0 z-50 bg-black/40 backdrop-blur-md border-t border-white/5 rounded-b-[2.5rem]">
        <div className="flex items-center justify-center gap-4 opacity-20">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.5em] italic">MPC Slingshot v3.0 • Release to Fire</p>
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        </div>
      </footer>
    </div>
  );
};
