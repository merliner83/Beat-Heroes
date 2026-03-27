
"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, setDoc } from 'firebase/firestore';
import { Radio, RefreshCw, Loader2, Map as MapIcon } from 'lucide-react';
import { Studio } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { useAuth } from '@/firebase/provider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Weiträumige Verteilung über den gesamten Hauptbereich
const STUDIO_COORDS: Record<string, { x: number, y: number }> = {
  'gabriel-beats': { x: 15, y: 15 }, // Oben Links
  'yoan-beats': { x: 85, y: 18 },   // Oben Rechts
  'noxxos': { x: 50, y: 32 },      // Mitte (weiter oben für Abstand zur Map)
};

const StudioHouseFrame = ({ color, studioName }: { color: string, studioName: string }) => (
  <div className="relative flex flex-col items-center group cursor-pointer">
    <div className="relative w-24 h-24 md:w-32 md:h-32 flex items-center justify-center">
      {/* Atmosphärischer Glow nach hinten */}
      <div 
        className="absolute inset-4 blur-3xl rounded-full opacity-10 group-hover:opacity-40 transition-all duration-700" 
        style={{ backgroundColor: color }} 
      />
      
      <svg 
        className="absolute inset-0 w-full h-full -z-10 transition-all duration-500 group-hover:scale-110 drop-shadow-[0_0_15px_rgba(0,0,0,0.6)]" 
        viewBox="0 0 100 100" 
        preserveAspectRatio="none"
      >
        <path 
          d="M50 10 L90 40 L90 90 L10 90 L10 40 Z" 
          fill="rgba(5,5,5,0.95)" 
          stroke={color} 
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-500 group-hover:stroke-white"
        />
      </svg>
      
      <div className="p-1 rounded-full overflow-hidden transition-transform duration-500 group-hover:scale-110">
        <Avatar className="w-12 h-12 md:w-20 md:h-20 border-2 border-white/5 bg-black">
          <AvatarImage src={`https://picsum.photos/seed/${studioName}/400`} />
          <AvatarFallback className="bg-black text-white font-black italic text-lg">{studioName.substring(0,2).toUpperCase()}</AvatarFallback>
        </Avatar>
      </div>
    </div>

    {/* Prägnante Beschriftung ohne Rahmen, deutlich größer */}
    <div className="mt-4 text-center pointer-events-none">
      <h3 className="text-lg md:text-3xl font-black uppercase italic tracking-tighter text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] group-hover:text-[#FFEA00] transition-colors leading-none">
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
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '150px 150px' }} />
      
      <header className="p-6 flex flex-col items-center z-50">
        <div className="gemini-border gemini-glow p-3 px-6 inline-block mb-4 bg-black/40 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Radio className="w-6 h-6 text-[#FFEA00]" />
            <div>
              <h1 className="text-2xl md:text-4xl font-black tracking-tighter uppercase italic leading-none">BeatHero</h1>
              <p className="text-[8px] uppercase tracking-[0.2em] font-bold opacity-40">Urban District Mapper</p>
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

        {/* Mini Map (Zentriert am unteren Rand) */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center w-full px-4">
          <div className="relative w-48 h-48 md:w-72 md:h-72 rounded-2xl border-2 border-white/20 bg-black/95 backdrop-blur-2xl overflow-hidden gemini-glow shadow-[0_0_50px_rgba(0,0,0,0.9)]">
            <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '25px 25px' }} />
            
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="w-12 h-12 bg-[#FFEA00] rounded-full animate-ping opacity-20" />
               <div className="w-3 h-3 bg-[#FFEA00] rounded-full shadow-[0_0_20px_#FFEA00]" />
            </div>

            <div className="absolute inset-0 p-6 flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-[#00E676] shadow-[0_0_15px_#00E676] border-2 border-white/20" />
                <span className="text-[10px] md:text-sm font-black uppercase tracking-tighter text-[#00E676]">BANTIGER</span>
              </div>
              <div className="flex items-center gap-2 self-end text-right">
                <span className="text-[10px] md:text-sm font-black uppercase tracking-tighter text-[#EB3D99]">OBEREMMENTAL</span>
                <div className="w-4 h-4 rounded-full bg-[#EB3D99] shadow-[0_0_15px_#EB3D99] border-2 border-white/20" />
              </div>
            </div>

            <div className="absolute inset-0 origin-center bg-gradient-to-tr from-transparent via-[#FFEA00]/10 to-transparent animate-[spin_5s_linear_infinite]" />
          </div>
          
          <div className="mt-4 text-3xl md:text-6xl font-black uppercase tracking-[0.4em] text-white/10 text-center drop-shadow-2xl italic leading-none pointer-events-none select-none">
            DISTRICTS
          </div>
        </div>
      </main>

      <footer className="p-4 border-t border-white/5 bg-black/95 flex justify-between items-center z-50">
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
