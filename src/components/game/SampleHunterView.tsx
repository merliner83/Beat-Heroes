
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Game, Level, Sound, GameScore, SoundType } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trophy, Loader2, Sparkles, XCircle, Disc, Mic, Speaker, ArrowLeft, Percent, Zap, MoveUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc, increment, setDoc, serverTimestamp } from 'firebase/firestore';

const PASS_THRESHOLD = 80;
const DIFFICULTY_REWARDS: Record<number, number> = { 1: 50, 2: 100, 3: 200, 4: 1000 };
const SAMPLE_LIFETIME = 1500; // Etwas mehr Zeit für Flugzeit-Kompensation
const PROJECTILE_SPEED = 15;

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
  
  // Slingshot State
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragCurrent, setDragCurrent] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(null);
  const TOTAL_NOTES = 20;

  useEffect(() => {
    return () => {
      audioEngine?.stop();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const spawnNextNote = useCallback(() => {
    const totalHandled = score.hits + score.misses;
    if (totalHandled >= TOTAL_NOTES) {
      setIsPlaying(false);
      setIsFinished(true);
      audioEngine?.stop();
      return;
    }

    const randomSound = sounds[Math.floor(Math.random() * sounds.length)];
    const newNote: GameNote = {
      id: `note-${Date.now()}-${Math.random()}`,
      sound: randomSound,
      pos: {
        x: Math.random() * 70 + 15,
        y: Math.random() * 50 + 10 // Eher oberer Bereich für Slingshot-Gameplay
      },
      status: 'active',
      spawnTime: Date.now()
    };
    setActiveNote(newNote);
  }, [sounds, score.hits, score.misses]);

  // Game Loop für Projektile und Kollisionen
  const updateGame = useCallback(() => {
    if (!isPlaying) return;

    setProjectiles(prev => {
      const next = prev.map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        rotation: p.rotation + 15
      })).filter(p => p.y > -50 && p.x > -50 && p.x < 110); // Off-screen culling

      // Collision Detection
      if (activeNote && activeNote.status === 'active') {
        const hitProjectile = next.find(p => {
          const dx = p.x - activeNote.pos.x;
          const dy = p.y - activeNote.pos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          return distance < 8; // Hit-Radius
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
  }, [isPlaying, activeNote]);

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(updateGame);
    } else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, updateGame]);

  const handleHit = (note: GameNote) => {
    setActiveNote(prev => prev ? { ...prev, status: 'hit' } : null);
    audioEngine?.playOneShot(note.sound.sampleUrl);
    setScore(prev => {
      const nextHits = prev.hits + 1;
      const total = nextHits + prev.misses;
      return { hits: nextHits, misses: prev.misses, accuracy: Math.round((nextHits / total) * 100) };
    });
    setTimeout(spawnNextNote, 200);
  };

  const handleMiss = (noteId: string) => {
    setActiveNote(prev => (prev?.id === noteId ? { ...prev, status: 'missed' } : prev));
    setScore(prev => {
      const nextMisses = prev.misses + 1;
      const total = prev.hits + nextMisses;
      return { hits: prev.hits, misses: nextMisses, accuracy: Math.round((prev.hits / total) * 100) };
    });
    setTimeout(spawnNextNote, 300);
  };

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

    if (dist > 10) {
      const angle = Math.atan2(dy, dx);
      const power = Math.min(dist / 10, 25);
      
      const newProjectile: Projectile = {
        id: `p-${Date.now()}`,
        x: 50, // Mitte unten
        y: 90,
        vx: (Math.cos(angle) * power) / 3, // Skalierung für CSS % Einheiten
        vy: (Math.sin(angle) * power) / 3,
        rotation: 0
      };
      
      setProjectiles(prev => [...prev, newProjectile]);
      audioEngine?.playOneShot('https://actions.google.com/sounds/v1/swishes/fast_swish.ogg');
    }
  };

  const startLevel = async () => {
    if (!audioEngine) return;
    setIsLoadingAudio(true);
    try {
      await audioEngine.resume();
      await audioEngine.preloadAudio([game.backingTrackUrl || '', ...sounds.map(s => s.sampleUrl), 'https://actions.google.com/sounds/v1/swishes/fast_swish.ogg']);
      setScore({ hits: 0, misses: 0, accuracy: 100 });
      setIsFinished(false);
      const bpm = game.bpm || 120;
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
      updateDoc(doc(db, 'users', user.uid), { streetCred: increment(reward) });
      setDoc(doc(db, 'users', user.uid, 'progress', level.id), { 
        levelId: level.id, 
        accuracy: score.accuracy, 
        completedAt: serverTimestamp() 
      }, { merge: true });
    }
  }, [isFinished, score.accuracy, user, db, level]);

  const bgUrl = game.backgroundImageUrl || 'https://picsum.photos/seed/beathero-boombox/1080/1920';

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-2 md:p-4 overflow-hidden select-none font-body relative">
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none bg-center bg-no-repeat z-10"
        style={{ 
          backgroundImage: `url(${bgUrl})`,
          backgroundSize: 'contain',
          maskImage: 'radial-gradient(circle at center, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 90%)',
          WebkitMaskImage: 'radial-gradient(circle at center, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 90%)'
        }}
      />
      
      <header className="flex justify-between items-center mb-1 px-4 h-12 shrink-0 z-50 bg-black/40 backdrop-blur-xl border-b border-white/5 rounded-t-3xl">
        <div className="flex items-center gap-3">
          <Link href={`/studio/${game.studioId}`}>
            <ArrowLeft className="w-5 h-5 text-white/50 hover:text-white transition-colors" />
          </Link>
          <div>
            <h1 className="text-[10px] md:text-xs font-black uppercase italic tracking-tighter text-primary leading-none">Vinyl Hunter</h1>
            <p className="text-[7px] md:text-[8px] opacity-40 uppercase font-bold tracking-widest">{game.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-black/60 px-4 py-1.5 rounded-full border border-white/10 h-10 backdrop-blur-md">
            <Percent className="w-4 h-4 text-[#FFEA00]" />
            <p className={cn("text-xl md:text-2xl font-black italic", score.accuracy >= PASS_THRESHOLD ? "text-[#00FF66]" : "text-[#FF3D00]")}>
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
        className="flex-1 relative overflow-hidden rounded-b-3xl border-x border-b border-white/5 z-20 pointer-events-auto touch-none"
      >
        {/* Active Sample Target */}
        {isPlaying && activeNote && (
          <div
            className={cn(
              "absolute z-30 flex items-center justify-center transition-all duration-300",
              activeNote.status === 'hit' && "scale-150 opacity-0 blur-xl",
              activeNote.status === 'missed' && "scale-90 opacity-0 bg-red-500/20"
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
                  "absolute inset-4 rounded-full blur-[30px] opacity-20 transition-all",
                  activeNote.status === 'hit' ? "bg-[#00FF66] opacity-100" : 
                  activeNote.status === 'missed' ? "bg-[#FF3D00] opacity-100" : ""
                )} 
                style={{ backgroundColor: activeNote.status === 'active' ? OBJECT_COLORS[activeNote.sound.type] : undefined }} 
              />
              
              {React.createElement(OBJECT_ICONS[activeNote.sound.type], {
                className: "w-16 h-16 md:w-20 md:h-20 transition-colors duration-150",
                strokeWidth: 1.0,
                style: { 
                  color: activeNote.status === 'hit' ? '#00FF66' : 
                         activeNote.status === 'missed' ? '#FF3D00' : 
                         OBJECT_COLORS[activeNote.sound.type],
                  filter: `drop-shadow(0 0 15px ${
                    activeNote.status === 'hit' ? '#00FF66' : 
                    activeNote.status === 'missed' ? '#FF3D00' : 
                    OBJECT_COLORS[activeNote.sound.type]
                  }66)`
                }
              })}
            </div>
          </div>
        )}

        {/* Flying Projectiles */}
        {projectiles.map(p => (
          <div
            key={p.id}
            className="absolute z-40 text-white/90 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              transform: `translate(-50%, -50%) rotate(${p.rotation}deg)`
            }}
          >
            <Disc className="w-10 h-10 md:w-12 md:h-12" strokeWidth={1.5} />
          </div>
        ))}

        {/* Slingshot Visuals */}
        {isDragging && (
          <div className="absolute inset-0 pointer-events-none z-50">
            <svg className="w-full h-full">
              <line 
                x1="50%" 
                y1="90%" 
                x2={50 - (dragStart.x - dragCurrent.x) / 5 + '%'} 
                y2={90 - (dragStart.y - dragCurrent.y) / 5 + '%'} 
                stroke="white" 
                strokeWidth="2" 
                strokeDasharray="5,5" 
                className="opacity-40"
              />
              <circle 
                cx={50 - (dragStart.x - dragCurrent.x) / 5 + '%'} 
                cy={90 - (dragStart.y - dragCurrent.y) / 5 + '%'} 
                r="4" 
                fill="white" 
                className="opacity-60"
              />
            </svg>
          </div>
        )}

        {/* Launcher UI */}
        {isPlaying && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
            <div className={cn(
              "p-4 rounded-full bg-white/5 border-2 border-white/20 transition-all",
              isDragging ? "scale-90 opacity-40" : "scale-100 animate-pulse-neon"
            )}>
              <Disc className="w-12 h-12 text-white/80" />
            </div>
          </div>
        )}

        {!isPlaying && !isFinished && countIn === null && (
          <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-[100] backdrop-blur-md">
            <Card className="p-10 bg-black/50 border-none gemini-border text-center max-w-sm mx-4 shadow-2xl">
              <div className="bg-primary/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/30">
                <Disc className="w-8 h-8 text-primary animate-spin" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black mb-2 uppercase italic tracking-tighter">Vinyl Hunter</h2>
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-40 mb-8">Pull back & release to fire</p>
              <Button onClick={startLevel} disabled={isLoadingAudio} className="w-full h-16 bg-white text-black font-black uppercase rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.1)]">
                {isLoadingAudio ? <Loader2 className="animate-spin" /> : "Initiate Sync"}
              </Button>
            </Card>
          </div>
        )}

        {countIn !== null && (
          <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
            <div className="text-[10rem] md:text-[15rem] font-black italic text-[#FFEA00] drop-shadow-[0_0_60px_rgba(255,234,0,0.5)]">{countIn}</div>
          </div>
        )}

        {isFinished && (
          <div className="absolute inset-0 bg-black/98 flex items-center justify-center z-[100] p-6 backdrop-blur-2xl">
            <div className="text-center space-y-8 max-w-sm">
              {score.accuracy >= PASS_THRESHOLD ? (
                <>
                  <Trophy className="w-20 h-20 text-[#FFEA00] mx-auto drop-shadow-[0_0_40px_rgba(255,234,0,0.4)]" />
                  <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">Gold Mastered</h2>
                  <p className="text-3xl text-[#00FF66] font-black italic">{score.accuracy}% Sync</p>
                </>
              ) : (
                <>
                  <XCircle className="w-20 h-20 text-[#FF3D00] mx-auto drop-shadow-[0_0_40px_rgba(255,61,0,0.4)]" />
                  <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">Desynced</h2>
                  <p className="text-xl opacity-60 uppercase tracking-[0.3em] font-black">Accuracy failure</p>
                </>
              )}
              <div className="flex gap-4 pt-8">
                <Button onClick={startLevel} variant="outline" className="flex-1 h-14 bg-white/5 hover:bg-white/10 text-xs md:text-sm uppercase font-black italic rounded-2xl">Retry</Button>
                <Link href={`/studio/${game.studioId}`} className="flex-1">
                  <Button className="w-full h-14 bg-white text-black font-black uppercase italic rounded-2xl">Return</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="p-3 text-center shrink-0 z-50 bg-black/40 backdrop-blur-sm border-t border-white/5">
        <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] text-white/10 italic">Slingshot Engine v1.0 • Drag Down to Aim</p>
      </footer>
    </div>
  );
};
