"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCollection, useFirestore, useMemoFirebase, useDoc, useUser } from '@/firebase';
import { collection, query, doc, setDoc, getDoc } from 'firebase/firestore';
import { Radio, RefreshCw, Loader2, Map as MapIcon, Zap, Search, SlidersHorizontal, Tag } from 'lucide-react';
import { Studio } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { useAuth } from '@/firebase/provider';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const StudioCard = ({ studio }: { studio: Studio }) => (
  <div className="relative group cursor-pointer transition-all duration-500 h-full">
    <div className="relative h-64 md:h-80 overflow-hidden rounded-3xl border-2 border-white/5 bg-black/60 backdrop-blur-xl group-hover:border-primary/50 transition-all duration-700 shadow-2xl flex flex-col">
      {/* Background Image */}
      {studio.imageUrl ? (
        <div className="absolute inset-0">
          <Image
            src={studio.imageUrl}
            alt={studio.name}
            fill
            className="object-cover opacity-60 group-hover:scale-110 group-hover:opacity-100 transition-all duration-1000"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            data-ai-hint="music studio"
          />
        </div>
      ) : (
        <div className="absolute inset-0 opacity-20" style={{ backgroundColor: studio.coverColor }} />
      )}

      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10" />
      <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-700 z-10" />
      
      {/* Content */}
      <div className="relative flex-1 p-6 z-20 flex flex-col justify-end">
        <div className="flex justify-between items-end gap-4">
          <div className="flex-1">
             {studio.district && (
              <Badge variant="outline" className="mb-3 border-white/10 text-[9px] font-black uppercase tracking-widest text-white/70 bg-black/60 backdrop-blur-md px-3 py-1">
                {studio.district}
              </Badge>
            )}
            <h3 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-white group-hover:text-primary transition-colors leading-none">
              {studio.name}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:border-primary/50 group-hover:bg-primary/10 transition-all duration-500 backdrop-blur-sm">
             <span className="text-white/30 font-black italic text-lg uppercase group-hover:text-primary transition-colors">{studio.name.substring(0,1)}</span>
          </div>
        </div>
      </div>
    </div>
    
    {/* Ambient Glow */}
    <div 
      className="absolute -inset-2 rounded-[2.5rem] blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-1000 pointer-events-none -z-10"
      style={{ backgroundColor: studio.coverColor }}
    />
  </div>
);

const TAGS = ["All", "Urban", "Electronic", "Experimental", "House", "Hip-Hop"];

