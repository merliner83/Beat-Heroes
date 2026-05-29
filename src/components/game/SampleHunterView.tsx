
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
import { doc, increment, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';

const PASS_THRESHOLD = 80;
const OBJECT_ICONS: Record<SoundType, any> = { kick: Disc, clap: Music, percs: Radio, misc: Mic };
const OBJECT_COLORS: Record<SoundType, string> = { kick: '#FF3399', clap: '#00FFFF', percs: '#FFEA00', misc: '#3838FA' };

interface GameNote { id: string; sound: Sound; pos: { x: number, y: number }; status: 'active' | 'hit' | 'missed' | 'sucking'; spawnTime: number; }
interface Projectile { id: string; x: number; y: number; vx: number; vy: number; rotation: number; }
interface SampleHunterViewProps { game: Game; level: Level; sounds: Sound[]; }

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

  const SAMPLE_LIFETIME = level.difficulty === 1 ? 3000 : level.difficulty === 2 ? 2200 : level.difficulty === 3 ? 1500 : 900; 

  const spawnNextNote = useCallback(() => {
    if (!sounds.length) return;
    setActiveNote({ id: `note-${Date.now()}`, sound: sounds[Math.floor(Math.random() * sounds.length)], pos: { x: Math.random() * 80 + 10, y: Math.random() * 40 + 5 }, status: 'active', spawnTime: Date.now() });
  }, [sounds]);

  const updateGame = useCallback(() => {
    if (!isPlaying) return;
    const t = audioEngine?.getCurrentTime() || 0;
    if (t >= SESSION_DURATION && !hasStartedFade) { setHasStartedFade(true); audioEngine?.fadeBackingTrack(FADE_DURATION); }
    if (t >= SESSION_DURATION + FADE_DURATION) { setIsPlaying(false); setIsFinished(true); audioEngine?.stop(); return; }
    setProjectiles(prev => {
      const next = prev.map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, rotation: p.rotation + 15 })).filter(p => p.y > -10 && p.x > -10 && p.x < 110);
      if (t < SESSION_DURATION && activeNote?.status === 'active') {
        if (next.some(p => Math.sqrt(Math.pow(p.x - activeNote.pos.x, 2) + Math.pow(p.y - activeNote.pos.y, 2)) < 12)) {
          setActiveNote(n => n ? { ...n, status: 'sucking' } : null);
          audioEngine?.playOneShot(activeNote.sound.sampleUrl);
          setScore(s => { const h = s.hits + 1; return { hits: h, misses: s.misses, accuracy: Math.round((h / (h + s.misses)) * 100) }; });
          setTimeout(spawnNextNote, 600);
        } else if (Date.now() - activeNote.spawnTime > SAMPLE_LIFETIME) {
          setActiveNote(n => (n?.id === activeNote.id ? { ...n, status: 'missed' } : n));
          setScore(s => { const m = s.misses + 1; return { hits: s.hits, misses: m, accuracy: Math.round((s.hits / (s.hits + m)) * 100) }; });
          setTimeout(spawnNextNote, 300);
        }
      }
      return next;
    });
    requestRef.current = requestAnimationFrame(updateGame);
  }, [isPlaying, activeNote, SESSION_DURATION, hasStartedFade, SAMPLE_LIFETIME, spawnNextNote]);

  useEffect(() => { if (isPlaying) requestRef.current = requestAnimationFrame(updateGame); return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); }; }, [isPlaying, updateGame]);

  const startLevel = async () => {
    if (!audioEngine) return;
    setIsLoadingAudio(true); setHasStartedFade(false);
    try {
      await audioEngine.resume();
      await audioEngine.preloadAudio([game.backingTrackUrl || '', ...sounds.map(s => s.sampleUrl), 'https://actions.google.com/sounds/v1/swishes/fast_swish.ogg']);
      setScore({ hits: 0, misses: 0, accuracy: 100 }); setIsFinished(false); setProjectiles([]);
      const start = audioEngine.getContextTime() + (4 * (60 / bpm));
      audioEngine.setStartTime(start);
      await audioEngine.playCountIn(bpm, (beat) => setCountIn(5 - beat));
      setCountIn(null); setIsPlaying(true);
      await audioEngine.startBackingTrack(game.backingTrackUrl || '', start);
      spawnNextNote();
    } catch (e) { toast({ variant: "destructive", title: "Sync Failed" }); } finally { setIsLoadingAudio(false); }
  };

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

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const dx = dragStart.x - dragCurrent.x, dy = dragStart.y - dragCurrent.y;
    if (Math.sqrt(dx*dx + dy*dy) > 30) {
      const rect = containerRef.current?.getBoundingClientRect(), w = rect?.width || 1000, h = rect?.height || 800;
      const angle = Math.atan2(dy, dx), power = Math.min(Math.sqrt(dx*dx + dy*dy) / 10, 40);
      setProjectiles(prev => [...prev, { id: `p-${Date.now()}`, x: MPC_POS.x, y: MPC_POS.y, vx: (Math.cos(angle) * power * (100 / w)) * 1.5, vy: (Math.sin(angle) * power * (100 / h)) * 1.5, rotation: 0 }]);
      audioEngine?.playOneShot('https://actions.google.com/sounds/v1/swishes/fast_swish.ogg');
    }
  };

  const accColor = getAccuracyColor(score.accuracy);
  const pull = isDragging ? { x: (dragStart.x - dragCurrent.x) / 6, y: (dragStart.y - dragCurrent.y) / 6 } : null;

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-2 overflow-hidden select-none relative touch-none">
      <header className="flex justify-between items-center h-14 bg-black/60 backdrop-blur-xl border-b border-white/5 rounded-t-[2.5rem]">
        <div className="flex items-center gap-4"><Link href={`/studio/${game.studioId}`}><ArrowLeft className="w-5 h-5 text-white/40 hover:text-white" /></Link>
          <div className="flex flex-col"><h1 className="text-[10px] font-black uppercase italic text-primary leading-none">VINYL HUNTER</h1><p className="text-[7px] opacity-30 uppercase font-black">{game.name}</p></div>
        </div>
        <div className="bg-black/80 px-5 py-2 rounded-full border border-white/10 flex items-center gap-2 h-10"><Percent className="w-4 h-4" style={{ color: accColor }} /><p className="text-xl font-black italic" style={{ color: accColor }}>{score.accuracy}</p></div>
      </header>
      <main ref={containerRef} onPointerDown={(e) => { if (isPlaying) { setIsDragging(true); setDragStart({ x: e.clientX, y: e.clientY }); setDragCurrent({ x: e.clientX, y: e.clientY }); setShowHint(false); } }} onPointerMove={(e) => { if (isDragging) setDragCurrent({ x: e.clientX, y: e.clientY }); }} onPointerUp={handlePointerUp} className="flex-1 relative overflow-hidden rounded-b-[2.5rem] border-x border-b border-white/5 bg-gradient-to-b from-transparent to-black/40">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        {isDragging && Math.sqrt(Math.pow(dragStart.x - dragCurrent.x, 2) + Math.pow(dragStart.y - dragCurrent.y, 2)) > 20 && (
          <div className="absolute z-10 origin-left pointer-events-none" style={{ left: `${MPC_POS.x}%`, top: `${MPC_POS.y}%`, width: `${Math.min(Math.sqrt(Math.pow(dragStart.x-dragCurrent.x,2)+Math.pow(dragStart.y-dragCurrent.y,2))*2.8, 650)}px`, transform: `rotate(${Math.atan2(dragStart.y-dragCurrent.y, dragStart.x-dragCurrent.x)*(180/Math.PI)}deg)`, height: '240px', marginTop: '-120px', background: 'linear-gradient(90deg, rgba(255, 51, 153, 0.8) 0%, transparent 100%)', clipPath: 'polygon(0 48%, 100% 0, 100% 100%, 0 52%)', filter: 'blur(3px)', opacity: 0.7 }} />
        )}
        <div className="absolute z-50 pointer-events-none transition-all duration-300 w-[280px] sm:w-[480px]" style={{ left: `${MPC_POS.x}%`, top: `${MPC_POS.y}%`, transform: `translate(-50%, -50%) ${pull ? `translate(${-pull.x}px, ${-pull.y}px)` : ''}` }}>
          <div className="relative aspect-[768/429]">
            {isPlaying && showHint && !isDragging && <div className="absolute top-[-80px] left-1/2 -translate-x-1/2 animate-bounce"><MoveDown className="w-10 h-10 text-primary drop-shadow-[0_0_10px_#FF3399]" /></div>}
            <div className="w-full h-full rounded-2xl overflow-hidden border-2 border-white/10 bg-black/80"><Image src={MPC_IMAGE_URL} alt="808" fill className="object-contain p-2" priority /></div>
          </div>
        </div>
        {isPlaying && activeNote && (
          <div className={cn("absolute z-30 flex items-center justify-center transition-all duration-500", activeNote.status === 'sucking' && "scale-0 blur-md", activeNote.status === 'missed' && "opacity-0 scale-90")} style={{ left: activeNote.status === 'sucking' ? `${MPC_POS.x}%` : `${activeNote.pos.x}%`, top: activeNote.status === 'sucking' ? `${MPC_POS.y}%` : `${activeNote.pos.y}%`, transform: 'translate(-50%, -50%)', width: '120px', height: '120px' }}>
            <div className="relative flex items-center justify-center w-full h-full">
              <div className="absolute inset-0 rounded-full blur-[40px] opacity-20 animate-pulse" style={{ backgroundColor: activeNote.status === 'active' ? OBJECT_COLORS[activeNote.sound.type] : (activeNote.status === 'sucking' ? '#00FF66' : '#FF3D00') }} />
              {React.createElement(OBJECT_ICONS[activeNote.sound.type], { className: "w-16 h-16 drop-shadow-xl", style: { color: activeNote.status === 'sucking' ? '#00FF66' : activeNote.status === 'missed' ? '#FF3D00' : OBJECT_COLORS[activeNote.sound.type] } })}
            </div>
          </div>
        )}
        {projectiles.map(p => <div key={p.id} className="absolute z-40 text-white drop-shadow-xl" style={{ left: `${p.x}%`, top: `${p.y}%`, transform: `translate(-50%, -50%) rotate(${p.rotation}deg)` }}><Disc className="w-12 h-12" /></div>)}
        {!isPlaying && !isFinished && countIn === null && (
          <div className="absolute inset-0 bg-black/98 flex items-center justify-center z-[100] backdrop-blur-3xl">
            <Card className="p-12 bg-black/50 border-none gemini-border text-center max-w-sm"><LayoutGrid className="w-12 h-12 text-primary mx-auto mb-8 animate-pulse" /><h2 className="text-3xl font-black mb-3 italic">VINYL HUNTER</h2><p className="text-[10px] uppercase font-bold tracking-[0.4em] opacity-30 mb-6">Capture the Samples</p><Button onClick={startLevel} disabled={isLoadingAudio} className="w-full h-18 bg-white text-black font-black uppercase italic rounded-2xl shadow-xl">{isLoadingAudio ? <Loader2 className="animate-spin" /> : "Initiate Catch"}</Button></Card>
          </div>
        )}
        {countIn !== null && <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none"><div className="text-[12rem] font-black italic text-[#FFEA00] drop-shadow-2xl animate-pulse">{countIn}</div></div>}
        {isFinished && (
          <div className="absolute inset-0 bg-black/98 flex items-center justify-center z-[110] p-6 backdrop-blur-3xl">
            <div className="text-center space-y-10"><Trophy className={cn("w-24 h-24 mx-auto", score.accuracy >= PASS_THRESHOLD ? "text-[#FFEA00]" : "text-white/10")} /><h2 className="text-5xl font-black uppercase italic">{score.accuracy >= PASS_THRESHOLD ? "Gold Mastered" : "Desynced"}</h2><p className="text-4xl font-black italic" style={{ color: getAccuracyColor(score.accuracy) }}>{score.accuracy}% Sync</p>
              <div className="flex gap-4 pt-4"><Button onClick={startLevel} variant="outline" className="flex-1 h-16 rounded-[1.5rem]">Retry</Button><Link href={`/studio/${game.studioId}`} className="flex-1"><Button className="w-full h-16 bg-white text-black rounded-[1.5rem]">Return</Button></Link></div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
