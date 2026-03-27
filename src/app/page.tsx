
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

// Optimierte Koordinaten für eine weiträumige vertikale Verteilung
const STUDIO_COORDS: Record<string, { x: number, y: number }> = {
  'gabriel-beats': { x: 20, y: 12 }, // Oben Links
  'yoan-beats': { x: 80, y: 25 },   // Oben Rechts (versetzt)
  'noxxos': { x: 35, y: 45 },      // Mitte Links (viel Abstand zur Map)
};

const StudioHouseFrame = ({ color, studioName }: { color: string, studioName: string }) => (
  <div className="relative flex flex-col items-center group cursor-pointer">
    {/* Stylische Haus-Umrandung mit Glow-Effekt nach hinten */}
    <div className="relative w-28 h-28 md:w-44 md:h-44 flex items-center justify-center">
      {/* Glow nach hinten */}
      <div 
        className="absolute inset-4 blur-2xl rounded-full opacity-0 group-hover:opacity-40 transition-all duration-700" 
        style={{ backgroundColor: color }} 
      />
      
      <svg 
        className="absolute inset-0 w-full h-full -z-10 transition-all duration-500 group-hover:scale-110" 
        viewBox="0 0 100 100" 
        preserveAspectRatio="none"
      >
        <path 
          d="M50 5 L92 38 L92 95 L8 95 L8 38 Z" 
          fill="rgba(0,0,0,0.85)" 
          stroke={color} 
          strokeWidth="2"
          className="transition-all duration-500 group-hover:stroke-white group-hover:drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]"
        />
      </svg>
      
      {/* Der Avatar im Haus */}
      <div className="p-1 rounded-full overflow-hidden transition-transform duration-500 group-hover:scale-105">
        <Avatar className="w-16 h-16 md:w-28 md:h-28 border-2 border-white/5">
          <AvatarImage src={`https://picsum.photos/seed/${studioName}/400`} />
          <AvatarFallback className="bg-black text-white font-black italic text-lg">{studioName.substring(0,2).toUpperCase()}</AvatarFallback>
        </Avatar>
      </div>
    </div>

    {/* Tactical Label - Rechteckig und prägnant direkt am Icon */}
    <div className="mt-1 bg-black border-l-4 border-white/20 p-2 md:px-4 py-1 shadow-2xl transform transition-all group-hover:border-[#FFEA00] text-center min-w-[100px] border border-white/5">
      <h3 className="text-[10px] md:text-xs font-black uppercase italic tracking-tighter whitespace-nowrap leading-tight flex items-center justify-center gap-2">
        <Sparkles className="w-2.5 h-2.5 text-[#FFEA00] opacity-0 group-hover:opacity-100 transition-opacity" />
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
        { id: 'noxxos', name: 'Noxxos', description: 'Experimental soundscapes.', coverColor: '#EB3D99' }
      ];
      for (const s of studios) await setDoc(doc(db, 'studios', s.id), s, { merge: true });
      toast({ title: "Radar Synced!", description: "Districts live." });
    } catch (e) {
      toast({ variant: "destructive", title: "Setup Failed" });
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-body flex flex-col overflow-hidden select-none">
      {/* Header mit Titel und Street Credits */}
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

      {/* Hauptbereich: Studios als stylische Haus-Avatare */}
      <main className="relative flex-1 w-full overflow-hidden p-4">
        {/* Raster Hintergrund */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        
        {isLoadingStudios ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#FFEA00]" />
          </div>
        ) : (
          <div className="absolute inset-x-0 top-0 bottom-64 max-w-7xl mx-auto pointer-events-none h-full">
            {allStudios?.map((studio) => {
              const pos = STUDIO_COORDS[studio.id] || { x: 50, y: 50 };
              return (
                <div 
                  key={studio.id}
                  className="absolute transition-all duration-500 ease-in-out animate-in fade-in zoom-in-95 pointer-events-auto"
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

        {/* Mini Map (GTA Style, zentriert am unteren Rand) */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50">
          <div className="relative w-72 h-72 md:w-[30rem] md:h-[30rem] rounded-2xl border-2 border-white/10 bg-black/80 backdrop-blur-md overflow-hidden gemini-glow shadow-2xl">
            {/* Tactical Grid */}
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '25px 25px' }} />
            
            {/* Pulse Effects */}
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="w-8 h-8 bg-[#FFEA00] rounded-full animate-ping opacity-40" />
            </div>

            {/* Tactical Points */}
            <div className="absolute inset-0 p-8 flex flex-col justify-between">
              <div className="flex items-center gap-4 transition-transform hover:scale-105">
                <div className="w-6 h-6 rounded-full bg-[#00E676] shadow-[0_0_20px_#00E676]" />
                <span className="text-xl md:text-3xl font-black uppercase tracking-tighter text-[#00E676] drop-shadow-lg">MS BANTIGER</span>
              </div>
              <div className="flex items-center gap-4 self-end transition-transform hover:scale-105">
                <span className="text-xl md:text-3xl font-black uppercase tracking-tighter text-[#EB3D99] drop-shadow-lg">MS OBEREMMENTAL</span>
                <div className="w-6 h-6 rounded-full bg-[#EB3D99] shadow-[0_0_20px_#EB3D99]" />
              </div>
            </div>

            {/* Radar Sweep Animation */}
            <div className="absolute inset-0 origin-center bg-gradient-to-tr from-transparent via-[#FFEA00]/10 to-transparent animate-[spin_5s_linear_infinite]" />
          </div>
          
          {/* Großes GTA-Style Label */}
          <div className="mt-8 text-5xl md:text-8xl font-black uppercase tracking-[0.6em] text-white/40 text-center drop-shadow-2xl italic leading-none">
            DISTRICTS
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 border-t border-white/5 bg-black/80 flex justify-between items-center z-50">
        <div className="flex items-center gap-2 opacity-40">
          <MapIcon className="w-4 h-4" />
          <span className="text-[10px] uppercase font-bold tracking-[0.2em]">Scanner Active</span>
        </div>
        <Button variant="ghost" size="sm" onClick={setupStudios} className="text-[10px] uppercase tracking-tighter gap-2 opacity-40 hover:opacity-100 group">
          <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" /> Rack Sync
        </Button>
      </footer>
    </div>
  );
}
