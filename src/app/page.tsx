"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, setDoc } from 'firebase/firestore';
import { Radio, RefreshCw, Loader2, Map as MapIcon, Compass } from 'lucide-react';
import { Studio } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { useAuth } from '@/firebase/provider';
import { cn } from '@/lib/utils';

// Koordinaten für die Map-Darstellung (verhindert Überlappung)
const STUDIO_COORDS: Record<string, { x: number, y: number, district: string }> = {
  'gabriel-beats': { x: 28, y: 32, district: 'MS BANTIGER DISTRICT' },
  'yoan-beats': { x: 72, y: 68, district: 'MS OBEREMMENTAL' },
  'noxxos': { x: 50, y: 50, district: 'MS BANTIGER DISTRICT' },
};

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
    
    const patterns = [
      { id: 'kick-basic', name: 'KICK Basic', steps: [0, 16, 32, 48, 64, 80, 96, 112] },
      { id: 'clap-basic', name: 'CLAP Basic', steps: [16, 48, 80, 112] },
      { id: 'hats-pro', name: 'HATS Pro', steps: [0, 8, 12, 16, 24, 28, 32, 40, 44, 48, 56, 60, 64, 72, 76, 80, 88, 92, 96, 104, 108, 112, 120, 124] },
      { id: 'misc-pro', name: 'MISC Pro', steps: [6, 14, 22, 30, 38, 46, 54, 62, 70, 78, 86, 94, 102, 110, 118, 126] }
    ];

    const studios = [
      { id: 'gabriel-beats', name: 'Gabriel Beats', description: 'Urban grooves and heavy bass.', coverColor: '#993DEB', district: 'MS BANTIGER DISTRICT' },
      { id: 'yoan-beats', name: 'Yoan Beats', description: 'Electronic textures and clean rhythm.', coverColor: '#FFEA00', district: 'MS OBEREMMENTAL' },
      { id: 'noxxos', name: 'Noxxos', description: 'Experimental soundscapes.', coverColor: '#EB3D99', district: 'MS BANTIGER DISTRICT' }
    ];

    try {
      for (const p of patterns) await setDoc(doc(db, 'patterns', p.id), p, { merge: true });
      for (const s of studios) await setDoc(doc(db, 'studios', s.id), s, { merge: true });

      // Yoan Beats Fokus Setup
      const gameConfig = { 
        id: 'yoan-rhythm', 
        studioId: 'yoan-beats', 
        name: 'Yoan\'s Rhythm', 
        type: 'rhythm-producer', 
        bpm: 162, 
        difficulty: 2,
        backingTrackUrl: 'https://actions.google.com/sounds/v1/science_fiction/glitch_low_power.ogg'
      };

      await setDoc(doc(db, 'games', gameConfig.id), gameConfig, { merge: true });

      const levels = [
        { id: `yoan-level-1`, name: 'Kick Foundation', diff: 1 },
        { id: `yoan-level-2`, name: 'Clap Groove', diff: 2 },
        { id: `yoan-level-3`, name: 'Hi-Hat Layer', diff: 3 },
        { id: `yoan-level-4`, name: 'Full Production', diff: 4 }
      ];

      for (const l of levels) {
        await setDoc(doc(db, 'levels', l.id), {
          id: l.id, gameId: gameConfig.id, difficulty: l.diff, name: l.name
        }, { merge: true });

        const soundConfigs = [
          { type: 'kick', p: ['kick-basic', 'kick-basic', 'kick-basic', 'kick-basic'], minLvl: 1 },
          { type: 'clap', p: ['clap-basic', 'clap-basic', 'clap-basic', 'clap-basic'], minLvl: 2 },
          { type: 'percs', p: ['hats-pro', 'hats-pro', 'hats-pro', 'hats-pro'], minLvl: 3 },
          { type: 'misc', p: ['misc-pro', 'misc-pro', 'misc-pro', 'misc-pro'], minLvl: 4 }
        ];

        for (const sInfo of soundConfigs) {
          if (sInfo.minLvl <= l.diff) {
            const soundId = `${sInfo.type}-main`;
            await setDoc(doc(db, 'levels', l.id, 'sounds', soundId), {
              id: soundId, levelId: l.id, type: sInfo.type, patternIds: sInfo.p,
              sampleUrl: 'https://actions.google.com/sounds/v1/impacts/wood_block_impact.ogg'
            }, { merge: true });
          }
        }
      }

      toast({ title: "Rack Synchronized!", description: "All districts and studios are live." });
    } catch (e) {
      toast({ variant: "destructive", title: "Setup Failed" });
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-body flex flex-col overflow-hidden select-none">
      <header className="p-6 flex flex-col items-center z-50 bg-gradient-to-b from-black/80 to-transparent">
        <div className="gemini-border gemini-glow p-4 inline-block mb-4">
          <div className="flex items-center gap-3">
            <Radio className="w-8 h-8 text-[#FFEA00]" />
            <div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic leading-none">BeatHero</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Command Center</p>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="gemini-border gemini-glow p-2 px-8 text-center bg-black/40 backdrop-blur-md">
            <div className="text-white font-bold text-xl md:text-2xl leading-none tracking-tighter">
              {streetCred.toLocaleString()} <span className="text-[#FFEA00] italic ml-1 font-black">SC</span>
            </div>
            <div className="text-[10px] uppercase opacity-40 mt-1 font-bold tracking-widest">Street Cred</div>
          </div>
        </div>
      </header>

      <main className="relative flex-1 w-full overflow-hidden flex flex-col items-center justify-center">
        {/* Die große Karte im taktischen Rahmen */}
        <div className="relative w-full max-w-4xl aspect-[4/3] md:aspect-video gemini-border gemini-glow bg-black/60 mx-4 overflow-hidden">
          {/* Hintergrund Grid */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          
          {/* Distrikt-Labels (Fest positioniert im Rahmen) */}
          <div className="absolute top-4 left-6 text-[10px] font-black uppercase tracking-[0.4em] text-white/20 z-10">
            MS BANTIGER DISTRICT
          </div>
          <div className="absolute bottom-4 right-6 text-[10px] font-black uppercase tracking-[0.4em] text-white/20 z-10">
            MS OBEREMMENTAL
          </div>

          {isLoadingStudios ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#FFEA00]" />
            </div>
          ) : (
            <div className="absolute inset-0">
              {allStudios?.map((studio) => {
                const pos = STUDIO_COORDS[studio.id] || { x: 50, y: 50, district: 'UNKNOWN' };
                return (
                  <div 
                    key={studio.id}
                    className="absolute transition-all duration-500 animate-in fade-in zoom-in group"
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  >
                    <Link href={`/studio/${studio.id}`}>
                      <div className="relative flex flex-col items-center -translate-x-1/2 -translate-y-1/2">
                        {/* Pulse Effect */}
                        <div 
                          className="absolute inset-0 w-16 h-16 md:w-24 md:h-24 rounded-full border-2 border-[#FFEA00]/20 animate-ping opacity-10" 
                          style={{ animationDuration: '3s' }}
                        />

                        <div 
                          className="w-12 h-12 md:w-20 md:h-20 rounded-2xl bg-black border-2 border-white/20 flex items-center justify-center shadow-2xl relative z-10 transition-all group-hover:scale-110 group-hover:border-[#FFEA00]"
                          style={{ boxShadow: `0 0 40px ${studio.coverColor}44` }}
                        >
                          <Compass className="w-6 h-6 md:w-10 md:h-10 text-white group-hover:text-[#FFEA00] transition-colors" />
                        </div>

                        <div className="mt-4 bg-black/80 backdrop-blur-xl border border-white/10 p-2 md:p-4 rounded-xl shadow-2xl transform transition-transform group-hover:-translate-y-1 text-center">
                          <h3 className="text-xs md:text-xl font-black uppercase italic tracking-tighter whitespace-nowrap leading-none">
                            {studio.name}
                          </h3>
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <footer className="p-6 border-t border-white/5 bg-black/60 flex justify-between items-center z-50">
        <div className="flex items-center gap-2 opacity-40">
          <MapIcon className="w-4 h-4" />
          <span className="text-[10px] uppercase font-bold tracking-[0.2em]">Global Studio Radar</span>
        </div>
        <Button variant="ghost" size="sm" onClick={setupStudios} className="text-[10px] uppercase tracking-tighter gap-2 opacity-40 hover:opacity-100 group">
          <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" /> Rack Sync
        </Button>
      </footer>
    </div>
  );
}
