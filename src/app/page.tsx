
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCollection, useFirestore, useMemoFirebase, useDoc, useUser } from '@/firebase';
import { collection, query, doc, setDoc, getDoc } from 'firebase/firestore';
import { Studio } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { useAuth } from '@/firebase/provider';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Radio, RefreshCw, Loader2, Zap, Search } from 'lucide-react';

const StudioCard = ({ studio }: { studio: Studio }) => (
  <div className="relative group cursor-pointer transition-all duration-500 overflow-hidden rounded-lg border border-white/5 bg-black/40 backdrop-blur-xl hover:border-primary/50 shadow-2xl flex flex-col h-full">
    <div className="relative aspect-square w-full overflow-hidden shrink-0">
      {studio.imageUrl ? (
        <Image
          src={studio.imageUrl}
          alt={studio.name}
          fill
          className="object-cover opacity-60 group-hover:scale-110 group-hover:opacity-100 transition-all duration-1000"
          sizes="(max-width: 640px) 33vw, (max-width: 1024px) 15vw, 10vw"
          data-ai-hint="music studio"
        />
      ) : (
        <div className="absolute inset-0 opacity-40" style={{ backgroundColor: studio.coverColor }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
    </div>
    
    <div className="p-2 md:p-3 flex flex-col gap-0.5 justify-center flex-1 bg-black/20">
      {studio.district && (
        <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-primary/80 truncate">
          {studio.district}
        </span>
      )}
      <h3 className="text-[9px] md:text-[11px] font-black uppercase italic tracking-tighter text-white group-hover:text-primary transition-colors leading-tight truncate">
        {studio.name}
      </h3>
    </div>
    
    <div 
      className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-1000 pointer-events-none -z-10"
      style={{ backgroundColor: studio.coverColor }}
    />
  </div>
);

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

  const dynamicTags = useMemo(() => {
    if (!allStudios) return ['All'];
    const tagsSet = new Set<string>(['All']);
    allStudios.forEach(s => {
      s.tags?.forEach(tag => tagsSet.add(tag));
    });
    return Array.from(tagsSet);
  }, [allStudios]);

  const filteredStudios = useMemo(() => {
    if (!allStudios) return [];
    return allStudios.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           s.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = selectedTag === 'All' || 
                        s.tags?.some(t => t.toLowerCase() === selectedTag.toLowerCase());
      return matchesSearch && matchesTag;
    });
  }, [allStudios, searchQuery, selectedTag]);

  const setupStudios = async () => {
    if (!db) return;
    try {
      const tracks = [
        { id: 'track-glitch', name: 'Glitch Power', author: 'BeatBot', duration: 64, url: 'https://actions.google.com/sounds/v1/science_fiction/glitch_low_power.ogg' },
        { id: 'track-hum', name: 'System Hum', author: 'Cyborg', duration: 120, url: 'https://actions.google.com/sounds/v1/science_fiction/low_power_hum.ogg' },
        { id: 'track-techno', name: 'Techno Core', author: 'Neon', duration: 90, url: 'https://actions.google.com/sounds/v1/science_fiction/techno_ambience.ogg' },
        { id: 'track-space', name: 'Space Drift', author: 'Astro', duration: 180, url: 'https://actions.google.com/sounds/v1/science_fiction/deep_space_drone.ogg' }
      ];

      for (const t of tracks) {
        await setDoc(doc(db, 'tracks', t.id), t, { merge: true });
      }

      const studios = [
        { id: 'gabriel-beats', name: 'Gabriel Beats', description: 'Urban grooves and heavy bass.', tags: ['Urban', 'Hip-Hop'], coverColor: '#FF3399', district: 'Bantiger', imageUrl: 'https://picsum.photos/seed/gabriel-beats/800/800', linkUrl: 'https://instagram.com/beathero', linkLabel: 'Instagram' },
        { id: 'yoan-beats', name: 'Yoan Beats', description: 'Electronic textures and clean rhythm.', tags: ['Electronic', 'House'], coverColor: '#FFEA00', district: 'Bantiger', imageUrl: 'https://picsum.photos/seed/yoan-beats/800/800', linkUrl: 'https://soundcloud.com', linkLabel: 'SoundCloud' },
        { id: 'noxxos', name: 'Noxxos', description: 'Experimental soundscapes.', tags: ['Experimental', 'Electronic'], coverColor: '#FF3D00', district: 'Oberemmental', imageUrl: 'https://picsum.photos/seed/noxxos/800/800', linkUrl: 'https://noxxos.music', linkLabel: 'Website' },
        { id: 'dave-beats', name: 'Dave Beats', description: 'Heavy boom bap and Hip-Hop.', tags: ['Hip-Hop', 'Urban'], coverColor: '#FF9100', district: 'Bantiger', imageUrl: 'https://picsum.photos/seed/dave-beats/800/800' },
        { id: 'nintu-music', name: 'Nintu Music', description: 'Deep House and tech vibes.', tags: ['House', 'Electronic'], coverColor: '#00E676', district: 'Bantiger', imageUrl: 'https://picsum.photos/seed/nintu-music/800/800' },
        { id: 'dj-avox', name: 'DJ Avox', description: 'Deep house and vocal grooves.', tags: ['House'], coverColor: '#00B0FF', district: 'Bantiger', imageUrl: 'https://picsum.photos/seed/dj-avox/800/800' },
        { id: 'nelio-beats', name: 'Nelio Beats', description: 'Classic hip-hop and soul.', tags: ['Hip-Hop'], coverColor: '#FF6D00', district: 'Bantiger', imageUrl: 'https://picsum.photos/seed/nelio-beats/800/800' }
      ];

      for (const s of studios) {
        await setDoc(doc(db, 'studios', s.id), s, { merge: true });
      }

      const patterns = [
        { id: 'kick-p1', name: 'Kick Progression', steps: [0, 14, 16, 30, 32, 46, 48, 62, 64, 78, 80, 84, 96, 110, 112, 114, 126] },
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

      for (const studio of studios) {
        const gameConfigs = [
          { id: 'beat-hero', name: 'Beat Hero', type: 'rhythm-producer', bpm: 120 },
          { id: 'vinyl-hunter', name: 'Vinyl Hunter', type: 'sample-hunter', bpm: 128 },
          { id: 'sonic-dash', name: 'Sonic Dash', type: 'disk-dash', bpm: 124 }
        ];

        for (const config of gameConfigs) {
          const gameId = `${studio.id}-${config.id}`;
          const trackIndex = (studios.indexOf(studio) + gameConfigs.indexOf(config)) % tracks.length;
          const selectedTrack = tracks[trackIndex];

          await setDoc(doc(db, 'games', gameId), {
            id: gameId,
            studioId: studio.id,
            name: config.name,
            type: config.type,
            bpm: config.bpm,
            difficulty: 1,
            trackId: selectedTrack.id,
            backingTrackUrl: selectedTrack.url
          }, { merge: true });

          for (let i = 1; i <= 4; i++) {
            const levelId = `${gameId}-lvl-${i}`;
            await setDoc(doc(db, 'levels', levelId), {
              id: levelId,
              gameId: gameId,
              difficulty: i,
              name: `lvl ${i}`
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
              await setDoc(doc(db, 'levels', levelId, 'sounds', soundId), {
                id: soundId,
                levelId: levelId,
                type: s.type,
                sampleUrl: s.sample,
                patternIds: s.pIds
              }, { merge: true });
            }
          }
        }
      }

      toast({ title: "Rack Synchronized!", description: "All studios assigned to their districts." });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Sync Failed" });
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
                <Zap className="w-3.5 h-3.5 text-[#FFEA00]" fill="currentColor" />
                {streetCred.toLocaleString()} <span className="text-primary italic font-black">SC</span>
              </div>
            </div>
          </div>

          <div className="relative w-full md:w-80 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Search Studios..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 bg-white/5 border-white/10 rounded-full focus:ring-primary focus:border-primary placeholder:text-white/10 text-xs font-bold uppercase tracking-widest"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4 overflow-x-auto w-full max-w-7xl pb-1 scrollbar-hide no-scrollbar">
          {dynamicTags.map(tag => (
            <Button
              key={tag}
              variant="ghost"
              size="sm"
              onClick={() => setSelectedTag(tag)}
              className={cn(
                "rounded-full text-[10px] font-black uppercase tracking-[0.15em] px-4 h-8 border transition-all shrink-0",
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

      <main className="relative flex-1 w-full max-w-7xl mx-auto py-6 md:py-10 px-4 md:px-6">
        {isLoadingStudios ? (
          <div className="h-64 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-[9px] font-black uppercase tracking-[0.4em] opacity-30">Connecting to Rack...</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 md:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {filteredStudios.map((studio) => (
              <Link key={studio.id} href={`/studio/${studio.id}`} className="block transform transition-transform hover:scale-[1.03] active:scale-95">
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
      </main>

      <footer className="sticky bottom-0 p-3 md:p-4 border-t border-white/5 bg-black/95 backdrop-blur-2xl flex justify-between items-center z-50 shrink-0">
        <div className="flex items-center gap-3 opacity-30">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-[9px] uppercase font-black tracking-[0.2em] hidden sm:inline">Modular Rack System Online</span>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/30 hidden md:block italic">
            {filteredStudios.length} Active Studios
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={setupStudios} 
            className="bg-[#FFEA00] text-black hover:bg-[#FFEA00]/90 font-black uppercase italic tracking-tighter border-none shadow-[0_0_15px_rgba(255,234,0,0.2)] h-10 md:h-12 px-8 md:px-12 text-sm md:text-base transition-transform active:scale-95"
          >
            <RefreshCw className="w-4 h-4 md:w-5 md:h-5 mr-3" /> Rack Sync
          </Button>
        </div>
      </footer>
    </div>
  );
}

