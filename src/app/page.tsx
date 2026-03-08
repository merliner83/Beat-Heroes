
"use client";

import React from 'react';
import Link from 'next/link';
import { useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { Card } from '@/components/ui/card';
import { Music, Play, Radio } from 'lucide-react';
import { Studio } from '@/lib/game/types';

export default function HomePage() {
  const db = useFirestore();
  
  const studiosQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'studios'));
  }, [db]);

  const { data: studios, isLoading } = useCollection<Studio>(studiosQuery);

  return (
    <div className="min-h-screen bg-[#1F1A23] text-white">
      <header className="px-8 py-6 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-2">
          <Radio className="text-[#993DEB]" />
          <h1 className="text-2xl font-bold tracking-tighter uppercase italic">BeatHero</h1>
        </div>
      </header>

      <main className="p-8">
        <h2 className="text-4xl font-bold mb-8">Wähle dein <span className="text-[#993DEB]">Studio</span></h2>
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-64 bg-white/5 animate-pulse rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {studios?.map((studio) => (
              <Link key={studio.id} href={`/studio/${studio.id}`}>
                <Card 
                  className="group relative h-64 overflow-hidden border-none cursor-pointer transition-transform hover:scale-[1.02]"
                  style={{ backgroundColor: studio.coverColor }}
                >
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                  <div className="absolute inset-0 p-6 flex flex-col justify-between">
                    <div>
                      <Music className="w-8 h-8 mb-4" />
                      <h3 className="text-2xl font-bold">{studio.name}</h3>
                      <p className="text-sm opacity-70">{studio.description}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                      <span>Eintreten</span>
                      <Play className="w-3 h-3 fill-current" />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
            {studios?.length === 0 && (
              <div className="col-span-full py-20 text-center opacity-40">
                Keine Studios gefunden.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
