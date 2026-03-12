"use client";

import React from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, doc, setDoc } from 'firebase/firestore';
import { Home, MapPin, Target, Settings, Radio } from 'lucide-react';
import { Studio } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// Optimierte Koordinaten für Liberty Beats City (GTA Style)
const STUDIO_COORDS: Record<string, { x: number, y: number }> = {
  'yoan-beats': { x: 20, y: 35 },
  'nintu-music': { x: 75, y: 40 },
  'dave-beats': { x: 45, y: 75 },
  'noxxos': { x: 65, y: 20 }
};

export default function HomePage() {
  const db = useFirestore();
  const { toast } = useToast();
  
  const studiosQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'studios'));
  }, [db]);

  const { data: studios, isLoading } = useCollection<Studio>(studiosQuery);

  const setupStudios = async () => {
    if (!db) return;
    
    const newStudios = [
      { id: 'yoan-beats', name: 'Yoan Beats', description: 'Fresh vibes and urban rhythms.', coverColor: '#FF3D00', district: 'Bantiger District' },
      { id: 'nintu-music', name: 'Nintu Music', description: 'Deep electronic soul and textures.', coverColor: '#00E676', district: 'Bantiger District' },
      { id: 'dave-beats', name: 'Dave Beats', description: 'Classic groove and boom bap energy.', coverColor: '#2979FF', district: 'Bantiger District' },
      { id: 'noxxos', name: 'Noxxos', description: 'Experimental soundscapes and dark atmosphere.', coverColor: '#EB3D99', district: 'Oberemmental District' }
    ];

    try {
      for (const s of newStudios) {
        await setDoc(doc(db, 'studios', s.id), s);
      }
      toast({
        title: "Studios synchronisiert",
        description: "Die Standorte wurden auf der Karte markiert.",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not initialize map data.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-body flex flex-col overflow-hidden select-none">
      {/* GTA Style Header */}
      <header className="absolute top-0 left-0 right-0 z-50 p-6 flex justify-between items-start pointer-events-none">
        <div className="bg-black/80 backdrop-blur-md border-4 border-white p-4 shadow-[8px_8px_0px_0px_rgba(153,61,235,0.5)] pointer-events-auto">
          <div className="flex items-center gap-3">
            <Radio className="w-8 h-8 text-[#993DEB]" />
            <div>
              <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none">BeatHero</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-50">Select Destination</p>
            </div>
          </div>
        </div>

        <div className="bg-black/80 backdrop-blur-md border-2 border-white/20 p-4 text-right pointer-events-auto">
          <div className="text-[#993DEB] font-bold text-xl leading-none tracking-tighter">$ 0,000,000</div>
          <div className="text-[10px] uppercase opacity-40 mt-1">Liberty Beats City</div>
        </div>
      </header>

      {/* Map View Container */}
      <main className="relative flex-1 w-full bg-[#1A1A1A] overflow-hidden">
        {/* Styled City Grid Background */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                <path d="M 100 0 L 0 0 0 100" fill="none" stroke="white" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            <circle cx="30%" cy="40%" r="200" fill="#993DEB" className="blur-[150px] opacity-20" />
            <circle cx="70%" cy="30%" r="250" fill="#3838FA" className="blur-[180px] opacity-20" />
          </svg>
        </div>

        {/* Studio Pins */}
        <div className="absolute inset-0">
          {studios?.map((studio) => {
            const pos = STUDIO_COORDS[studio.id] || { x: Math.random() * 80 + 10, y: Math.random() * 80 + 10 };
            return (
              <div 
                key={studio.id}
                className="absolute transition-transform hover:scale-105 group"
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                <Link href={`/studio/${studio.id}`}>
                  <div className="relative flex flex-col items-center">
                    {/* Pulsing Target Ring */}
                    <div className="absolute inset-0 w-16 h-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#993DEB] animate-ping opacity-20" />
                    
                    {/* Studio Icon/Marker (HOUSE) */}
                    <div 
                      className="w-16 h-16 rounded-xl bg-black border-4 border-white flex items-center justify-center shadow-2xl relative z-10 transition-colors group-hover:bg-[#993DEB]"
                      style={{ boxShadow: `0 0 30px ${studio.coverColor}66` }}
                    >
                      <Home className="w-8 h-8 text-white" />
                    </div>

                    {/* Permanent Label (Readable Name & District) */}
                    <div className="mt-3 bg-black/95 border-2 border-white px-5 py-2.5 shadow-[6px_6px_0px_0px_white] transition-transform group-hover:-translate-y-1">
                      <h3 className="text-xl font-black uppercase italic tracking-tighter whitespace-nowrap leading-none">{studio.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Target className="w-3.5 h-3.5 text-[#993DEB]" />
                        <span className="text-[10px] font-black opacity-80 uppercase tracking-[0.15em] text-[#993DEB]">
                          {studio.district || 'Downtown'}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-40">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 border-4 border-[#993DEB] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-black uppercase tracking-[0.3em]">Downloading Area Data...</p>
              </div>
            </div>
          )}
        </div>

        {/* Mini-Map / District Info Overlay */}
        <div className="absolute bottom-10 left-10 w-64 aspect-square bg-black/90 border-4 border-white shadow-[10px_10px_0px_0px_rgba(0,0,0,0.5)] p-4 hidden md:block">
          <div className="h-full w-full border-2 border-white/20 relative flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-8 h-8 text-[#993DEB] mx-auto mb-2" />
              <div className="text-[10px] font-black uppercase tracking-widest leading-tight">
                Liberty Beats City<br/>Digital Map v1.0
              </div>
            </div>
            <div className="absolute top-4 left-6 w-2 h-2 bg-white rounded-full animate-pulse" />
            <div className="absolute bottom-8 right-12 w-2 h-2 bg-[#993DEB] rounded-full animate-pulse" />
          </div>
        </div>
      </main>

      {/* Hidden Admin Setup in Footer */}
      <footer className="p-4 border-t border-white/5 flex justify-end opacity-10 hover:opacity-100 transition-opacity absolute bottom-0 right-0">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={setupStudios}
          className="text-[10px] uppercase tracking-tighter gap-2"
        >
          <Settings className="w-3 h-3" />
          Map Setup
        </Button>
      </footer>
    </div>
  );
}
