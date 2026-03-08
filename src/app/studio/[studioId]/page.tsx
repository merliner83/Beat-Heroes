
"use client";

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useMemoFirebase, useCollection, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Studio, Project, Level } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, LayoutGrid, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

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
  const { data: levels, isLoading: isLoadingLevels } = useCollection<Level>(levelsQuery);

  return (
    <div className="min-h-screen bg-[#1F1A23] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm opacity-50 hover:opacity-100 mb-8 transition-opacity">
          <ArrowLeft className="w-4 h-4" /> Zurück zur Übersicht
        </Link>

        {studio && (
          <div className="mb-12">
            <h1 className="text-5xl font-bold mb-2" style={{ color: studio.coverColor }}>{studio.name}</h1>
            <p className="text-xl opacity-60">{studio.description}</p>
          </div>
        )}

        <div className="space-y-8">
          <h2 className="text-xl font-bold uppercase tracking-widest text-[#993DEB] opacity-50">Deine Projekte</h2>
          
          <div className="space-y-4">
            {projects?.map((project) => (
              <div key={project.id} className="space-y-4">
                <Card 
                  onClick={() => setSelectedProjectId(selectedProjectId === project.id ? null : project.id)}
                  className={cn(
                    "p-6 cursor-pointer border-none transition-all relative overflow-hidden",
                    selectedProjectId === project.id 
                      ? 'bg-[#993DEB] ring-2 ring-white/20' 
                      : 'bg-white/5 hover:bg-white/10'
                  )}
                >
                  <div className="flex justify-between items-center text-white relative z-10">
                    <div>
                      <h3 className="text-2xl font-bold">{project.name}</h3>
                      <p className="text-sm opacity-60">{project.bpm} BPM</p>
                    </div>
                    <div className="flex items-center gap-4">
                       <LayoutGrid className={cn("w-6 h-6 transition-opacity", selectedProjectId === project.id ? "opacity-100" : "opacity-20")} />
                    </div>
                  </div>
                </Card>

                {/* Inline Levels for selected Project */}
                {selectedProjectId === project.id && (
                  <div className="pl-6 pr-2 py-2 animate-in slide-in-from-top-4 duration-300">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      {isLoadingLevels ? (
                        [1,2,3,4].map(i => <div key={i} className="h-16 bg-white/5 animate-pulse rounded-lg" />)
                      ) : (
                        levels?.sort((a,b) => a.difficulty - b.difficulty).map((level) => (
                          <Button
                            key={level.id}
                            onClick={() => router.push(`/play/${studioId}/${project.id}/${level.id}`)}
                            variant="ghost"
                            className="h-20 bg-white/5 hover:bg-[#3838FA] border-none text-lg font-bold flex flex-col items-center justify-center gap-1 group transition-all"
                          >
                            <span className="text-[10px] opacity-40 font-normal uppercase tracking-widest">Lvl {level.difficulty}</span>
                            <div className="flex items-center gap-1">
                              {level.name || 'Untitled'}
                              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                            </div>
                          </Button>
                        ))
                      )}
                      {levels?.length === 0 && !isLoadingLevels && (
                        <div className="col-span-full py-8 text-center bg-white/5 rounded-xl opacity-40 italic">
                          Keine Missionen für dieses Projekt verfügbar.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {projects?.length === 0 && (
              <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-2xl opacity-30">
                Keine Projekte in diesem Studio gefunden.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
