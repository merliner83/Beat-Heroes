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
  'noxxos': { x: 50, y: 25 },
  'dave-beats': { x: 25, y: 45 },
  'nintu-music': { x: 75, y: 45 },
};

const StudioHouseFrame = ({ color, studioName }: { color: string, studioName: string }) => (
  <div className="relative flex flex-col items-center group cursor-pointer">
    {/* House Shape Container with Colored Dynamic Border */}
    <div 
      className="relative w-28 h-32 md:w-36 md:h-44 transition-all duration-500 group-hover:scale-110 group-hover:-rotate-1 overflow-hidden"
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
        {/* Background Glow */}
        <div 
          className="absolute inset-0 blur-2xl opacity-10 group-hover:opacity-40 transition-opacity duration-700" 
          style={{ backgroundColor: color }} 
        />
        
        {/* Heavily Darkened Image filling the house shape */}
        <Avatar className="w-full h-full rounded-none border-none bg-black">
          <AvatarImage 
            src={`https://picsum.photos/seed/${studioName}-dark/600/800`} 
            className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-110 brightness-[0.35] contrast-[1.1] grayscale-[0.4]"
            data-ai-hint="dark building"
          />
          <AvatarFallback className="bg-black text-white/10 font-black italic text-4xl rounded-none">
            {studioName.substring(0,1).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Dark Overlay Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />
      </div>
    </div>

    {/* Studio Name Label */}
    <div className="mt-3 text-center pointer-events-none">
      <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-white/90 drop-shadow-[0_4px_10px_rgba(0,0,0,1)] group-hover:text-primary transition-colors leading-none">
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
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#FF3399 1.5px, transparent 1.5px)', backgroundSize: '60px 60px' }} />
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,51,153,0.1) 1.5px, transparent 1.5px), linear-gradient(90deg, rgba(255,51,153,0.1) 1.5px, transparent 1.5px)', backgroundSize: '180px 180px' }} />
      
      <header className="p-6 md:p-8 flex flex-col items-center z-50">
        <div className="gemini-border gemini-glow p-4 px-10 inline-block mb-4 bg-black/80 backdrop-blur-2xl">
          <div className="flex items-center gap-4">
            <Radio className="w-8 h-8 text-primary animate-pulse" />
            <div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic leading-none text-gradient">BeatHero</h1>
              <p className="text-[9px] uppercase tracking-[0.4em] font-black opacity-60 text-[#FF9100]">Urban District Mapper</p>
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
                    <StudioHouseFrame color={studio.coverColor || '#FF3399'} studioName={studio.name} />
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* Tactical Mini Map - Narrower, Taller, Random Positioning */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center w-full px-6 max-w-[600px]">
          <div className="relative w-full h-48 md:h-56 rounded-[2rem] border-2 border-white/10 bg-black/95 backdrop-blur-3xl overflow-hidden gemini-glow shadow-[0_0_100px_rgba(0,0,0,1)]">
            {/* Grid Overlay */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            
            {/* Bantiger - Offset Position */}
            <div className="absolute left-[20%] top-[25%] flex flex-col items-center gap-2 group">
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-[#00E676] shadow-[0_0_20px_#00E676] border-2 border-white/70 animate-pulse" />
              <span className="text-xl md:text-2xl font-black uppercase tracking-tighter text-[#00E676] italic drop-shadow-[0_2px_10px_rgba(0,0,0,1)]">BANTIGER</span>
            </div>

            {/* Oberemmental - Offset Position */}
            <div className="absolute right-[20%] bottom-[25%] flex flex-col items-center gap-2">
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-[#FF3D00] shadow-[0_0_20px_#FF3D00] border-2 border-white/70 animate-pulse" />
              <span className="text-xl md:text-2xl font-black uppercase tracking-tighter text-[#FF3D00] italic drop-shadow-[0_2px_10px_rgba(0,0,0,1)]">OBEREMMENTAL</span>
            </div>

            {/* Radar Sweep FX */}
            <div className="absolute inset-0 origin-center bg-gradient-to-tr from-transparent via-primary/5 to-transparent animate-[spin_10s_linear_infinite]" />
          </div>
          
          <div className="mt-2 text-[7px] font-black uppercase tracking-[1em] text-primary/30 text-center italic leading-none pointer-events-none select-none">
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
