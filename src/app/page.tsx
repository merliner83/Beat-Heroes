
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
      
      // Public URL for the Firebase Storage file requested by the user
      const backingTrackUrl = "https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/backingTracks%2Fsampling%20125bpm%20260303.mp3?alt=media";

      batch.set(doc(db, 'studios', studioId), {
        id: studioId,
        name: "Leo Beats Studio",
        description: "Master the foundations of beat production.",
        coverColor: "#993DEB",
        ownerUserId: currentUserId
      });

      batch.set(doc(db, 'projects', projectId), {
        id: projectId,
        studioId: studioId,
        name: "Sampling 125 BPM",
        bpm: 125,
        backingTrackUrl: backingTrackUrl
      });

      const levelsData = [
        { id: "lvl-1", name: "Level 1: KICK ONLY", diff: 1 },
        { id: "lvl-2", name: "Level 2: CLAP ONLY", diff: 2 },
        { id: "lvl-3", name: "Level 3: PERCS ONLY", diff: 3 },
        { id: "lvl-4", name: "Level 4: FULL BEAT", diff: 4 },
      ];

      for (const l of levelsData) {
        batch.set(doc(db, 'levels', l.id), {
          id: l.id,
          projectId: projectId,
          difficulty: l.diff,
          name: l.name
        });

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
    <div className="min-h-screen bg-[#1F1A23] text-white font-body">
      <header className="px-8 py-6 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-2">
          <Radio className="text-[#993DEB]" />
          <h1 className="text-2xl font-bold tracking-tighter uppercase italic text-[#993DEB]">BeatHero</h1>
        </div>
      </header>

      <main className="p-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-5xl font-bold mb-2">Select your <span className="text-[#993DEB]">Studio</span></h2>
            <p className="text-white/50">Pick a production environment to start your mission.</p>
          </div>
          <Button 
            onClick={seedDatabase} 
            disabled={isSeeding}
            className="bg-[#3838FA] hover:bg-[#3838FA]/80 flex gap-2 h-12 px-6"
          >
            {isSeeding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            Generate Demo Data
          </Button>
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
                        <Music className="w-6 h-6" />
                      </div>
                      <h3 className="text-3xl font-bold mb-2">{studio.name}</h3>
                      <p className="text-base opacity-70 line-clamp-2">{studio.description}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest bg-black/20 self-start px-4 py-2 rounded-full backdrop-blur-md">
                      <span>Enter Studio</span>
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
