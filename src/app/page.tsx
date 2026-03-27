
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const STUDIO_COORDS: Record<string, { x: number, y: number }> = {
  'gabriel-beats': { x: 20, y: 15 },
  'yoan-beats': { x: 80, y: 15 },
  'noxxos': { x: 50, y: 20 },
  'dave-beats': { x: 25, y: 45 },
  'nintu-music': { x: 75, y: 45 },
};

const StudioHouseFrame = ({ color, studioName }: { color: string, studioName: string }) => (
  <div className="relative flex flex-col items-center group cursor-pointer">
    <div className="relative w-28 h-28 md:w-36 md:h-36 flex items-center justify-center">
      {/* Dynamic Backglow */}
      <div 
        className="absolute inset-2 blur-3xl rounded-full opacity-20 group-hover:opacity-60 transition-all duration-700 animate-pulse" 
        style={{ backgroundColor: color }} 
      />
      
      {/* Stylized House Frame */}
      <svg 
        className="absolute inset-0 w-full h-full -z-10 transition-all duration-500 group-hover:scale-110 drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]" 
        viewBox="0 0 100 100" 
        preserveAspectRatio="none"
      >
        <path 
          d="M50 5 L95 40 L95 95 L5 95 L5 40 Z" 
          fill="rgba(10,10,10,0.95)" 
          stroke={color} 
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-500 group-hover:stroke-white"
        />
        {/* Internal Detail Line */}
        <path d="M5 40 L50 5 L95 40" stroke="white" strokeWidth="0.5" opacity="0.3" fill="none" />
      </svg>
      
      <div className="p-1 rounded-full overflow-hidden transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
        <Avatar className="w-16 h-16 md:w-24 md:h-24 border-2 border-white/10 bg-black">
          <AvatarImage src={`https://picsum.photos/seed/${studioName}/400`} />
          <AvatarFallback className="bg-black text-white font-black italic text-xl">{studioName.substring(0,2).toUpperCase()}</AvatarFallback>
        </Avatar>
      </div>
    </div>

    {/* Studio Name Label - Large and Bold */}
    <div className="mt-6 text-center pointer-events-none">
      <h3 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter text-white drop-shadow-[0_4px_10px_rgba(0,0,0,1)] group-hover:text-primary transition-colors leading-none">
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
      {/* Background Grid & FX */}
      <div className="absolute inset-0 opacity-[0.1] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#993DEB 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(153,61,235,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(153,61,235,0.1) 1px, transparent 1px)', backgroundSize: '150px 150px' }} />
      
      <header className="p-8 flex flex-col items-center z-50">
        <div className="gemini-border gemini-glow p-4 px-10 inline-block mb-6 bg-black/60 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <Radio className="w-8 h-8 text-primary animate-pulse" />
            <div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic leading-none">BeatHero</h1>
              <p className="text-[10px] uppercase tracking-[0.4em] font-bold opacity-60 text-primary">Urban District Mapper</p>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="gemini-border gemini-glow p-3 px-10 text-center bg-black/60 backdrop-blur-md">
            <div className="text-white font-bold text-2xl md:text-3xl leading-none tracking-tighter flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" fill="currentColor" />
              {streetCred.toLocaleString()} <span className="text-primary italic font-black">SC</span>
            </div>
            <div className="text-[10px] uppercase opacity-60 mt-2 font-bold tracking-widest">Street Cred</div>
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
                  className="absolute transition-all duration-700 ease-in-out animate-in fade-in zoom-in-95 pointer-events-auto"
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

        {/* Tactical Mini Map - Wider & Centered */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center w-full px-6">
          <div className="relative w-full max-w-3xl h-56 md:h-80 rounded-3xl border-2 border-white/20 bg-black/95 backdrop-blur-2xl overflow-hidden gemini-glow shadow-[0_0_60px_rgba(0,0,0,0.9)]">
            {/* Grid Overlay */}
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
            
            {/* Pulsing Center Point */}
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="w-24 h-24 bg-primary rounded-full animate-ping opacity-10" />
               <div className="w-6 h-6 bg-primary rounded-full shadow-[0_0_40px_#993DEB] border-2 border-white/50" />
            </div>

            {/* District Labels - Larger & Vibrant */}
            <div className="absolute inset-0 p-8 flex flex-col justify-between">
              <div className="flex items-center gap-4 group">
                <div className="w-8 h-8 rounded-full bg-[#00E676] shadow-[0_0_30px_#00E676] border-2 border-white/50 animate-pulse" />
                <span className="text-lg md:text-3xl font-black uppercase tracking-tighter text-[#00E676] italic drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">BANTIGER</span>
              </div>
              <div className="flex items-center gap-4 self-end text-right">
                <span className="text-lg md:text-3xl font-black uppercase tracking-tighter text-[#EB3D99] italic drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">OBEREMMENTAL</span>
                <div className="w-8 h-8 rounded-full bg-[#EB3D99] shadow-[0_0_30px_#EB3D99] border-2 border-white/50 animate-pulse" />
              </div>
            </div>

            {/* Radar Sweep FX */}
            <div className="absolute inset-0 origin-center bg-gradient-to-tr from-transparent via-primary/20 to-transparent animate-[spin_6s_linear_infinite]" />
          </div>
          
          <div className="mt-6 text-sm md:text-xl font-black uppercase tracking-[0.6em] text-primary/40 text-center italic leading-none pointer-events-none select-none">
            DISTRICTS
          </div>
        </div>
      </main>

      <footer className="p-6 border-t border-white/5 bg-black/95 flex justify-between items-center z-50">
        <div className="flex items-center gap-3 opacity-60">
          <MapIcon className="w-4 h-4 text-primary" />
          <span className="text-[10px] uppercase font-bold tracking-[0.3em]">City Scanner Active - v2.0</span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={setupStudios} 
          className="text-[10px] uppercase tracking-tighter gap-3 opacity-60 hover:opacity-100 group h-10 px-6 hover:bg-white/5"
        >
          <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700" /> Rack Sync
        </Button>
      </footer>
    </div>
  );
}
