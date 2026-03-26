
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, setDoc, getDoc } from 'firebase/firestore';
import { Radio, Home, Settings } from 'lucide-react';
import { Studio } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { useAuth } from '@/firebase/provider';

const STUDIO_COORDS: Record<string, { x: number, y: number }> = {
  'gabriel-beats': { x: 15, y: 20 },
  'yoan-beats': { x: 40, y: 45 },
  'nintu-music': { x: 70, y: 65 },
  'dave-beats': { x: 20, y: 75 },
  'noxxos': { x: 80, y: 30 }
};

const DISTRICTS = [
  { id: 'bantiger', name: 'MS Bantiger', x: 25, y: 55 },
  { id: 'oberemmental', name: 'MS Oberemmental', x: 75, y: 30 }
];

export default function HomePage() {
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [activeDistricts, setActiveDistricts] = useState<string[]>(['bantiger', 'oberemmental']);
  
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

  const { data: allStudios, isLoading } = useCollection<Studio>(studiosQuery);

  const filteredStudios = allStudios?.filter(studio => {
    const studioDistrictId = studio.district === 'Bantiger District' ? 'bantiger' : 
                             studio.district === 'Oberemmental District' ? 'oberemmental' : null;
    
    if (!studioDistrictId) return true;
    return activeDistricts.includes(studioDistrictId);
  });

  const toggleDistrict = (id: string) => {
    setActiveDistricts(prev => 
      prev.includes(id) 
        ? prev.filter(d => d !== id) 
        : [...prev, id]
    );
  };

  const setupStudios = async () => {
    if (!db) return;
    
    // Patterns
    const patterns = [
      { id: 'kick-intro', name: 'KICK Intro', steps: [0, 16, 32, 48, 64, 80, 96, 112] },
      { id: 'kick-drop', name: 'KICK Drop', steps: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84, 88, 92, 96, 100, 104, 108, 112, 116, 120, 124] },
      { id: 'kick-buildup', name: 'KICK Buildup', steps: [0, 16, 32, 48, 64, 72, 80, 88, 96, 100, 104, 108, 112, 114, 116, 118, 120, 121, 122, 123, 124, 125, 126, 127] },
      { id: 'clap-drop', name: 'CLAP Standard', steps: [4, 12, 20, 28, 36, 44, 52, 60, 68, 76, 84, 92, 100, 108, 116, 124] },
      { id: 'hats-edm', name: 'HATS EDM Quarter', steps: [4, 12, 20, 28, 36, 44, 52, 60, 68, 76, 84, 92, 100, 108, 116, 124] },
      { id: 'hats-pro', name: 'HATS Syncopated 16th', steps: [2, 6, 10, 12, 14, 18, 22, 26, 28, 30, 34, 38, 42, 44, 46, 50, 54, 58, 60, 62, 66, 70, 74, 76, 78, 82, 86, 90, 92, 94, 98, 102, 106, 108, 110, 114, 118, 122, 124, 126] },
      { id: 'misc-afro', name: 'MISC Afro Clave', steps: [0, 3, 6, 10, 12, 16, 19, 22, 26, 28, 32, 35, 38, 42, 44, 48, 51, 54, 58, 60, 64, 67, 70, 74, 76, 80, 83, 86, 90, 92, 96, 99, 102, 106, 108, 112, 115, 118, 122, 124] },
      { id: 'misc-pro', name: 'MISC Polyrhythmic Clave', steps: [0, 3, 7, 10, 12, 16, 19, 23, 26, 28, 32, 35, 39, 42, 44, 48, 51, 55, 58, 60, 64, 67, 71, 74, 76, 80, 83, 87, 90, 92, 96, 99, 103, 106, 108, 112, 115, 119, 122, 124] }
    ];

    const newStudios = [
      { id: 'gabriel-beats', name: 'Gabriel Beats', description: 'Urban grooves and sharp transients.', coverColor: '#FF3D00', district: 'Bantiger District' },
      { id: 'yoan-beats', name: 'Yoan Beats', description: 'Atmospheric layers and heavy kicks.', coverColor: '#FFEA00', district: 'Bantiger District' },
      { id: 'nintu-music', name: 'Nintu Music', description: 'Electronic textures and deep soul.', coverColor: '#00E676', district: 'Bantiger District' },
      { id: 'dave-beats', name: 'Dave Beats', description: 'The golden era of hip hop rhythm.', coverColor: '#2979FF', district: 'Bantiger District' },
      { id: 'noxxos', name: 'Noxxos', description: 'Experimental rhythms.', coverColor: '#EB3D99', district: 'Oberemmental District' }
    ];

    try {
      for (const p of patterns) await setDoc(doc(db, 'patterns', p.id), p, { merge: true });
      for (const s of newStudios) await setDoc(doc(db, 'studios', s.id), s, { merge: true });

      const gamesToSetup = [
        { id: 'gabriel-1', studioId: 'gabriel-beats', name: 'Neon Horizon', type: 'rhythm-producer', bpm: 162, difficulty: 4 },
        { id: 'yoan-1', studioId: 'yoan-beats', name: 'Sampling', type: 'rhythm-producer', bpm: 125, difficulty: 2 },
        { id: 'noxxos-hunter', studioId: 'noxxos', name: 'Sample Hunter', type: 'sample-hunter', bpm: 120, difficulty: 3 }
      ];

      for (const gameConfig of gamesToSetup) {
        const gameRef = doc(db, 'games', gameConfig.id);
        const gSnap = await getDoc(gameRef);
        const existing = gSnap.exists() ? gSnap.data() : {};
        
        await setDoc(gameRef, {
          ...gameConfig,
          bpm: existing.bpm || gameConfig.bpm,
          backingTrackUrl: existing.backingTrackUrl || 'https://actions.google.com/sounds/v1/science_fiction/glitch_low_power.ogg'
        }, { merge: true });

        const levels = [
          { id: `${gameConfig.id}-level-1`, name: 'Foundation', diff: 1 },
          { id: `${gameConfig.id}-level-2`, name: 'Clap Groove', diff: 2 },
          { id: `${gameConfig.id}-level-3`, name: 'Hi-Hat Grooves', diff: 3 },
          { id: `${gameConfig.id}-level-4`, name: 'Hero Rhythms', diff: 4 }
        ];

        for (const l of levels) {
          await setDoc(doc(db, 'levels', l.id), {
            id: l.id, gameId: gameConfig.id, difficulty: l.diff, name: l.name
          }, { merge: true });

          const soundConfigs = [
            { type: 'kick', p: ['kick-intro', 'kick-drop', 'kick-buildup', 'kick-drop'], minLvl: 1 },
            { type: 'clap', p: ['clap-drop', 'clap-drop', 'clap-buildup', 'clap-drop'], minLvl: 2 },
            { type: 'percs', p: l.diff === 4 ? ['hats-pro', 'hats-pro', 'hats-pro', 'hats-pro'] : ['hats-edm', 'hats-edm', 'hats-edm', 'hats-edm'], minLvl: 3 },
            { type: 'misc', p: l.diff === 4 ? ['misc-pro', 'misc-pro', 'misc-pro', 'misc-pro'] : ['misc-afro', 'misc-afro', 'misc-afro', 'misc-afro'], minLvl: 4 }
          ];

          for (const sInfo of soundConfigs) {
            if (sInfo.minLvl <= l.diff) {
              const soundId = `${sInfo.type}-main`;
              const soundRef = doc(db, 'levels', l.id, 'sounds', soundId);
              const sSnap = await getDoc(soundRef);
              const sExisting = sSnap.exists() ? sSnap.data() : {};

              await setDoc(soundRef, {
                id: soundId,
                levelId: l.id,
                type: sInfo.type,
                patternIds: sInfo.p,
                sampleUrl: sExisting.sampleUrl || 'https://actions.google.com/sounds/v1/impacts/wood_block_impact.ogg'
              }, { merge: true });
            }
          }
        }
      }

      toast({ title: "Database Ready", description: "Multi-Game structure synchronized!" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Initialization failed." });
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-body flex flex-col overflow-x-hidden select-none">
      <header className="p-4 md:p-6 flex flex-col items-center z-50">
        <div className="gemini-border gemini-glow p-3 md:p-4 inline-block mb-2 md:mb-4">
          <div className="flex items-center gap-3">
            <Radio className="w-6 h-6 md:w-8 md:h-8 text-[#FFEA00]" />
            <div>
              <h1 className="text-2xl md:text-4xl font-black tracking-tighter uppercase italic leading-none text-white">BeatHero</h1>
              <p className="text-[8px] md:text-[10px] uppercase tracking-[0.2em] font-bold opacity-50 text-white">Select Destination</p>
            </div>
          </div>
        </div>

        <div className="gemini-border gemini-glow p-2 md:p-4 text-center">
          <div className="text-white font-bold text-sm md:text-xl leading-none tracking-tighter">
            {streetCred.toLocaleString()} <span className="text-[#FFEA00] italic ml-1 font-black">SC</span>
          </div>
          <div className="text-[8px] md:text-[10px] uppercase opacity-40 mt-1 font-bold tracking-widest text-white">Street Credibilities</div>
        </div>
      </header>

      <main className="relative flex-1 w-full bg-[#080808] overflow-hidden min-h-[400px]">
        <div className="absolute inset-0">
          {filteredStudios?.map((studio) => {
            const pos = STUDIO_COORDS[studio.id] || { x: 50, y: 50 };
            return (
              <div 
                key={studio.id}
                className="absolute transition-all duration-500 animate-in fade-in zoom-in group"
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                <Link href={`/studio/${studio.id}`}>
                  <div className="relative flex flex-col items-center -translate-x-1/2 -translate-y-1/2">
                    <div className="absolute inset-0 w-12 h-12 md:w-16 md:h-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/20 animate-ping opacity-20" />
                    
                    <div 
                      className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-black border-2 border-white/20 flex items-center justify-center shadow-2xl relative z-10 transition-all group-hover:scale-110"
                      style={{ boxShadow: `0 0 30px ${studio.coverColor}44` }}
                    >
                      <Home className="w-6 h-6 md:w-8 md:h-8 text-white" />
                    </div>

                    <div className="mt-2 md:mt-3 bg-black/90 backdrop-blur-md border border-white/20 px-3 py-1.5 md:px-5 md:py-2.5 rounded-xl transition-transform group-hover:-translate-y-1">
                      <h3 className="text-[10px] md:text-xl font-black uppercase italic tracking-tighter whitespace-nowrap leading-none text-white">{studio.name}</h3>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-40">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-[#FFEA00] border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Downloading Area Data...</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mini-Map Filter Area */}
      <div className="p-4 md:p-8 bg-[#050505] border-t border-white/5 z-50">
        <div className="max-w-md mx-auto">
          <div className="gemini-border gemini-glow p-3 bg-black/40 backdrop-blur-md">
            <div className="h-32 md:h-48 w-full rounded-lg relative overflow-hidden bg-[#111]">
              <div className="absolute inset-0 opacity-10 pointer-events-none">
                <svg width="100%" height="100%">
                  <pattern id="grid-mini" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="0.5"/>
                  </pattern>
                  <rect width="100%" height="100%" fill="url(#grid-mini)" />
                </svg>
              </div>

              {DISTRICTS.map((district) => {
                const isActive = activeDistricts.includes(district.id);
                
                return (
                  <div
                    key={district.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDistrict(district.id);
                    }}
                    className={cn(
                      "absolute flex flex-col items-center gap-2 transition-all group cursor-pointer",
                      !isActive && "opacity-30"
                    )}
                    style={{ left: `${district.x}%`, top: `${district.y}%`, transform: 'translate(-50%, -50%)' }}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 border-white transition-all",
                      isActive 
                        ? "bg-[#FF3D00] shadow-[0_0_20px_#FF3D00] scale-110 animate-pulse" 
                        : "bg-white/10 border-white/20"
                    )} />
                    <div className={cn(
                      "bg-black/90 backdrop-blur-md border border-white/20 px-3 py-1.5 text-xs md:text-lg font-black uppercase tracking-widest whitespace-nowrap rounded transition-colors",
                      isActive ? "text-[#FFEA00] border-[#FFEA00]/40" : "text-white/20"
                    )}>
                      {district.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <footer className="p-2 md:p-4 border-t border-white/5 flex justify-end opacity-10 hover:opacity-100 transition-opacity">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={setupStudios}
          className="text-[8px] md:text-[10px] uppercase tracking-tighter gap-2 text-white"
        >
          <Settings className="w-3 h-3" />
          Map Setup
        </Button>
      </footer>
    </div>
  );
}
