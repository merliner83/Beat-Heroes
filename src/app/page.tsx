
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
  'gabriel-beats': { x: 20, y: 15 },
  'yoan-beats': { x: 80, y: 15 },
  'noxxos': { x: 50, y: 30 },
  'dave-beats': { x: 25, y: 55 },
  'nintu-music': { x: 75, y: 55 },
};

const StudioHouseFrame = ({ color, studioName }: { color: string, studioName: string }) => (
  <div className="relative flex flex-col items-center group cursor-pointer">
    {/* House Shape Container with Gemini Border */}
    <div 
      className="relative w-32 h-36 md:w-44 md:h-52 gemini-border gemini-glow transition-all duration-500 group-hover:scale-110 group-hover:-rotate-1 bg-black overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)]"
      style={{ 
        clipPath: 'polygon(50% 0%, 100% 35%, 100% 100%, 0% 100%, 0% 35%)',
        backgroundColor: color 
      }}
    >
      {/* Background Glow */}
      <div 
        className="absolute inset-0 blur-2xl opacity-30 group-hover:opacity-60 transition-opacity duration-700" 
        style={{ backgroundColor: color }} 
      />
      
      {/* Image filling the house shape */}
      <Avatar className="w-full h-full rounded-none border-none bg-black">
        <AvatarImage 
          src={`https://picsum.photos/seed/${studioName}/600/800`} 
          className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-110"
        />
        <AvatarFallback className="bg-black text-white font-black italic text-4xl rounded-none">
          {studioName.substring(0,2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* Glossy Overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-transparent to-white/10 pointer-events-none" />
    </div>

    {/* Massive Studio Name Label - No Frame */}
    <div className="mt-4 text-center pointer-events-none">
      <h3 className="text-2xl md:text-5xl font-black uppercase italic tracking-tighter text-white drop-shadow-[0_4px_15px_rgba(0,0,0,1)] group-hover:text-primary transition-colors leading-none">
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
        { id: 'gabriel-beats', name: 'Gabriel Beats', description: 'Urban grooves and heavy bass.', coverColor: '#993DEB' },
        { id: 'yoan-beats', name: 'Yoan Beats', description: 'Electronic textures and clean rhythm.', coverColor: '#FFEA00' },
        { id: 'noxxos', name: 'Noxxos', description: 'Experimental soundscapes.', coverColor: '#EB3D99' },
        { id: 'dave-beats', name: 'Dave Beats', description: 'Heavy boom bap.', coverColor: '#3838FA' },
        { id: 'nintu-music', name: 'Nintu Music', description: 'Deep house and tech vibes.', coverColor: '#00E676' }
      ];
      for (const s of studios) await setDoc(doc(db, 'studios', s.id), s, { merge: true });
      toast({ title: "Radar Synced!", description: "Districts live." });
    } catch (e) {
      toast({ variant: "destructive", title: "Setup Failed" });
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-body flex flex-col overflow-hidden select-none relative">
      {/* Background Urban Grid & FX */}
      <div className="absolute inset-0 opacity-[0.1] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#993DEB 1.5px, transparent 1.5px)', backgroundSize: '60px 60px' }} />
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(153,61,235,0.1) 1.5px, transparent 1.5px), linear-gradient(90deg, rgba(153,61,235,0.1) 1.5px, transparent 1.5px)', backgroundSize: '180px 180px' }} />
      
      <header className="p-8 flex flex-col items-center z-50">
        <div className="gemini-border gemini-glow p-5 px-12 inline-block mb-6 bg-black/70 backdrop-blur-xl">
          <div className="flex items-center gap-5">
            <Radio className="w-10 h-10 text-primary animate-pulse" />
            <div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic leading-none text-gradient">BeatHero</h1>
              <p className="text-[11px] uppercase tracking-[0.5em] font-black opacity-60 text-primary">Urban District Mapper</p>
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          <div className="gemini-border gemini-glow-accent p-4 px-12 text-center bg-black/70 backdrop-blur-xl border-2 border-primary/20">
            <div className="text-white font-black text-3xl md:text-4xl leading-none tracking-tighter flex items-center gap-3">
              <Zap className="w-6 h-6 text-primary" fill="currentColor" />
              {streetCred.toLocaleString()} <span className="text-primary italic font-black">SC</span>
            </div>
            <div className="text-[10px] uppercase opacity-50 mt-2 font-black tracking-[0.3em]">Street Credibility</div>
          </div>
        </div>
      </header>

      <main className="relative flex-1 w-full overflow-hidden p-4">
        {isLoadingStudios ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-14 h-14 animate-spin text-primary" />
          </div>
        ) : (
          <div className="absolute inset-0 max-w-full mx-auto pointer-events-none">
            {allStudios?.map((studio) => {
              const pos = STUDIO_COORDS[studio.id] || { x: 50, y: 30 };
              return (
                <div 
                  key={studio.id}
                  className="absolute transition-all duration-1000 ease-in-out animate-in fade-in zoom-in-90 pointer-events-auto"
                  style={{ 
                    left: `${pos.x}%`, 
                    top: `${pos.y}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <Link href={`/studio/${studio.id}`}>
                    <StudioHouseFrame color={studio.coverColor || '#993DEB'} studioName={studio.name} />
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* Tactical Mini Map - Massive & Extra Wide */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center w-full px-6 max-w-7xl">
          <div className="relative w-full h-72 md:h-[28rem] rounded-[4rem] border-[4px] border-white/20 bg-black/95 backdrop-blur-3xl overflow-hidden gemini-glow shadow-[0_0_100px_rgba(0,0,0,1)]">
            {/* Grid Overlay */}
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
            
            {/* Pulsing Radar Point - Massive */}
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="w-48 h-48 bg-primary rounded-full animate-ping opacity-10" />
               <div className="w-14 h-14 bg-primary rounded-full shadow-[0_0_80px_#993DEB] border-[4px] border-white/70" />
            </div>

            {/* District Labels - Extra Large & Bold */}
            <div className="absolute inset-0 p-16 flex flex-col justify-between">
              <div className="flex items-center gap-10 group">
                <div className="w-14 h-14 rounded-full bg-[#00E676] shadow-[0_0_60px_#00E676] border-[4px] border-white/70 animate-pulse" />
                <span className="text-5xl md:text-8xl font-black uppercase tracking-tighter text-[#00E676] italic drop-shadow-[0_4px_12px_rgba(0,0,0,1)]">BANTIGER</span>
              </div>
              <div className="flex items-center gap-10 self-end text-right">
                <span className="text-5xl md:text-8xl font-black uppercase tracking-tighter text-[#EB3D99] italic drop-shadow-[0_4px_12px_rgba(0,0,0,1)]">OBEREMMENTAL</span>
                <div className="w-14 h-14 rounded-full bg-[#EB3D99] shadow-[0_0_60px_#EB3D99] border-[4px] border-white/70 animate-pulse" />
              </div>
            </div>

            {/* Radar Sweep FX */}
            <div className="absolute inset-0 origin-center bg-gradient-to-tr from-transparent via-primary/20 to-transparent animate-[spin_8s_linear_infinite]" />
          </div>
          
          <div className="mt-6 text-[8px] md:text-[10px] font-black uppercase tracking-[1em] text-primary/40 text-center italic leading-none pointer-events-none select-none">
            districts
          </div>
        </div>
      </main>

      <footer className="p-6 border-t border-white/5 bg-black/98 flex justify-between items-center z-50">
        <div className="flex items-center gap-3 opacity-50">
          <MapIcon className="w-5 h-5 text-primary" />
          <span className="text-[11px] uppercase font-black tracking-[0.4em]">City Scanner Active - v2.5</span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={setupStudios} 
          className="text-[11px] uppercase tracking-tighter gap-3 opacity-60 hover:opacity-100 group h-12 px-8 hover:bg-white/5 font-black"
        >
          <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-1000" /> Rack Sync
        </Button>
      </footer>
    </div>
  );
}
