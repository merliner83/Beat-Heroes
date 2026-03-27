"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, setDoc } from 'firebase/firestore';
import { Radio, RefreshCw, Loader2, Map as MapIcon } from 'lucide-react';
import { Studio } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { useAuth } from '@/firebase/provider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Spezifische Koordinaten für die Studios im Hauptbereich (keine Überlappung)
const STUDIO_COORDS: Record<string, { x: number, y: number }> = {
  'gabriel-beats': { x: 25, y: 25 },
  'yoan-beats': { x: 75, y: 40 },
  'noxxos': { x: 45, y: 65 },
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
      { id: 'gabriel-beats', name: 'Gabriel Beats', description: 'Urban grooves and heavy bass.', coverColor: '#993DEB' },
      { id: 'yoan-beats', name: 'Yoan Beats', description: 'Electronic textures and clean rhythm.', coverColor: '#FFEA00' },
      { id: 'noxxos', name: 'Noxxos', description: 'Experimental soundscapes.', coverColor: '#EB3D99' }
    ];

    try {
      for (const p of patterns) await setDoc(doc(db, 'patterns', p.id), p, { merge: true });
      for (const s of studios) await setDoc(doc(db, 'studios', s.id), s, { merge: true });

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

      toast({ title: "Radar Synced!", description: "Districts live." });
    } catch (e) {
      toast({ variant: "destructive", title: "Setup Failed" });
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-body flex flex-col overflow-hidden select-none">
      {/* Header mit Titel und SC */}
      <header className="p-6 flex flex-col items-center z-50">
        <div className="gemini-border gemini-glow p-4 inline-block mb-4">
          <div className="flex items-center gap-3">
            <Radio className="w-8 h-8 text-[#FFEA00]" />
            <div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic leading-none">BeatHero</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Districts Hub</p>
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

      {/* Hauptbereich ohne Rahmen */}
      <main className="relative flex-1 w-full overflow-hidden flex flex-col items-center justify-center p-4">
        {/* Raster Hintergrund */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        
        {isLoadingStudios ? (
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#FFEA00]" />
          </div>
        ) : (
          <div className="relative w-full h-full max-w-6xl">
            {allStudios?.map((studio) => {
              const pos = STUDIO_COORDS[studio.id] || { x: 50, y: 50 };
              return (
                <div 
                  key={studio.id}
                  className="absolute transition-all duration-700 animate-in fade-in zoom-in group"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                >
                  <Link href={`/studio/${studio.id}`}>
                    <div className="relative flex flex-col items-center -translate-x-1/2 -translate-y-1/2">
                      <div className="relative z-10 p-1 rounded-full bg-white/5 border-2 border-white/10 group-hover:border-[#FFEA00] transition-all group-hover:scale-110">
                        <Avatar className="w-16 h-16 md:w-32 md:h-32 shadow-2xl">
                          <AvatarImage src={`https://picsum.photos/seed/${studio.id}/400`} />
                          <AvatarFallback className="bg-black text-white font-black italic">{studio.name.substring(0,2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </div>

                      <div className="mt-4 bg-black/80 backdrop-blur-xl border border-white/10 p-2 md:p-3 rounded-xl shadow-2xl transform transition-transform group-hover:-translate-y-1 text-center min-w-[120px]">
                        <h3 className="text-xs md:text-sm font-black uppercase italic tracking-tighter whitespace-nowrap leading-none">
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

        {/* Mini Map (Vergrößert und zentriert) */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50">
          <div className="relative w-56 h-56 md:w-80 md:h-80 rounded-2xl border-2 border-white/10 bg-black/60 backdrop-blur-md overflow-hidden gemini-glow">
            {/* Tactical Grid */}
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '25px 25px' }} />
            
            {/* Pulse Effects */}
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="w-4 h-4 bg-[#FFEA00] rounded-full animate-ping opacity-50" />
            </div>

            {/* Tactical Points mit größeren Schriften */}
            <div className="absolute inset-0 p-8 flex flex-col justify-between">
              <div className="flex items-center gap-4">
                <div className="w-4 h-4 rounded-full bg-[#00E676] shadow-[0_0_15px_#00E676]" />
                <span className="text-xs md:text-base font-black uppercase tracking-tighter text-[#00E676] drop-shadow-md">MS BANTIGER</span>
              </div>
              <div className="flex items-center gap-4 self-end">
                <span className="text-xs md:text-base font-black uppercase tracking-tighter text-[#EB3D99] drop-shadow-md">MS OBEREMMENTAL</span>
                <div className="w-4 h-4 rounded-full bg-[#EB3D99] shadow-[0_0_15px_#EB3D99]" />
              </div>
            </div>

            {/* Radar Sweep Animation */}
            <div className="absolute inset-0 origin-center bg-gradient-to-tr from-transparent via-[#FFEA00]/5 to-transparent animate-[spin_4s_linear_infinite]" />
          </div>
          <div className="mt-4 text-xs font-black uppercase tracking-[0.4em] text-white/30 text-center">DISTRICTS</div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 border-t border-white/5 bg-black/60 flex justify-between items-center z-50">
        <div className="flex items-center gap-2 opacity-40">
          <MapIcon className="w-4 h-4" />
          <span className="text-[10px] uppercase font-bold tracking-[0.2em]">Live Radar Active</span>
        </div>
        <Button variant="ghost" size="sm" onClick={setupStudios} className="text-[10px] uppercase tracking-tighter gap-2 opacity-40 hover:opacity-100 group">
          <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" /> Rack Sync
        </Button>
      </footer>
    </div>
  );
}
