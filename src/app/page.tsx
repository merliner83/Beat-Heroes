
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
  'gabriel-beats': { x: 25, y: 20 }, // Oben Links
  'yoan-beats': { x: 75, y: 25 },   // Oben Rechts
  'noxxos': { x: 45, y: 45 },      // Mitte
};

const StudioHouseFrame = ({ color, studioName }: { color: string, studioName: string }) => (
  <div className="relative flex flex-col items-center group cursor-pointer">
    {/* Stylische Haus-Umrandung mit Glow-Effekt nach hinten */}
    <div className="relative w-28 h-28 md:w-36 md:h-36 flex items-center justify-center">
      {/* Glow nach hinten */}
      <div 
        className="absolute inset-4 blur-3xl rounded-full opacity-10 group-hover:opacity-40 transition-all duration-700" 
        style={{ backgroundColor: color }} 
      />
      
      <svg 
        className="absolute inset-0 w-full h-full -z-10 transition-all duration-500 group-hover:scale-110 drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]" 
        viewBox="0 0 100 100" 
        preserveAspectRatio="none"
      >
        <path 
          d="M50 8 L90 40 L90 92 L10 92 L10 40 Z" 
          fill="rgba(5,5,5,0.95)" 
          stroke={color} 
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-500 group-hover:stroke-white"
        />
      </svg>
      
      {/* Der Avatar im Haus */}
      <div className="p-1 rounded-full overflow-hidden transition-transform duration-500 group-hover:scale-105">
        <Avatar className="w-14 h-14 md:w-20 md:h-20 border-2 border-white/5 bg-black">
          <AvatarImage src={`https://picsum.photos/seed/${studioName}/400`} />
          <AvatarFallback className="bg-black text-white font-black italic text-lg">{studioName.substring(0,2).toUpperCase()}</AvatarFallback>
        </Avatar>
      </div>
    </div>

    {/* Tactical Label - Rechteckig und prägnant direkt am Icon */}
    <div className="mt-1 bg-black/90 border-l-2 border-white/20 p-1 md:px-4 py-1 shadow-xl transform transition-all group-hover:border-[#FFEA00] text-center min-w-[100px] border border-white/5 backdrop-blur-md rounded-sm">
      <h3 className="text-[9px] md:text-xs font-black uppercase italic tracking-tighter whitespace-nowrap leading-tight flex items-center justify-center gap-1.5">
        <Sparkles className="w-2 h-2 text-[#FFEA00] opacity-0 group-hover:opacity-100 transition-opacity" />
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
    <div className="min-h-screen bg-[#050505] text-white font-body flex flex-col overflow-hidden select-none relative">
      {/* Urban Background Elements */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '200px 200px' }} />
      
      {/* Header mit Titel und Street Credits */}
      <header className="p-6 flex flex-col items-center z-50">
        <div className="gemini-border gemini-glow p-4 inline-block mb-4 bg-black/40 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Radio className="w-8 h-8 text-[#FFEA00]" />
            <div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic leading-none">BeatHero</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Urban District Mapper</p>
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
        {isLoadingStudios ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#FFEA00]" />
          </div>
        ) : (
          <div className="absolute inset-0 max-w-7xl mx-auto pointer-events-none">
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

        {/* Mini Map (Kompakter GTA Style, zentriert am unteren Rand) */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center">
          <div className="relative w-40 h-40 md:w-64 md:h-64 rounded-xl border-2 border-white/10 bg-black/90 backdrop-blur-lg overflow-hidden gemini-glow shadow-[0_0_30px_rgba(0,0,0,0.8)]">
            {/* Tactical Grid Overlay */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            
            {/* Pulse Effects */}
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="w-8 h-8 bg-[#FFEA00] rounded-full animate-ping opacity-20" />
               <div className="w-3 h-3 bg-[#FFEA00] rounded-full shadow-[0_0_15px_#FFEA00]" />
            </div>

            {/* Tactical Points */}
            <div className="absolute inset-0 p-6 flex flex-col justify-between">
              <div className="flex items-center gap-2 transition-transform hover:scale-105">
                <div className="w-4 h-4 rounded-full bg-[#00E676] shadow-[0_0_15px_#00E676]" />
                <span className="text-[10px] md:text-sm font-black uppercase tracking-tighter text-[#00E676] drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)]">Bantiger</span>
              </div>
              <div className="flex items-center gap-2 self-end transition-transform hover:scale-105 text-right">
                <span className="text-[10px] md:text-sm font-black uppercase tracking-tighter text-[#EB3D99] drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)]">Oberemmental</span>
                <div className="w-4 h-4 rounded-full bg-[#EB3D99] shadow-[0_0_15px_#EB3D99]" />
              </div>
            </div>

            {/* Radar Sweep Animation */}
            <div className="absolute inset-0 origin-center bg-gradient-to-tr from-transparent via-[#FFEA00]/5 to-transparent animate-[spin_6s_linear_infinite]" />
          </div>
          
          {/* Dezentes GTA-Style Label */}
          <div className="mt-4 text-3xl md:text-5xl font-black uppercase tracking-[0.3em] text-white/10 text-center drop-shadow-xl italic leading-none pointer-events-none select-none">
            DISTRICTS
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 border-t border-white/5 bg-black/90 flex justify-between items-center z-50">
        <div className="flex items-center gap-2 opacity-40">
          <MapIcon className="w-3 h-3" />
          <span className="text-[9px] uppercase font-bold tracking-[0.2em]">City Scanner Active</span>
        </div>
        <Button variant="ghost" size="sm" onClick={setupStudios} className="text-[9px] uppercase tracking-tighter gap-2 opacity-40 hover:opacity-100 group h-8">
          <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" /> Rack Sync
        </Button>
      </footer>
    </div>
  );
}