export default function HomePage() {
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('All');

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

  const filteredStudios = useMemo(() => {
    if (!allStudios) return [];
    return allStudios.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           s.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = selectedTag === 'All' || 
                        s.description.toLowerCase().includes(selectedTag.toLowerCase()) ||
                        (s.district && s.district.toLowerCase().includes(selectedTag.toLowerCase()));
      return matchesSearch && matchesTag;
    });
  }, [allStudios, searchQuery, selectedTag]);

  const setupStudios = async () => {
    if (!db) return;
    try {
      const studios = [
        { id: 'gabriel-beats', name: 'Gabriel Beats', description: 'Urban grooves and heavy bass.', coverColor: '#FF3399', district: 'Downtown', imageUrl: 'https://picsum.photos/seed/gabriel-beats/800/1000' },
        { id: 'yoan-beats', name: 'Yoan Beats', description: 'Electronic textures and clean rhythm.', coverColor: '#FFEA00', district: 'Industry', imageUrl: 'https://picsum.photos/seed/yoan-beats/800/1000' },
        { id: 'noxxos', name: 'Noxxos', description: 'Experimental soundscapes.', coverColor: '#FF3D00', district: 'Unknown', imageUrl: 'https://picsum.photos/seed/noxxos/800/1000' },
        { id: 'dave-beats', name: 'Dave Beats', description: 'Heavy boom bap and Hip-Hop.', coverColor: '#FF9100', district: 'Bronx', imageUrl: 'https://picsum.photos/seed/dave-beats/800/1000' },
        { id: 'nintu-music', name: 'Nintu Music', description: 'Deep House and tech vibes.', coverColor: '#00E676', district: 'Berlin', imageUrl: 'https://picsum.photos/seed/nintu-music/800/1000' },
        { id: 'dj-avox', name: 'DJ Avox', description: 'Deep house and vocal grooves.', coverColor: '#00B0FF', district: 'Miami', imageUrl: 'https://picsum.photos/seed/dj-avox/800/1000' },
        { id: 'nelio-beats', name: 'Nelio Beats', description: 'Classic hip-hop and soul.', coverColor: '#FF6D00', district: 'Harlem', imageUrl: 'https://picsum.photos/seed/nelio-beats/800/1000' }
      ];

      for (const s of studios) {
        const studioRef = doc(db, 'studios', s.id);
        const studioSnap = await getDoc(studioRef);
        const studioData: any = { ...s };
        
        if (studioSnap.exists()) {
          const existing = studioSnap.data();
          // Protect existing custom URLs
          if (existing?.imageUrl) studioData.imageUrl = existing.imageUrl;
        }
        await setDoc(studioRef, studioData, { merge: true });
      }

      const patterns = [
        { 
          id: 'kick-p1', 
          name: 'Kick Progression', 
          steps: [0, 14, 16, 30, 32, 46, 48, 62, 64, 78, 80, 84, 96, 110, 112, 114, 126] 
        },
        { id: 'kick-p2', name: 'Kick Main 4/4', steps: Array.from({ length: 32 }, (_, i) => i * 4) },
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

      toast({ title: "Rack Synchronized!", description: "All studio modules have been updated." });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Setup Failed" });
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-body flex flex-col relative select-none">
      <div className="fixed inset-0 opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#FF3399 1.5px, transparent 1.5px)', backgroundSize: '60px 60px' }} />
      
      <header className="sticky top-0 p-4 md:p-6 flex flex-col items-center z-50 shrink-0 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full max-w-7xl justify-between">
          <div className="flex items-center gap-3">
            <div className="gemini-border gemini-glow p-2 px-5 bg-black/80 backdrop-blur-3xl">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-white animate-pulse" />
                <h1 className="text-lg md:text-2xl font-black tracking-tighter uppercase italic leading-none text-white">BeatHero</h1>
              </div>
            </div>

            <div className="gemini-border gemini-glow-accent p-1.5 px-4 bg-black/80 backdrop-blur-3xl border border-white/5">
              <div className="text-white font-black text-sm md:text-lg leading-none tracking-tighter flex items-center gap-2">
                <Zap className="w-3 h-3 text-[#FFEA00]" fill="currentColor" />
                {streetCred.toLocaleString()} <span className="text-primary italic font-black">SC</span>
              </div>
            </div>
          </div>

          <div className="relative w-full md:w-80 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Search Studios..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 bg-white/5 border-white/10 rounded-full focus:ring-primary focus:border-primary placeholder:text-white/10 text-xs font-bold uppercase tracking-widest"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4 overflow-x-auto w-full max-w-7xl pb-2 scrollbar-hide no-scrollbar">
          {TAGS.map(tag => (
            <Button
              key={tag}
              variant="ghost"
              size="sm"
              onClick={() => setSelectedTag(tag)}
              className={cn(
                "rounded-full text-[10px] font-black uppercase tracking-[0.2em] px-5 h-8 border transition-all",
                selectedTag === tag 
                  ? "bg-primary border-primary text-white" 
                  : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"
              )}
            >
              {tag}
            </Button>
          ))}
        </div>
      </header>

      <main className="relative flex-1 w-full max-w-7xl mx-auto py-8 px-4 md:px-6">
        {isLoadingStudios ? (
          <div className="h-64 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-[8px] font-black uppercase tracking-[0.5em] opacity-30">Connecting to Rack...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {filteredStudios.map((studio) => (
              <Link key={studio.id} href={`/studio/${studio.id}`}>
                <StudioCard studio={studio} />
              </Link>
            ))}
            
            {filteredStudios.length === 0 && (
              <div className="col-span-full py-20 text-center opacity-20">
                 <Radio className="w-12 h-12 mx-auto mb-4" />
                 <p className="text-xs font-black uppercase tracking-widest italic">No studios matching search criteria</p>
              </div>
            )}
          </div>
        )}

        {/* Decorative Radar Element */}
        <div className="fixed bottom-24 right-8 z-50 pointer-events-none hidden lg:block">
           <div className="w-24 h-24 gemini-border gemini-glow bg-black/95 backdrop-blur-3xl overflow-hidden border border-white/5 relative">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="w-4 h-4 rounded-full border border-white/10 animate-ping" />
              </div>
              <div 
                className="absolute inset-0 origin-center animate-[spin_8s_linear_infinite] opacity-10" 
                style={{ background: 'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(255, 255, 255, 0.4) 120deg, transparent 360deg)' }}
              />
              <div className="absolute bottom-2 left-2 flex items-center gap-1">
                 <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                 <span className="text-[6px] font-black uppercase tracking-widest opacity-40">Scan</span>
              </div>
           </div>
        </div>
      </main>

      <footer className="sticky bottom-0 p-3 md:p-5 border-t border-white/5 bg-black/95 backdrop-blur-2xl flex justify-between items-center z-50 shrink-0">
        <div className="flex items-center gap-2 opacity-30">
          <MapIcon className="w-4 h-4 text-primary" />
          <span className="text-[8px] md:text-[9px] uppercase font-black tracking-[0.2em] hidden sm:inline">Modular Rack System Online</span>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/30 hidden md:block italic">
            {filteredStudios.length} Active Studios Loaded
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={setupStudios} 
            className="bg-[#FFEA00] text-black hover:bg-[#FFEA00]/90 font-black uppercase italic tracking-tighter border-none shadow-[0_0_20px_rgba(255,234,0,0.3)] h-12 md:h-14 px-8 md:px-12 text-sm md:text-base transition-transform active:scale-95"
          >
            <RefreshCw className="w-4 h-4 md:w-5 md:h-5 mr-3" /> Rack Sync
          </Button>
        </div>
      </footer>
    </div>
  );
}