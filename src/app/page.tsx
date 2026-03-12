
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, doc, setDoc } from 'firebase/firestore';
import { Home, Radio, Target, Settings } from 'lucide-react';
import { Studio } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Koordinaten für Liberty Beats City
const STUDIO_COORDS: Record<string, { x: number, y: number }> = {
  'yoan-beats': { x: 25, y: 35 },
  'nintu-music': { x: 35, y: 55 },
  'dave-beats': { x: 15, y: 65 },
  'noxxos': { x: 75, y: 30 }
};

const DISTRICTS = [
  { id: 'all', name: 'All Districts', x: 50, y: 50 },
  { id: 'bantiger', name: 'Bantiger District', x: 25, y: 55 },
  { id: 'oberemmental', name: 'Oberemmental District', x: 75, y: 30 }
];

export default function HomePage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  
  const studiosQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'studios'));
  }, [db]);

  const { data: allStudios, isLoading } = useCollection<Studio>(studiosQuery);

  const filteredStudios = allStudios?.filter(studio => {
    if (selectedDistrict === 'all') return true;
    if (selectedDistrict === 'bantiger') return studio.district === 'Bantiger District';
    if (selectedDistrict === 'oberemmental') return studio.district === 'Oberemmental District';
    return true;
  });

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
        description: "Die Gebiete wurden auf der Karte markiert.",
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
    <div className="min-h-screen bg-[#050505] text-white font-body flex flex-col overflow-hidden select-none">
      {/* Gemini Style Header */}
      <header className="absolute top-0 left-0 right-0 z-50 p-6 flex justify-between items-start pointer-events-none">
        <div className="gemini-border gemini-glow p-4 pointer-events-auto">
          <div className="flex items-center gap-3">
            <Radio className="w-8 h-8 text-[#993DEB]" />
            <div>
              <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none">BeatHero</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-50">Select Destination</p>
            </div>
          </div>
        </div>

        <div className="gemini-border gemini-glow p-4 text-right pointer-events-auto">
          <div className="text-white font-bold text-xl leading-none tracking-tighter">$ 0,000,000</div>
          <div className="text-[10px] uppercase opacity-40 mt-1">Liberty Beats City</div>
        </div>
      </header>

      {/* Map View Container */}
      <main className="relative flex-1 w-full bg-[#080808] overflow-hidden">
        {/* Styled City Grid Background */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                <path d="M 100 0 L 0 0 0 100" fill="none" stroke="white" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            <circle cx="30%" cy="40%" r="300" fill="#993DEB" className="blur-[150px] opacity-10" />
            <circle cx="70%" cy="30%" r="350" fill="#FF3D00" className="blur-[180px] opacity-10" />
          </svg>
        </div>

        {/* Studio Pins */}
        <div className="absolute inset-0">
          {filteredStudios?.map((studio) => {
            const pos = STUDIO_COORDS[studio.id] || { x: 50, y: 50 };
            return (
              <div 
                key={studio.id}
                className="absolute transition-all duration-500 animate-in fade-in zoom-in group"
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                <Link href={`/studio/${studio.id}`}>
                  <div className="relative flex flex-col items-center -translate-x-1/2 -translate-y-1/2">
                    <div className="absolute inset-0 w-24 h-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#993DEB] animate-ping opacity-20" />
                    
                    <div 
                      className="w-20 h-20 rounded-2xl bg-black border-2 border-white/20 flex items-center justify-center shadow-2xl relative z-10 transition-all group-hover:scale-110"
                      style={{ boxShadow: `0 0 30px ${studio.coverColor}44` }}
                    >
                      <Home className="w-10 h-10 text-white" />
                    </div>

                    <div className="mt-4 bg-black/90 backdrop-blur-md border border-white/20 px-6 py-3 rounded-xl transition-transform group-hover:-translate-y-1">
                      <h3 className="text-2xl font-black uppercase italic tracking-tighter whitespace-nowrap leading-none">{studio.name}</h3>
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

        {/* GPS Mini-Map Graphic */}
        <div className="absolute bottom-10 left-10 w-72 gemini-border gemini-glow p-2 z-50">
          <div 
            className="h-44 w-full rounded-lg relative overflow-hidden bg-[#111] cursor-crosshair"
            onClick={() => setSelectedDistrict('all')}
          >
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <svg width="100%" height="100%">
                <pattern id="grid-mini" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="0.5"/>
                </pattern>
                <rect width="100%" height="100%" fill="url(#grid-mini)" />
              </svg>
            </div>

            {/* Interactive District GPS Points */}
            {DISTRICTS.filter(d => d.id !== 'all').map((district) => {
              const isSelected = selectedDistrict === district.id;
              const isAllActive = selectedDistrict === 'all';
              const isDimmed = !isAllActive && !isSelected;
              
              return (
                <div
                  key={district.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Toggle-Logik: Klick auf aktiven Distrikt setzt auf 'all' zurück
                    setSelectedDistrict(selectedDistrict === district.id ? 'all' : district.id);
                  }}
                  className={cn(
                    "absolute flex flex-col items-center gap-1 transition-all group cursor-pointer",
                    isDimmed ? "opacity-20 grayscale scale-90" : "opacity-100 scale-100"
                  )}
                  style={{ left: `${district.x}%`, top: `${district.y}%`, transform: 'translate(-50%, -50%)' }}
                >
                  <div className={cn(
                    "w-3 h-3 rounded-full border border-white transition-all",
                    isSelected 
                      ? "bg-[#FF3D00] shadow-[0_0_20px_#FF3D00] scale-125" 
                      : "bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]"
                  )} />
                  <div className={cn(
                    "bg-black/90 backdrop-blur-md border border-white/20 px-2 py-0.5 text-[7px] font-black uppercase tracking-widest whitespace-nowrap rounded transition-colors",
                    isSelected ? "text-[#FFEA00] border-[#FFEA00]/40" : "text-white/80"
                  )}>
                    {district.name}
                  </div>
                </div>
              );
            })}

            <div className="absolute top-2 left-2 text-[6px] font-black uppercase tracking-widest text-white/20">
              {selectedDistrict === 'all' ? 'SCANNING ALL SECTORS' : 'FOCUSED VIEW ACTIVE'}
            </div>
            <div className="absolute bottom-2 right-2 text-[6px] font-black uppercase tracking-widest text-[#993DEB] animate-pulse">
              GPS ONLINE
            </div>
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
