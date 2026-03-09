
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, useUser, useAuth } from '@/firebase';
import { collection, query, doc, writeBatch } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Music, Play, Radio, Loader2, Sparkles } from 'lucide-react';
import { Studio } from '@/lib/game/types';

export default function HomePage() {
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser();
  const [isSeeding, setIsSeeding] = useState(false);
  
  const studiosQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'studios'));
  }, [db]);

  const { data: studios, isLoading } = useCollection<Studio>(studiosQuery);

  const seedDatabase = async () => {
    if (!db || !auth) return;
    setIsSeeding(true);
    try {
      let currentUserId = user?.uid;
      if (!currentUserId) {
        const credential = await signInAnonymously(auth);
        currentUserId = credential.user.uid;
      }

      const batch = writeBatch(db);
      const studioId = "leo-beats-studio";
      const projectId = "cyber-drift";
      
      batch.set(doc(db, 'studios', studioId), {
        id: studioId,
        name: "Leo Beats Studio",
        description: "Lerne die Grundlagen der Beat-Produktion.",
        coverColor: "#993DEB",
        ownerUserId: currentUserId
      });

      batch.set(doc(db, 'projects', projectId), {
        id: projectId,
        studioId: studioId,
        name: "Cyber Drift",
        bpm: 120,
        backingTrackUrl: "https://storage.googleapis.com/codeskulptor-demos/riceracer_assets/music/start_menu.mp3"
      });

      const levelsData = [
        { id: "lvl-1", name: "Level 1: KICK Only", diff: 1 },
        { id: "lvl-2", name: "Level 2: CLAP Only", diff: 2 },
        { id: "lvl-3", name: "Level 3: PERCS Only", diff: 3 },
        { id: "lvl-4", name: "Level 4: MISC Only", diff: 4 },
      ];

      for (const l of levelsData) {
        batch.set(doc(db, 'levels', l.id), {
          id: l.id,
          projectId: projectId,
          difficulty: l.diff,
          name: l.name
        });

        // Using reliable, CORS-friendly samples from CodeSkulptor
        const sounds = [
          { type: "kick", steps: [0, 4, 8, 12], url: "https://storage.googleapis.com/codeskulptor-assets/Collision8-Bit.ogg" },
          { type: "clap", steps: [4, 12], url: "https://storage.googleapis.com/codeskulptor-assets/jump.ogg" },
          { type: "percs", steps: [0, 2, 4, 6, 8, 10, 12, 14], url: "https://storage.googleapis.com/codeskulptor-assets/Collision7-Bit.ogg" },
          { type: "misc", steps: [7, 15], url: "https://storage.googleapis.com/codeskulptor-demos/pyman_assets/extralife.ogg" },
        ];
        
        for (const s of sounds) {
          const soundId = `${l.id}-${s.type}`;
          batch.set(doc(db, 'levels', l.id, 'sounds', soundId), {
            id: soundId,
            levelId: l.id,
            type: s.type,
            sampleUrl: s.url,
            triggerSteps: s.steps
          });
        }
      }

      await batch.commit();
      window.location.reload();
    } catch (e) {
      console.error("Seeding failed", e);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1F1A23] text-white">
      <header className="px-8 py-6 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-2">
          <Radio className="text-[#993DEB]" />
          <h1 className="text-2xl font-bold tracking-tighter uppercase italic text-[#993DEB]">BeatHero</h1>
        </div>
      </header>

      <main className="p-8">
        <div className="flex justify-between items-end mb-8">
          <h2 className="text-4xl font-bold">Wähle dein <span className="text-[#993DEB]">Studio</span></h2>
          <Button 
            onClick={seedDatabase} 
            disabled={isSeeding}
            className="bg-[#3838FA] hover:bg-[#3838FA]/80 flex gap-2"
          >
            {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Demo-Daten erstellen
          </Button>
        </div>
        
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
          </div>
        )}
      </main>
    </div>
  );
}
