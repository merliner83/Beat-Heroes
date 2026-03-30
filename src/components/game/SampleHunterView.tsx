
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Game, Level, Sound, GameScore, SoundType } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trophy, Loader2, Sparkles, XCircle, Disc, Mic, Speaker, ArrowLeft, Percent, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc, increment, setDoc, serverTimestamp } from 'firebase/firestore';

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
  const [hasAwardedPoints, setHasAwardedPoints] = useState(false);
  
  const [activeNote, setActiveNote] = useState<GameNote | null>(null);
  const [hitNotes, setHitNotes] = useState<Set<string>>(new Set());
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);

  const TOTAL_NOTES = 20; // Number of items to catch in one session

  useEffect(() => {
    const preload = async () => {
      if (!audioEngine) return;
      const urls = [game.backingTrackUrl || '', ...sounds.map(s => s.sampleUrl)];
      try { await audioEngine.preloadAudio(urls); } catch (e) {}
    };
    preload();
  }, [sounds, game.backingTrackUrl]);

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
        x: Math.random() * 80 + 10,
        y: Math.random() * 80 + 10
      }
    };
    setActiveNote(newNote);
  }, [sounds, score.hits, score.misses]);

  const handleCatch = useCallback((note: GameNote) => {
    if (hitNotes.has(note.id)) return;
    
    setHitNotes(prev => new Set(prev).add(note.id));
    audioEngine?.playOneShot(note.sound.sampleUrl);
    
    setScore(prev => {
      const nextHits = prev.hits + 1;
      const total = nextHits + prev.misses;
      return { hits: nextHits, misses: prev.misses, accuracy: Math.round((nextHits / total) * 100) };
    });

    // Sofort das nächste spawnen
    setTimeout(() => {
      spawnNextNote();
    }, 150);
  }, [hitNotes, spawnNextNote]);

  const startLevel = async () => {
    if (!audioEngine) return;
    setIsLoadingAudio(true);
    try {
      await audioEngine.resume();
      await audioEngine.preloadAudio([game.backingTrackUrl || '', ...sounds.map(s => s.sampleUrl)]);
      
      setHitNotes(new Set());
      setScore({ hits: 0, misses: 0, accuracy: 100 });
      setIsFinished(false);
      setHasAwardedPoints(false);
      
      const bpm = game.bpm || 120;
      const secondsPerBeat = 60 / bpm;
      const now = audioEngine.getContextTime();
      const actualStartTime = now + (4 * secondsPerBeat);
      audioEngine.setStartTime(actualStartTime);
      
      await audioEngine.playCountIn(bpm, (beat) => setCountIn(5 - beat));
      setCountIn(null);
      setIsPlaying(true);
      setSessionStartTime(Date.now());
      
      await audioEngine.startBackingTrack(game.backingTrackUrl || '', actualStartTime);
      spawnNextNote();
    } catch (e) {
      toast({ variant: "destructive", title: "Audio Sync Failed" });
    } finally {
      setIsLoadingAudio(false);
    }
  };

  useEffect(() => {
    if (isFinished && score.accuracy >= PASS_THRESHOLD && !hasAwardedPoints && user && db) {
      const reward = DIFFICULTY_REWARDS[level.difficulty] || 0;
      updateDoc(doc(db, 'users', user.uid), { streetCred: increment(reward) });
      setDoc(doc(db, 'users', user.uid, 'progress', level.id), { 
        levelId: level.id, 
        accuracy: score.accuracy, 
        completedAt: serverTimestamp() 
      }, { merge: true });
      setHasAwardedPoints(true);
    }
  }, [isFinished, score.accuracy, hasAwardedPoints, user, db, level]);

  const bgUrl = game.backgroundImageUrl || 'https://picsum.photos/seed/beathero-boombox/1080/1920';

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-2 md:p-4 overflow-hidden select-none font-body relative">
      {/* Background with Vignette Fade */}
      <div 
        className="absolute inset-0 opacity-30 pointer-events-none bg-center bg-no-repeat z-10"
        style={{ 
          backgroundImage: `url(${bgUrl})`,
          backgroundSize: 'contain',
          maskImage: 'radial-gradient(circle at center, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 90%)',
          WebkitMaskImage: 'radial-gradient(circle at center, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 90%)'
        }}
      />
      
      <header className="flex justify-between items-center mb-1 px-2 h-10 md:h-12 shrink-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-2">
          <Link href={`/studio/${game.studioId}`}>
            <ArrowLeft className="w-4 h-4 text-white/50 hover:text-white" />
          </Link>
          <div>
            <h1 className="text-[10px] md:text-xs font-black uppercase italic tracking-tighter text-primary leading-none">Sample Catcher</h1>
            <p className="text-[7px] md:text-[8px] opacity-40 uppercase font-bold tracking-widest">{game.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-black/60 px-3 py-1 rounded-full border border-white/10 h-8 md:h-10 backdrop-blur-md">
            <Percent className="w-3 h-3 text-[#FFEA00]" />
            <p className={cn("text-sm md:text-2xl font-black italic", score.accuracy >= PASS_THRESHOLD ? "text-[#00FF66]" : "text-[#FF3D00]")}>
              {score.accuracy}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden rounded-2xl md:rounded-[3rem] border border-white/5 z-20 pointer-events-auto">
        {isPlaying && activeNote && (
          <div
            key={activeNote.id}
            onPointerDown={(e) => { 
              e.preventDefault(); 
              e.stopPropagation(); 
              handleCatch(activeNote); 
            }}
            className={cn(
              "absolute z-30 pointer-events-auto cursor-pointer select-none touch-none flex items-center justify-center transition-all duration-150",
              hitNotes.has(activeNote.id) && "scale-110 opacity-0"
            )}
            style={{ 
              left: `${activeNote.pos.x}%`, 
              top: `${activeNote.pos.y}%`,
              transform: 'translate(-50%, -50%)',
              width: '180px',
              height: '180px',
              backgroundColor: 'rgba(255,255,255,0.01)' // Transparent but solid for hit detection
            }}
          >
            <div className="relative pointer-events-none flex items-center justify-center w-full h-full">
              {/* Hit Highlight Glow */}
              <div 
                className={cn(
                  "absolute inset-8 rounded-full blur-[40px] opacity-20 transition-all",
                  hitNotes.has(activeNote.id) ? "bg-[#00FF66] opacity-100" : ""
                )} 
                style={{ backgroundColor: hitNotes.has(activeNote.id) ? undefined : OBJECT_COLORS[activeNote.sound.type] }} 
              />
              
              {/* Glossy Icon Rendering */}
              <div className="relative flex items-center justify-center">
                {React.createElement(OBJECT_ICONS[activeNote.sound.type], {
                  className: "w-24 h-24 md:w-32 md:h-32 transition-colors duration-75",
                  strokeWidth: 0.8,
                  style: { 
                    color: hitNotes.has(activeNote.id) ? '#00FF66' : OBJECT_COLORS[activeNote.sound.type],
                    filter: `drop-shadow(0 0 10px ${hitNotes.has(activeNote.id) ? '#00FF66' : OBJECT_COLORS[activeNote.sound.type]}44)`
                  }
                })}
                
                {/* Static Glossy Rim Light */}
                {!hitNotes.has(activeNote.id) && (
                  <div className="absolute inset-0 pointer-events-none opacity-40">
                    <div className="absolute top-[5%] left-[15%] w-[70%] h-[30%] bg-gradient-to-b from-white/60 to-transparent rounded-full blur-[1px]" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* HUD: Start Screen */}
        {!isPlaying && !isFinished && countIn === null && (
          <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-50 backdrop-blur-md">
            <Card className="p-10 bg-black/50 border-none gemini-border text-center max-w-sm mx-4 shadow-2xl">
              <div className="bg-primary/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/30">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black mb-2 uppercase italic tracking-tighter">Sample Catcher</h2>
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-40 mb-8">Urban Precision Interface</p>
              <Button onClick={startLevel} disabled={isLoadingAudio} className="w-full h-16 bg-white text-black font-black uppercase rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.1)]">
                {isLoadingAudio ? <Loader2 className="animate-spin" /> : "Initiate Sync"}
              </Button>
            </Card>
          </div>
        )}

        {/* HUD: Count In */}
        {countIn !== null && (
          <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
            <div className="text-[10rem] md:text-[15rem] font-black italic text-[#FFEA00] drop-shadow-[0_0_60px_rgba(255,234,0,0.5)]">{countIn}</div>
          </div>
        )}

        {/* HUD: Finished Screen */}
        {isFinished && (
          <div className="absolute inset-0 bg-black/98 flex items-center justify-center z-50 p-6 backdrop-blur-2xl">
            <div className="text-center space-y-8 max-w-sm">
              {score.accuracy >= PASS_THRESHOLD ? (
                <>
                  <Trophy className="w-20 h-20 text-[#FFEA00] mx-auto drop-shadow-[0_0_40px_rgba(255,234,0,0.4)]" />
                  <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">Session Synced</h2>
                  <p className="text-3xl text-[#00FF66] font-black italic">{score.accuracy}% Sync</p>
                </>
              ) : (
                <>
                  <XCircle className="w-20 h-20 text-[#FF3D00] mx-auto drop-shadow-[0_0_40px_rgba(255,61,0,0.4)]" />
                  <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">Desynced</h2>
                  <p className="text-xl opacity-60 uppercase tracking-[0.3em] font-black">Sync failure</p>
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
        <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] text-white/10 italic">Urban Sequential Interface v15.0</p>
      </footer>
    </div>
  );
};
