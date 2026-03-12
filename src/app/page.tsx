
"use client";

import React from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, doc, setDoc } from 'firebase/firestore';
import { Card } from '@/components/ui/card';
import { Music, Play, Radio, Settings } from 'lucide-react';
import { Studio } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

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
      { id: 'yoan-beats', name: 'Yoan Beats', description: 'Fresh vibes and urban rhythms.', coverColor: '#FF3D00' },
      { id: 'nintu-music', name: 'Nintu Music', description: 'Deep electronic soul and textures.', coverColor: '#00E676' },
      { id: 'dave-beats', name: 'Dave Beats', description: 'Classic groove and boom bap energy.', coverColor: '#2979FF' }
    ];

    try {
      for (const s of newStudios) {
        await setDoc(doc(db, 'studios', s.id), s);
      }
      toast({
        title: "Studios angelegt",
        description: "Yoan Beats, Nintu Music und Dave Beats wurden erfolgreich hinzugefügt.",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Studios konnten nicht angelegt werden.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#1F1A23] text-white font-body flex flex-col">
      <header className="px-8 py-6 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-2">
          <Radio className="text-[#993DEB]" />
          <h1 className="text-2xl font-bold tracking-tighter uppercase italic text-[#993DEB]">BeatHero</h1>
        </div>
      </header>

      <main className="p-8 max-w-7xl mx-auto flex-1 w-full">
        <div className="mb-12">
          <h2 className="text-5xl font-bold mb-2">Select your <span className="text-[#993DEB]">Studio</span></h2>
          <p className="text-white/50">Pick a production environment to start your mission.</p>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => <div key={i} className="h-72 bg-white/5 animate-pulse rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {studios?.map((studio) => (
              <Link key={studio.id} href={`/studio/${studio.id}`}>
                <Card 
                  className="group relative h-72 overflow-hidden border-none cursor-pointer transition-all hover:scale-[1.02] rounded-2xl"
                  style={{ backgroundColor: studio.coverColor }}
                >
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                  <div className="absolute inset-0 p-8 flex flex-col justify-between">
                    <div>
                      <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-6">
                        <Music className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-3xl font-bold mb-2 text-white">{studio.name}</h3>
                      <p className="text-base text-white/70 line-clamp-2">{studio.description}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest bg-black/20 text-white self-start px-4 py-2 rounded-full backdrop-blur-md">
                      <span>Enter Studio</span>
                      <Play className="w-3 h-3 fill-current" />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}

            {studios?.length === 0 && !isLoading && (
              <div className="col-span-full py-20 text-center border-2 border-dashed border-white/10 rounded-2xl opacity-30">
                No studios found in your database.
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="p-8 border-t border-white/5 flex justify-center opacity-20 hover:opacity-100 transition-opacity">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={setupStudios}
          className="text-[10px] uppercase tracking-tighter gap-2"
        >
          <Settings className="w-3 h-3" />
          Setup Studios (Admin)
        </Button>
      </footer>
    </div>
  );
}
