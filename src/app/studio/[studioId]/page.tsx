
"use client";

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useMemoFirebase, useCollection, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Studio, Project, Level } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Play, LayoutGrid } from 'lucide-react';
import Link from 'next/link';

export default function StudioPage() {
  const { studioId } = useParams();
  const router = useRouter();
  const db = useFirestore();

  const studioRef = useMemoFirebase(() => studioId ? doc(db, 'studios', studioId as string) : null, [db, studioId]);
  const { data: studio } = useDoc<Studio>(studioRef);

  const projectsQuery = useMemoFirebase(() => {
    if (!db || !studioId) return null;
    return query(collection(db, 'projects'), where('studioId', '==', studioId));
  }, [db, studioId]);
  const { data: projects } = useCollection<Project>(projectsQuery);

  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);

  const levelsQuery = useMemoFirebase(() => {
    if (!db || !selectedProjectId) return null;
    return query(collection(db, 'levels'), where('projectId', '==', selectedProjectId));
  }, [db, selectedProjectId]);
  const { data: levels } = useCollection<Level>(levelsQuery);

  return (
    <div className="min-h-screen bg-[#1F1A23] text-white p-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm opacity-50 hover:opacity-100 mb-8 transition-opacity">
          <ArrowLeft className="w-4 h-4" /> Zurück zur Übersicht
        </Link>

        {studio && (
          <div className="mb-12">
            <h1 className="text-5xl font-bold mb-2" style={{ color: studio.coverColor }}>{studio.name}</h1>
            <p className="text-xl opacity-60">{studio.description}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Projects List */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold uppercase tracking-widest text-[#993DEB]">Projekte</h2>
            {projects?.map((project) => (
              <Card 
                key={project.id}
                onClick={() => setSelectedProjectId(project.id)}
                className={`p-6 cursor-pointer border-none transition-all ${selectedProjectId === project.id ? 'bg-[#993DEB] scale-[1.02]' : 'bg-white/5 hover:bg-white/10'}`}
              >
                <div className="flex justify-between items-center text-white">
                  <div>
                    <h3 className="text-xl font-bold">{project.name}</h3>
                    <p className="text-sm opacity-60">{project.bpm} BPM</p>
                  </div>
                  <LayoutGrid className="w-5 h-5 opacity-40" />
                </div>
              </Card>
            ))}
          </div>

          {/* Levels List for selected Project */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold uppercase tracking-widest text-[#3838FA]">Missions (Levels)</h2>
            {selectedProjectId ? (
              <div className="grid grid-cols-2 gap-4">
                {levels?.sort((a,b) => a.difficulty - b.difficulty).map((level) => (
                  <Button
                    key={level.id}
                    onClick={() => router.push(`/play/${studioId}/${selectedProjectId}/${level.id}`)}
                    className="h-24 bg-white/5 hover:bg-[#3838FA] border-none text-xl font-bold flex flex-col items-center justify-center gap-1"
                  >
                    <span className="text-xs opacity-50 font-normal">Level {level.difficulty}</span>
                    {level.name || 'Untitled'}
                  </Button>
                ))}
                {levels?.length === 0 && <div className="col-span-full opacity-40 italic">Keine Levels für dieses Projekt.</div>}
              </div>
            ) : (
              <div className="h-48 border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center text-white/20">
                Wähle ein Projekt aus
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
