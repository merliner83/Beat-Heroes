
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
  'nintu-music': { x: 70, y: 65 },
  'dave-beats': { x: 20, y: 75 },
  'noxxos': { x: 80, y: 30 },
  'yoan-beats': { x: 40, y: 45 }
};

const DISTRICTS = [
  { id: 'bantiger', name: 'Bantiger District', x: 25, y: 55 },
  { id: 'oberemmental', name: 'Oberemmental District', x: 75, y: 30 }
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
    
    // 8-Bar Patterns (128 steps) - Optimized for 162 BPM
    const patterns = [
      { 
        id: 'kick-intro', 
        name: 'KICK Intro (Sparse)', 
        steps: [0, 16, 32, 48, 64, 80, 96, 112] 
      },
      { 
        id: 'kick-drop', 
        name: 'KICK Main Drop (Driving)', 
        steps: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84, 88, 92, 96, 100, 104, 108, 112, 116, 120, 124] 
      },
      { 
        id: 'kick-buildup', 
        name: 'KICK Buildup (Rush)', 
        steps: [0, 16, 32, 48, 64, 72, 80, 88, 96, 100, 104, 108, 112, 114, 116, 118, 120, 121, 122, 123, 124, 125, 126, 127] 
      },
      { 
        id: 'clap-drop', 
        name: 'CLAP Standard (2 & 4)', 
        steps: [4, 12, 20, 28, 36, 44, 52, 60, 68, 76, 84, 92, 100, 108, 116, 124] 
      },
      {
        id: 'clap-buildup',
        name: 'CLAP Accelerating',
        steps: [16, 48, 80, 96, 104, 112, 116, 120, 122, 124, 125, 126, 127]
      },
      { 
        id: 'hats-edm', 
        name: 'HATS EDM Quarter Offbeat', 
        steps: [2, 10, 18, 26, 34, 42, 50, 58, 66, 74, 82, 90, 98, 106, 114, 122] 
      },
      {
        id: 'hats-trap',
        name: 'HATS Simple Trap',
        steps: [0, 4, 8, 10, 12, 16, 20, 24, 26, 28, 32, 36, 40, 42, 44, 48, 52, 56, 58, 60, 64, 68, 72, 74, 76, 80, 84, 88, 90, 92, 96, 100, 104, 106, 108, 112, 116, 120, 122, 124]
      },
      {
        id: 'misc-afro',
        name: 'MISC Afro Clave',
        steps: [0, 3, 6, 10, 12, 16, 19, 22, 26, 28, 32, 35, 38, 42, 44, 48, 51, 54, 58, 60, 64, 67, 70, 74, 76, 80, 83, 86, 90, 92, 96, 99, 102, 106, 108, 112, 115, 118, 122, 124]
      }
    ];

    const newStudios = [
      { 
        id: 'gabriel-beats', 
        name: 'Gabriel Beats', 
        description: 'Urban grooves and sharp transients.', 
        coverColor: '#FF3D00', 
        district: 'Bantiger District',
        linkUrl: 'https://example.com/gabriel',
        linkLabel: 'Portfolio'
      },
      { 
        id: 'yoan-beats', 
        name: 'Yoan Beats', 
        description: 'Atmospheric layers and heavy kicks.', 
        coverColor: '#FFEA00', 
        district: 'Bantiger District',
        linkUrl: 'https://example.com/yoan',
        linkLabel: 'Beat Store'
      },
      { 
        id: 'nintu-music', 
        name: 'Nintu Music', 
        description: 'Electronic textures and deep soul.', 
        coverColor: '#00E676', 
        district: 'Bantiger District',
        linkUrl: 'https://example.com/nintu',
        linkLabel: 'Soundcloud'
      },
      { 
        id: 'dave-beats', 
        name: 'Dave Beats', 
        description: 'The golden era of hip hop rhythm.', 
        coverColor: '#2979FF', 
        district: 'Bantiger District',
        linkUrl: 'https://example.com/dave',
        linkLabel: 'Beat Store'
      },
      { 
        id: 'noxxos', 
        name: 'Noxxos', 
        description: 'Experimental rhythms from the outer rim.', 
        coverColor: '#EB3D99', 
        district: 'Oberemmental District',
        linkUrl: 'https://example.com/noxxos',
        linkLabel: 'Lab Logs'
      }
    ];

    try {
      for (const p of patterns) {
        await setDoc(doc(db, 'patterns', p.id), p, { merge: true });
      }
      for (const s of newStudios) {
        await setDoc(doc(db, 'studios', s.id), s, { merge: true });
      }

      const demoProjectId = 'gabriel-debut';
      const demoLevel1Id = 'gabriel-1-level-1';
      const demoLevel2Id = 'gabriel-1-level-2';
      const demoLevel3Id = 'gabriel-1-level-3';
      const demoLevel4Id = 'gabriel-1-level-4';

      const projectRef = doc(db, 'projects', demoProjectId);
      const projectSnap = await getDoc(projectRef);
      const existingProject = projectSnap.exists() ? projectSnap.data() : {};

      await setDoc(projectRef, {
        id: demoProjectId,
        studioId: 'gabriel-beats',
        name: 'Neon Horizon',
        difficulty: 4, // HERO
        bpm: existingProject.bpm || 162,
        backingTrackUrl: existingProject.backingTrackUrl || 'https://actions.google.com/sounds/v1/science_fiction/glitch_low_power.ogg'
      }, { merge: true });

      // Level 1: Kick
      await setDoc(doc(db, 'levels', demoLevel1Id), {
        id: demoLevel1Id,
        projectId: demoProjectId,
        difficulty: 1,
        name: 'Gabriel Foundation'
      }, { merge: true });

      // Level 2: Clap
      await setDoc(doc(db, 'levels', demoLevel2Id), {
        id: demoLevel2Id,
        projectId: demoProjectId,
        difficulty: 2,
        name: 'Clap Precision'
      }, { merge: true });

      // Level 3: Hats (Percs)
      await setDoc(doc(db, 'levels', demoLevel3Id), {
        id: demoLevel3Id,
        projectId: demoProjectId,
        difficulty: 3,
        name: 'Hi-Hat Grooves'
      }, { merge: true });

      // Level 4: Afro Clave (Misc)
      await setDoc(doc(db, 'levels', demoLevel4Id), {
        id: demoLevel4Id,
        projectId: demoProjectId,
        difficulty: 4,
        name: 'Afro Clave Rhythms'
      }, { merge: true });

      const allSounds = [
        {
          id: 'kick-main',
          levelId: demoLevel1Id,
          type: 'kick',
          sampleUrl: 'https://actions.google.com/sounds/v1/impacts/wood_block_impact.ogg',
          patternIds: ['kick-intro', 'kick-drop', 'kick-buildup', 'kick-drop']
        },
        {
          id: 'clap-main',
          levelId: demoLevel2Id,
          type: 'clap',
          sampleUrl: 'https://actions.google.com/sounds/v1/doors/door_knock_3.ogg',
          patternIds: ['clap-drop', 'clap-drop', 'clap-buildup', 'clap-drop']
        },
        {
          id: 'hats-main',
          levelId: demoLevel3Id,
          type: 'percs',
          sampleUrl: 'https://actions.google.com/sounds/v1/swishes/air_whoosh.ogg',
          patternIds: ['hats-edm', 'hats-trap', 'hats-edm', 'hats-trap']
        },
        {
          id: 'afro-main',
          levelId: demoLevel4Id,
          type: 'misc',
          sampleUrl: 'https://actions.google.com/sounds/v1/cartoon/clown_horn.ogg',
          patternIds: ['misc-afro', 'misc-afro', 'misc-afro', 'misc-afro']
        }
      ];

      for (const snd of allSounds) {
        const soundRef = doc(db, 'levels', snd.levelId, 'sounds', snd.id);
        const soundSnap = await getDoc(soundRef);
        const existingSound = soundSnap.exists() ? soundSnap.data() : {};

        await setDoc(soundRef, {
          ...snd,
          sampleUrl: existingSound.sampleUrl || snd.sampleUrl
        }, { merge: true });
      }

      toast({
        title: "Database Ready",
        description: "Map and levels updated successfully!",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not initialize data.",
      });
    }
  };

  return (
    <div className="h-screen bg-[#050505] text-white font-body flex flex-col overflow-hidden select-none">
      <header className="p-6 flex flex-col items-center z-50">
        <div className="gemini-border gemini-glow p-4 inline-block mb-4">
          <div className="flex items-center gap-3">
            <Radio className="w-8 h-8 text-[#FFEA00]" />
            <div>
              <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none text-white">BeatHero</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-50 text-white">Select Destination</p>
            </div>
          </div>
        </div>

        <div className="gemini-border gemini-glow p-4 text-center">
          <div className="text-white font-bold text-xl leading-none tracking-tighter">
            {streetCred.toLocaleString()} <span className="text-[#FFEA00] italic ml-1 font-black">SC</span>
          </div>
          <div className="text-[10px] uppercase opacity-40 mt-1 font-bold tracking-widest text-white">Street Credibilities</div>
        </div>
      </header>

      <main className="relative flex-1 w-full bg-[#080808] overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                <path d="M 100 0 L 0 0 0 100" fill="none" stroke="white" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            <circle cx="30%" cy="40%" r="300" fill="#993DEB" className="blur-[150px] opacity-10" />
            <circle cx="70%" cy="30%" r="350" fill="#FF3D00" className="blur-[180px] opacity-10" />
          </svg>
        </div>

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
                    <div className="absolute inset-0 w-24 h-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/20 animate-ping opacity-20" />
                    
                    <div 
                      className="w-20 h-20 rounded-2xl bg-black border-2 border-white/20 flex items-center justify-center shadow-2xl relative z-10 transition-all group-hover:scale-110"
                      style={{ boxShadow: `0 0 30px ${studio.coverColor}44` }}
                    >
                      <Home className="w-10 h-10 text-white" />
                    </div>

                    <div className="mt-4 bg-black/90 backdrop-blur-md border border-white/20 px-6 py-3 rounded-xl transition-transform group-hover:-translate-y-1">
                      <h3 className="text-2xl font-black uppercase italic tracking-tighter whitespace-nowrap leading-none text-white">{studio.name}</h3>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-40">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 border-4 border-[#FFEA00] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-black uppercase tracking-[0.3em]">Downloading Area Data...</p>
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-72 z-50">
          <div className="gemini-border gemini-glow p-2 bg-black/40 backdrop-blur-md">
            <div className="h-44 w-full rounded-lg relative overflow-hidden bg-[#111]">
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
                      "absolute flex flex-col items-center gap-1 transition-all group cursor-pointer",
                      !isActive && "opacity-30"
                    )}
                    style={{ left: `${district.x}%`, top: `${district.y}%`, transform: 'translate(-50%, -50%)' }}
                  >
                    <div className={cn(
                      "w-3 h-3 rounded-full border border-white transition-all",
                      isActive 
                        ? "bg-[#FF3D00] shadow-[0_0_20px_#FF3D00] scale-110 animate-pulse" 
                        : "bg-white/10 border-white/20"
                    )} />
                    <div className={cn(
                      "bg-black/90 backdrop-blur-md border border-white/20 px-2 py-0.5 text-[7px] font-black uppercase tracking-widest whitespace-nowrap rounded transition-colors",
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
      </main>

      <footer className="p-4 border-t border-white/5 flex justify-end opacity-10 hover:opacity-100 transition-opacity">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={setupStudios}
          className="text-[10px] uppercase tracking-tighter gap-2 text-white"
        >
          <Settings className="w-3 h-3" />
          Map Setup
        </Button>
      </footer>
    </div>
  );
}
