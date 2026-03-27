"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, setDoc } from 'firebase/firestore';
import { Radio, RefreshCw, Loader2, Map as MapIcon, Sparkles } from 'lucide-react';
import { Studio } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { useAuth } from '@/firebase/provider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Optimierte Koordinaten für eine regelmäßige vertikale und horizontale Verteilung im Hauptbereich
const STUDIO_COORDS: Record<string, { x: number, y: number }> = {
  'gabriel-beats': { x: 15, y: 15 }, // Oben links
  'yoan-beats': { x: 80, y: 40 },   // Mitte rechts
  'noxxos': { x: 30, y: 65 },      // Unten links (oberhalb der Mini-Map)
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

      {/* Hauptbereich: Studios als schwebende Avatare */}
      <main className="relative flex-1 w-full overflow-hidden p-4">
        {/* Raster Hintergrund */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        
        {isLoadingStudios ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#FFEA00]" />
          </div>
        ) : (
          <div className="absolute inset-x-0 top-0 bottom-64 max-w-6xl mx-auto pointer-events-none">
            {allStudios?.map((studio) => {
              const pos = STUDIO_COORDS[studio.id] || { x: 50, y: 50 };
              return (
                <div 
                  key={studio.id}
                  className="absolute transition-all duration-500 ease-in-out animate-in fade-in zoom-in group pointer-events-auto"
                  style={{ 
                    left: `${pos.x}%`, 
                    top: `${pos.y}%`,
                  }}
                >
                  <Link href={`/studio/${studio.id}`}>
                    <div className="relative flex flex-col items-center -translate-x-1/2 -translate-y-1/2">
                      {/* Glow Effekt Hinter dem Avatar */}
                      <div 
                        className="absolute inset-0 rounded-full blur-3xl opacity-20 group-hover:opacity-60 transition-opacity duration-500"
                        style={{ backgroundColor: studio.coverColor || '#993DEB' }}
                      />
                      
                      {/* Avatar mit Rahmen-Animation */}
                      <div className="relative z-10 p-1 rounded-full bg-white/5 border-2 border-white/10 group-hover:border-white transition-all group-hover:scale-110 duration-500 shadow-2xl">
                        <Avatar className="w-20 h-20 md:w-40 md:h-40 shadow-2xl">
                          <AvatarImage src={`https://picsum.photos/seed/${studio.id}/400`} />
                          <AvatarFallback className="bg-black text-white font-black italic text-xl">{studio.name.substring(0,2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        
                        {/* Aktiver Indikator */}
                        <div className="absolute top-2 right-2 md:top-4 md:right-4 w-4 h-4 md:w-6 md:h-6 bg-[#00E676] rounded-full border-4 border-black animate-ping" />
                      </div>

                      {/* Studio Name Tag */}
                      <div className="mt-6 bg-black/90 backdrop-blur-2xl border border-white/20 p-2 md:p-4 rounded-2xl shadow-2xl transform transition-all group-hover:-translate-y-2 group-hover:border-[#FFEA00] text-center min-w-[140px]">
                        <h3 className="text-sm md:text-lg font-black uppercase italic tracking-tighter whitespace-nowrap leading-none flex items-center justify-center gap-2">
                          <Sparkles className="w-3 h-3 text-[#FFEA00] opacity-0 group-hover:opacity-100 transition-opacity" />
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

        {/* Mini Map (GTA Style, zentriert am unteren Rand) */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50">
          <div className="relative w-64 h-64 md:w-96 md:h-96 rounded-2xl border-2 border-white/10 bg-black/60 backdrop-blur-md overflow-hidden gemini-glow">
            {/* Tactical Grid */}
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '25px 25px' }} />
            
            {/* Pulse Effects */}
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="w-6 h-6 bg-[#FFEA00] rounded-full animate-ping opacity-50" />
            </div>

            {/* Tactical Points */}
            <div className="absolute inset-0 p-8 flex flex-col justify-between">
              <div className="flex items-center gap-4">
                <div className="w-6 h-6 rounded-full bg-[#00E676] shadow-[0_0_20px_#00E676]" />
                <span className="text-lg md:text-2xl font-black uppercase tracking-tighter text-[#00E676] drop-shadow-lg">MS BANTIGER</span>
              </div>
              <div className="flex items-center gap-4 self-end">
                <span className="text-lg md:text-2xl font-black uppercase tracking-tighter text-[#EB3D99] drop-shadow-lg">MS OBEREMMENTAL</span>
                <div className="w-6 h-6 rounded-full bg-[#EB3D99] shadow-[0_0_20px_#EB3D99]" />
              </div>
            </div>

            {/* Radar Sweep Animation */}
            <div className="absolute inset-0 origin-center bg-gradient-to-tr from-transparent via-[#FFEA00]/5 to-transparent animate-[spin_4s_linear_infinite]" />
          </div>
          <div className="mt-6 text-xl md:text-3xl font-black uppercase tracking-[0.5em] text-white/50 text-center drop-shadow-2xl">DISTRICTS</div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 border-t border-white/5 bg-black/60 flex justify-between items-center z-50">
        <div className="flex items-center gap-2 opacity-40">
          <MapIcon className="w-4 h-4" />
          <span className="text-[10px] uppercase font-bold tracking-[0.2em]">Radar Active</span>
        </div>
        <Button variant="ghost" size="sm" onClick={setupStudios} className="text-[10px] uppercase tracking-tighter gap-2 opacity-40 hover:opacity-100 group">
          <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" /> Rack Sync
        </Button>
      </footer>
    </div>
  );
}
