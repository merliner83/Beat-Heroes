
"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, useDoc, useUser } from '@/firebase';
import { collection, query, doc, setDoc, getDoc } from 'firebase/firestore';
import { Radio, RefreshCw, Loader2, Map as MapIcon, Zap } from 'lucide-react';
import { Studio } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { useAuth } from '@/firebase/provider';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const StudioCard = ({ color, studioName, imageUrl }: { color: string, studioName: string, imageUrl?: string }) => (
  <div className="relative group cursor-pointer transition-all duration-500">
    <div className="relative aspect-[3/4] w-full max-w-[180px] md:max-w-[240px] mx-auto overflow-hidden rounded-[2rem] border-2 border-white/5 bg-black/40 backdrop-blur-xl group-hover:border-primary/50 transition-all duration-700">
      <div className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity duration-700" style={{ backgroundColor: color }} />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/90 z-10" />
      
      <div className="relative h-full w-full flex flex-col items-center justify-center p-4 md:p-6 z-20">
        <div className="flex-1 w-full flex items-center justify-center">
          {imageUrl && imageUrl.length > 0 ? (
            <img 
              src={imageUrl} 
              alt={studioName}
              className="object-contain w-full h-4/5 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-transform duration-700 group-hover:scale-110"
            />
          ) : (
            <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
               <span className="text-white/20 font-black italic text-4xl md:text-6xl uppercase">{studioName.substring(0,1)}</span>
            </div>
          )}
        </div>
        
        <div className="w-full text-center mt-2">
          <h3 className="text-sm md:text-lg font-black uppercase italic tracking-tighter text-white drop-shadow-[0_4px_12px_rgba(0,0,0,1)] line-clamp-2">
            {studioName}
          </h3>
          <div className="mt-1 h-0.5 w-8 bg-primary mx-auto rounded-full group-hover:w-16 transition-all duration-500" />
        </div>
      </div>
    </div>
    
    <div 
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-[80px] opacity-0 group-hover:opacity-20 transition-opacity duration-1000 pointer-events-none -z-10"
      style={{ backgroundColor: color }}
    />
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

  useEffect(() => {
    if (user && db) {
      const userRef = doc(db, 'users', user.uid);
      getDoc(userRef).then(snap => {
        if (!snap.exists()) {
          setDoc(userRef, { uid: user.uid, streetCred: 0 }, { merge: true });
        }
      });
    }
  }, [user, db]);

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
        { id: 'nelio-beats', name: 'Nelio Beats', description: 'Classic hip-hop and soul.', coverColor: '#FF6D00' }
      ];

      for (const s of studios) {
        const studioRef = doc(db, 'studios', s.id);
        const studioSnap = await getDoc(studioRef);
        const studioData: any = { ...s };
        if (studioSnap.exists()) {
          const existing = studioSnap.data();
          if (existing?.imageUrl) studioData.imageUrl = existing.imageUrl;
        }
        await setDoc(studioRef, studioData, { merge: true });
      }

      const patterns = [
        { id: 'kick-p1', name: 'Kick Intro', steps: [0, 16, 32, 48, 64, 80, 96, 110, 112, 126] }, 
        { id: 'kick-p2', name: 'Kick Main', steps: Array.from({ length: 32 }, (_, i) => i * 4) }, 
        { id: 'clap-p1', name: 'Clap Basic', steps: [4, 12, 20, 28, 36, 44, 52, 60, 68, 76, 84, 92, 100, 108, 116, 124] },
        { id: 'clap-p2', name: 'Clap Var', steps: [4, 12, 14, 20, 28, 30, 36, 44, 46, 52, 60, 62, 68, 76, 78, 84, 92, 94, 100, 108, 110, 116, 124, 126] },
        { id: 'perc-p1', name: 'Perc Basic', steps: [18, 22, 50, 54, 82, 86, 114, 118] },
        { id: 'perc-p2', name: 'Perc Active', steps: Array.from({ length: 16 }, (_, i) => (i * 8) + 18) },
        { id: 'misc-p1', name: 'Misc Ambience', steps: [0, 64] },
        { id: 'misc-p2', name: 'Misc Accents', steps: [16, 48, 80, 112] },
      ];

      for (const p of patterns) {
        await setDoc(doc(db, 'patterns', p.id), p, { merge: true });
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
          { id: 'vinyl-hunter', name: 'Vinyl Hunter', type: 'sample-hunter', bpm: 128 },
          { id: 'sonic-dash', name: 'Sonic Dash', type: 'disk-dash', bpm: 124 }
        ];

        for (const config of gameConfigs) {
          const gameId = `${studio.id}-${config.id}`;
          const gameDocRef = doc(db, 'games', gameId);
          const gameSnap = await getDoc(gameDocRef);
          
          const trackIndex = (studios.indexOf(studio) + gameConfigs.indexOf(config)) % backingTracks.length;
          const defaultBackingTrack = backingTracks[trackIndex];

          const gameData: any = {
            id: gameId,
            studioId: studio.id,
            name: config.name,
            type: config.type,
            bpm: config.bpm,
            difficulty: 1
          };

          if (gameSnap.exists()) {
            const existing = gameSnap.data();
            if (existing?.backingTrackUrl) gameData.backingTrackUrl = existing.backingTrackUrl;
            else gameData.backingTrackUrl = defaultBackingTrack;
            if (existing?.backgroundImageUrl) gameData.backgroundImageUrl = existing.backgroundImageUrl;
          } else {
            gameData.backingTrackUrl = defaultBackingTrack;
          }

          await setDoc(gameDocRef, gameData, { merge: true });

          for (let i = 1; i <= 4; i++) {
            const levelId = `${gameId}-lvl-${i}`;
            await setDoc(doc(db, 'levels', levelId), {
              id: levelId,
              gameId: gameId,
              difficulty: i,
              name: i === 1 ? 'Initiation' : i === 2 ? 'The Pulse' : i === 3 ? 'Modular' : 'Master'
            }, { merge: true });

            const soundSet = [
              { type: 'kick', sample: 'https://actions.google.com/sounds/v1/impacts/wood_block_impact.ogg', pIds: ['kick-p1', 'kick-p2'] },
              { type: 'clap', sample: 'https://actions.google.com/sounds/v1/doors/door_knock_3.ogg', pIds: ['clap-p1', 'clap-p2'] },
              { type: 'percs', sample: 'https://actions.google.com/sounds/v1/cartoon/clown_horn.ogg', pIds: ['perc-p1', 'perc-p2'] },
              { type: 'misc', sample: 'https://actions.google.com/sounds/v1/swishes/air_whoosh.ogg', pIds: ['misc-p1', 'misc-p2'] },
            ];

            for (let j = 0; j < i; j++) {
              const s = soundSet[j];
              const soundId = `sound-${levelId}-${s.type}`;
              const soundDocRef = doc(db, 'levels', levelId, 'sounds', soundId);
              const soundSnap = await getDoc(soundDocRef);

              const soundData: any = { id: soundId, levelId: levelId, type: s.type, patternIds: s.pIds };
              if (soundSnap.exists()) {
                const existing = soundSnap.data();
                if (existing?.sampleUrl) soundData.sampleUrl = existing.sampleUrl;
                else soundData.sampleUrl = s.sample;
              } else {
                soundData.sampleUrl = s.sample;
              }
              await setDoc(soundDocRef, soundData, { merge: true });
            }
          }
        }
      }

      toast({ title: "Radar Synced!", description: "All studio modules updated." });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Setup Failed" });
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-body flex flex-col overflow-hidden select-none relative">
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#FF3399 1.5px, transparent 1.5px)', backgroundSize: '60px 60px' }} />
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,51,153,0.1) 1.5px, transparent 1.5px), linear-gradient(90deg, rgba(255,51,153,0.1) 1.5px, transparent 1.5px)', backgroundSize: '180px 180px' }} />
      
      <header className="p-4 md:p-8 flex flex-col items-center z-50 shrink-0">
        <div className="gemini-border gemini-glow p-2 px-6 md:p-3 md:px-10 inline-block mb-4 bg-black/80 backdrop-blur-3xl">
          <div className="flex items-center gap-2 md:gap-4">
            <Radio className="w-5 h-5 md:w-8 md:h-8 text-white animate-pulse" />
            <h1 className="text-xl md:text-5xl font-black tracking-tighter uppercase italic leading-none text-white">BeatHero</h1>
          </div>
        </div>

        <div className="gemini-border gemini-glow-accent p-1 px-6 md:p-2 md:px-10 text-center bg-black/80 backdrop-blur-3xl border border-white/5">
          <div className="text-white font-black text-lg md:text-3xl leading-none tracking-tighter flex items-center gap-2 md:gap-3">
            <Zap className="w-4 h-4 md:w-5 md:h-5 text-[#FFEA00]" fill="currentColor" />
            {streetCred.toLocaleString()} <span className="text-primary italic font-black">SC</span>
          </div>
        </div>
      </header>

      <main className="relative flex-1 w-full flex flex-col justify-center overflow-hidden py-4 md:py-12">
        {isLoadingStudios ? (
          <div className="flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-12 h-12 md:w-16 md:h-16 animate-spin text-primary" />
            <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.5em] opacity-30">Loading Rack...</p>
          </div>
        ) : (
          <div className="w-full px-4 md:px-0">
            <Carousel
              opts={{
                align: "center",
                loop: true,
              }}
              className="w-full max-w-7xl mx-auto"
            >
              <CarouselContent className="-ml-2 md:-ml-4">
                {allStudios?.map((studio) => (
                  <CarouselItem key={studio.id} className="pl-2 md:pl-4 basis-1/2 sm:basis-1/3 lg:basis-1/4 xl:basis-1/5">
                    <Link href={`/studio/${studio.id}`}>
                      <StudioCard 
                        color={studio.coverColor || '#FF3399'} 
                        studioName={studio.name} 
                        imageUrl={studio.imageUrl} 
                      />
                    </Link>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <div className="hidden lg:block">
                <CarouselPrevious className="bg-black/50 border-white/10 hover:bg-primary hover:text-white transition-all w-10 h-10 -left-12" />
                <CarouselNext className="bg-black/50 border-white/10 hover:bg-primary hover:text-white transition-all w-10 h-10 -right-12" />
              </div>
            </Carousel>
          </div>
        )}

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center w-full px-4 max-w-[280px] pointer-events-none">
          <div className="relative w-full h-16 md:h-24 gemini-border gemini-glow bg-black/95 backdrop-blur-3xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,1)] border border-white/5">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '15px 15px' }} />
            
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="w-8 h-8 md:w-12 md:h-12 rounded-full border border-white/20 animate-[ping_3s_linear_infinite]" />
            </div>

            <div className="absolute left-[8%] top-[15%] flex flex-col items-start gap-0.5">
              <div className="w-1 h-1 rounded-full bg-[#00E676] shadow-[0_0_10px_#00E676] animate-pulse" />
              <span className="text-[6px] md:text-[8px] font-black uppercase tracking-widest text-[#00E676] italic">ACTIVE</span>
            </div>

            <div className="absolute right-[8%] bottom-[15%] flex flex-col items-end gap-0.5">
              <div className="w-1 h-1 rounded-full bg-primary shadow-[0_0_10px_#FF3399] animate-pulse" />
              <span className="text-[6px] md:text-[8px] font-black uppercase tracking-widest text-primary italic">SYNC</span>
            </div>

            <div 
              className="absolute inset-0 origin-center animate-[spin_10s_linear_infinite] opacity-20" 
              style={{ 
                background: 'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(255, 255, 255, 0.2) 120deg, transparent 360deg)' 
              }}
            />
          </div>
          <div className="mt-1 md:mt-2 text-[6px] md:text-[8px] font-black uppercase tracking-[0.5em] text-primary/40 text-center italic leading-none">
            district scanner
          </div>
        </div>
      </main>

      <footer className="p-3 md:p-4 border-t border-white/5 bg-black/98 flex justify-between items-center z-50 shrink-0">
        <div className="flex items-center gap-2 md:gap-3 opacity-30">
          <MapIcon className="w-3 h-3 md:w-4 md:h-4 text-primary" />
          <span className="text-[8px] md:text-[10px] uppercase font-black tracking-[0.3em] hidden sm:inline">Modular Rack Online</span>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={setupStudios} 
          className="bg-[#FFEA00] text-black hover:bg-[#FFEA00]/90 font-black uppercase italic tracking-tighter border-none shadow-[0_0_20px_rgba(255,234,0,0.3)] h-10 md:h-12 px-4 md:px-8 text-xs md:text-sm"
        >
          <RefreshCw className="w-3 h-3 md:w-4 md:h-4 mr-2 md:mr-3" /> Rack Sync
        </Button>
      </footer>
    </div>
  );
}

    