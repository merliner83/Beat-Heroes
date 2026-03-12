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
    <div className="min-h-screen bg-[#050505] text-white p-8 font-body">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm opacity-50 hover:opacity-100 mb-8 transition-opacity uppercase font-bold tracking-widest text-white">
          <ArrowLeft className="w-4 h-4" /> Back to HQ
        </Link>

        {studio && (
          <div className="mb-12">
            <h1 className="text-6xl font-black mb-2 uppercase italic tracking-tighter text-white">{studio.name}</h1>
            <p className="text-xl opacity-60 font-medium text-white">{studio.description}</p>
          </div>
        )}

        <div className="space-y-8">
          <h2 className="text-sm font-black uppercase tracking-[0.3em] text-white/40">Projects</h2>
          
          <div className="space-y-6">
            {projects?.map((project) => (
              <div key={project.id} className="space-y-4">
                <div 
                  onClick={() => setSelectedProjectId(selectedProjectId === project.id ? null : project.id)}
                  className={cn(
                    "cursor-pointer transition-all relative group gemini-border",
                    selectedProjectId === project.id && "active gemini-glow"
                  )}
                >
                  <Card className={cn(
                    "p-8 border-none bg-card transition-all",
                    selectedProjectId === project.id ? "bg-black/20" : "bg-card"
                  )}>
                    <div className="flex justify-between items-center text-white relative z-10">
                      <div>
                        <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">{project.name}</h3>
                        <p className="text-sm font-bold tracking-widest uppercase mt-1 text-[#FFEA00]">{project.bpm} BPM</p>
                      </div>
                      <LayoutGrid className={cn("w-8 h-8 transition-all", selectedProjectId === project.id ? "text-[#FFEA00] scale-110" : "opacity-20")} />
                    </div>
                  </Card>
                </div>

                {selectedProjectId === project.id && (
                  <div className="pl-4 py-2 animate-in slide-in-from-top-4 duration-300">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {isLoadingLevels ? (
                        [1,2,3,4].map(i => <div key={i} className="h-24 bg-white/5 animate-pulse rounded-2xl" />)
                      ) : (
                        levels?.sort((a,b) => a.difficulty - b.difficulty).map((level) => (
                          <Button
                            key={level.id}
                            onClick={() => router.push(`/play/${studioId}/${project.id}/${level.id}`)}
                            variant="ghost"
                            className="h-28 bg-black/40 gemini-border border-transparent text-lg font-black flex flex-col items-center justify-center gap-1 group transition-all rounded-2xl"
                          >
                            <span className="text-[10px] opacity-40 font-black uppercase tracking-[0.2em] text-white">Level {level.difficulty}</span>
                            <div className="flex items-center gap-1 uppercase italic text-white group-hover:text-[#FFEA00]">
                              {level.name || 'Untitled'}
                              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                            </div>
                          </Button>
                        ))
                      )}
                      {levels?.length === 0 && !isLoadingLevels && (
                        <div className="col-span-full py-12 text-center bg-white/5 rounded-2xl opacity-40 font-bold uppercase tracking-widest text-sm text-white">
                          No levels available in this sector.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {projects?.length === 0 && (
              <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-3xl opacity-20">
                <p className="font-black uppercase tracking-widest text-white">No Projects Found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}