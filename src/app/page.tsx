"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, setDoc } from 'firebase/firestore';
import { Radio, RefreshCw, Loader2, Map as MapIcon, Zap } from 'lucide-react';
import { Studio } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { useAuth } from '@/firebase/provider';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

const STUDIO_COORDS: Record<string, { x: number, y: number }> = {
  'gabriel-beats': { x: 20, y: 12 },
  'yoan-beats': { x: 80, y: 12 },
  'noxxos': { x: 50, y: 18 },
  'dave-beats': { x: 25, y: 35 },
  'nintu-music': { x: 75, y: 35 },
  'dj-avox': { x: 35, y: 50 },
  'benjamin-beats': { x: 65, y: 50 },
};

const StudioHouseFrame = ({ color, studioName }: { color: string, studioName: string }) => (
  <div className="relative flex flex-col items-center group cursor-pointer">
    <div 
      className="relative w-28 h-28 md:w-32 md:h-32 transition-all duration-500 group-hover:scale-110 group-hover:-rotate-1 overflow-hidden"
      style={{ 
        clipPath: 'polygon(50% 0%, 100% 35%, 100% 100%, 0% 100%, 0% 35%)',
        padding: '2px',
        backgroundImage: `linear-gradient(90deg, ${color}, #222, ${color}, #222, ${color})`,
        backgroundSize: '200% 100%',
        animation: 'border-rotate 4s linear infinite'
      }}
    >
      <div 
        className="w-full h-full bg-[#0a0a0a] overflow-hidden relative"
        style={{ clipPath: 'polygon(50% 0%, 100% 35%, 100% 100%, 0% 100%, 0% 35%)' }}
      >
        <div 
          className="absolute inset-0 blur-2xl opacity-10 group-hover:opacity-40 transition-opacity duration-700" 
          style={{ backgroundColor: color }} 
        />
        
        <Avatar className="w-full h-full rounded-none border-none bg-black">
          <AvatarImage 
            src={`https://picsum.photos/seed/${studioName}-dark/600/800`} 
            className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-110 brightness-[0.3] contrast-[1.1] grayscale-[0.5]"
            data-ai-hint="dark building"
          />
          <AvatarFallback className="bg-black text-white/10 font-black italic text-2xl rounded-none">
            {studioName.substring(0,1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />
      </div>
    </div>

    <div className="mt-3 text-center pointer-events-none">
      <h3 className="text-[10px] md:text-xs font-black uppercase italic tracking-tighter text-white/90 drop-shadow-[0_4px_10px_rgba(0,0,0,1)] group-hover:text-primary transition-colors leading-none">
        {studioName}
      </h3>
    </div>
  </div>
);

export default function HomePage() {
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser();
  const { toast } = useToast();
  
  useEffect(() => {
    if (!user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, auth]);

  const userDocRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);
  
  const { data: userProfile } = useDoc<any>(userDocRef);
  const streetCred = userProfile?.streetCred || 0;

  const studiosQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'studios'));
  }, [db]);

  const { data: allStudios, isLoading: isLoadingStudios } = useCollection<Studio>(studiosQuery);

  const setupStudios = async () => {
    if (!db) return;
    try {
      const studios = [
        { id: 'gabriel-beats', name: 'Gabriel Beats', description: 'Urban grooves and heavy bass.', coverColor: '#FF3399' },
        { id: 'yoan-beats', name: 'Yoan Beats', description: 'Electronic textures and clean rhythm.', coverColor: '#FFEA00' },
        { id: 'noxxos', name: 'Noxxos', description: 'Experimental soundscapes.', coverColor: '#FF3D00' },
        { id: 'dave-beats', name: 'Dave Beats', description: 'Heavy boom bap.', coverColor: '#FF9100' },
        { id: 'nintu-music', name: 'Nintu Music', description: 'Deep house and tech vibes.', coverColor: '#00E676' },
        { id: 'dj-avox', name: 'DJ Avox', description: 'Deep house and vocal grooves.', coverColor: '#00B0FF' },
        { id: 'benjamin-beats', name: 'Benjamin Beats', description: 'Classic hip-hop and soul.', coverColor: '#FF6D00' }
      ];

      for (const s of studios) {
        await setDoc(doc(db, 'studios', s.id), s, { merge: true });
      }

      // --- GLOBAL PATTERNS (32 Bars = 512 Steps) ---
      const patterns = [
        { id: 'pattern-p1', name: 'Kick 32', steps: Array.from({ length: 128 }, (_, i) => i * 4) },
        { id: 'pattern-p2', name: 'Clap 32', steps: Array.from({ length: 64 }, (_, i) => (i * 8) + 4) },
        { id: 'pattern-p3', name: 'Vocal 32', steps: Array.from({ length: 32 }, (_, i) => (i * 16) + 7) },
        { id: 'pattern-p4', name: 'Perc 32', steps: Array.from({ length: 128 }, (_, i) => (i * 4) + 2) },
      ];

      for (const p of patterns) {
        await setDoc(doc(db, 'patterns', p.id), p);
      }

      const backingTracks = [
        'https://actions.google.com/sounds/v1/science_fiction/glitch_low_power.ogg',
        'https://actions.google.com/sounds/v1/science_fiction/low_power_hum.ogg',
        'https://actions.google.com/sounds/v1/science_fiction/techno_ambience.ogg',
        'https://actions.google.com/sounds/v1/science_fiction/deep_space_drone.ogg'
      ];

      for (const studio of studios) {
        const gameConfigs = [
          { id: 'beat-hero', name: 'Beat Hero', type: 'rhythm-producer', bpm: 120 },
          { id: 'sample-catcher', name: 'Sample Catcher', type: 'sample-hunter', bpm: 128 }
        ];

        for (const config of gameConfigs) {
          const gameId = `${studio.id}-${config.id}`;
          const trackIndex = (studios.indexOf(studio) + gameConfigs.indexOf(config)) % backingTracks.length;
          
          await setDoc(doc(db, 'games', gameId), {
            id: gameId,
            studioId: studio.id,
            name: config.name,
            type: config.type,
            bpm: config.bpm,
            difficulty: 1,
            backingTrackUrl: backingTracks[trackIndex]
          });

          for (let i = 1; i <= 4; i++) {
            const levelId = `${gameId}-lvl-${i}`;
            await setDoc(doc(db, 'levels', levelId), {
              id: levelId,
              gameId: gameId,
              difficulty: i,
              name: i === 1 ? 'Initiation' : i === 2 ? 'The Pulse' : i === 3 ? 'Modular' : 'Master'
            });

            const soundSet = [
              { type: 'kick', sample: 'https://actions.google.com/sounds/v1/impacts/wood_block_impact.ogg', p: 'pattern-p1' },
              { type: 'clap', sample: 'https://actions.google.com/sounds/v1/doors/door_knock_3.ogg', p: 'pattern-p2' },
              { type: 'percs', sample: 'https://actions.google.com/sounds/v1/cartoon/clown_horn.ogg', p: 'pattern-p3' },
              { type: 'misc', sample: 'https://actions.google.com/sounds/v1/swishes/air_whoosh.ogg', p: 'pattern-p4' },
            ];

            for (let j = 0; j < i; j++) {
              const s = soundSet[j];
              await setDoc(doc(db, 'levels', levelId, 'sounds', `sound-${levelId}-${s.type}`), {
                id: `sound-${levelId}-${s.type}`,
                levelId: levelId,
                type: s.type,
                sampleUrl: s.sample,
                patternIds: [s.p]
              });
            }
          }
        }
      }

      toast({ title: "Radar Synced!", description: "All studios updated with Beat Hero and Sample Catcher." });
    } catch (e) {
      toast({ variant: "destructive", title: "Setup Failed" });
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-body flex flex-col overflow-hidden select-none relative">
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#FF3399 1.5px, transparent 1.5px)', backgroundSize: '60px 60px' }} />
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,51,153,0.1) 1.5px, transparent 1.5px), linear-gradient(90deg, rgba(255,51,153,0.1) 1.5px, transparent 1.5px)', backgroundSize: '180px 180px' }} />
      
      <div className="absolute top-[20%] left-[10%] w-[40rem] h-[40rem] rounded-full border border-primary/5 animate-[ping_8s_linear_infinite] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[10%] w-[30rem] h-[30rem] rounded-full border border-accent/5 animate-[ping_12s_linear_infinite] pointer-events-none" />

      <header className="p-6 md:p-8 flex flex-col items-center z-50">
        <div className="gemini-border gemini-glow p-4 px-10 inline-block mb-4 bg-black/80 backdrop-blur-2xl">
          <div className="flex items-center gap-4">
            <Radio className="w-8 h-8 text-white animate-pulse" />
            <div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic leading-none text-white">BeatHero</h1>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="gemini-border gemini-glow-accent p-3 px-10 text-center bg-black/80 backdrop-blur-2xl border border-white/5">
            <div className="text-white font-black text-2xl md:text-3xl leading-none tracking-tighter flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#FFEA00]" fill="currentColor" />
              {streetCred.toLocaleString()} <span className="text-primary italic font-black">SC</span>
            </div>
            <div className="text-[9px] uppercase opacity-50 mt-1 font-black tracking-[0.3em]">Street Credibility</div>
          </div>
        </div>
      </header>

      <main className="relative flex-1 w-full overflow-hidden p-4">
        {isLoadingStudios ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
          </div>
        ) : (
          <div className="absolute inset-0 max-w-full mx-auto pointer-events-auto pb-40">
            {allStudios?.map((studio) => {
              const pos = STUDIO_COORDS[studio.id] || { x: 50, y: 30 };
              return (
                <div 
                  key={studio.id}
                  className="absolute transition-all duration-1000 ease-in-out animate-in fade-in zoom-in-90"
                  style={{ 
                    left: `${pos.x}%`, 
                    top: `${pos.y}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <Link href={`/studio/${studio.id}`}>
                    <StudioHouseFrame color={studio.coverColor || '#FF3399'} studioName={studio.name} />
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center w-full px-6 max-w-[480px] pt-4">
          <div className="relative w-full h-56 gemini-border gemini-glow bg-black/95 backdrop-blur-3xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)]">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
            
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
              <div className="w-32 h-32 rounded-full border-4 border-white/40 animate-[ping_4s_linear_infinite]" />
              <div className="absolute inset-0 w-48 h-48 -translate-x-[15%] -translate-y-[15%] rounded-full border border-white/20 animate-[ping_6s_linear_infinite]" />
              <div className="absolute inset-0 w-24 h-24 translate-x-[20%] translate-y-[20%] rounded-full bg-white/10 animate-pulse blur-xl" />
            </div>

            <div className="absolute left-[8%] top-[15%] flex flex-col items-start gap-1 group transition-transform hover:scale-105 z-20">
              <div className="w-3 h-3 rounded-full bg-[#00E676] shadow-[0_0_15px_#00E676] border border-white/50 animate-pulse" />
              <span className="text-2xl md:text-5xl font-black uppercase tracking-tighter text-[#00E676] italic drop-shadow-[0_4px_12px_rgba(0,0,0,1)]">BANTIGER</span>
            </div>

            <div className="absolute right-[8%] bottom-[20%] flex flex-col items-end gap-1 transition-transform hover:scale-105 z-20">
              <div className="w-3 h-3 rounded-full bg-[#FF3D00] shadow-[0_0_15px_#FF3D00] border border-white/50 animate-pulse" />
              <span className="text-2xl md:text-5xl font-black uppercase tracking-tighter text-[#FF3D00] italic drop-shadow-[0_4px_12px_rgba(0,0,0,1)] text-right">OBEREMMENTAL</span>
            </div>

            <div 
              className="absolute inset-0 origin-center animate-[spin_15s_linear_infinite] opacity-40 pointer-events-none" 
              style={{ 
                background: 'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(255, 51, 153, 0.4) 120deg, rgba(255, 234, 0, 0.5) 330deg, rgba(255, 255, 255, 0.7) 360deg)' 
              }}
            />
          </div>
          
          <div className="mt-2 text-[8px] font-black uppercase tracking-[1em] text-primary/30 text-center italic leading-none pointer-events-none select-none">
            districts
          </div>
        </div>
      </main>

      <footer className="p-4 border-t border-white/5 bg-black/98 flex justify-between items-center z-50">
        <div className="flex items-center gap-3 opacity-50">
          <MapIcon className="w-4 h-4 text-primary" />
          <span className="text-[10px] uppercase font-black tracking-[0.4em]">City Scanner Active - v2.6</span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={setupStudios} 
          className="text-[10px] uppercase tracking-tighter gap-2 opacity-60 hover:opacity-100 group h-10 px-6 hover:bg-white/5 font-black"
        >
          <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-1000" /> Rack Sync
        </Button>
      </footer>
    </div>
  );
}
