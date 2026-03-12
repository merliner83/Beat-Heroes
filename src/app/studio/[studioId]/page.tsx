
"use client";

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useMemoFirebase, useCollection, useDoc, useUser } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Studio, Project, Level, LevelProgress } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, LayoutGrid, ChevronRight, ExternalLink, Trophy } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function StudioPage() {
  const { studioId } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();

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

  // User Progress
  const progressQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'users', user.uid, 'progress'));
  }, [db, user]);
  const { data: userProgress } = useCollection<LevelProgress>(progressQuery);

  const getLevelProgress = (levelId: string) => {
    return userProgress?.find(p => p.levelId === levelId);
  };

  const getProjectProgress = (projectId: string) => {
    // This is simplified: in a real app you'd need the levels of the project to calculate properly
    // But for the UI, we'll try to estimate based on difficulties 1-4
    if (!userProgress || !projects) return 0;
    
    // We would need to know which levels belong to this project
    // Since we only fetch levels for the *selected* project, we might need a more global fetch or
    // just rely on the UI being consistent.
    // For now, let's just count levels if we have them, otherwise return 0
    return 0; // Will be updated in the render loop if levels are available
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8 font-body">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm opacity-50 hover:opacity-100 mb-8 transition-opacity uppercase font-bold tracking-widest text-white">
          <ArrowLeft className="w-4 h-4" /> Back to HQ
        </Link>

        {studio && (
          <div className="mb-12">
            <h1 className="text-6xl font-black mb-2 uppercase italic tracking-tighter text-white">{studio.name}</h1>
            <p className="text-xl opacity-60 font-medium text-white mb-4">{studio.description}</p>
            
            {studio.linkUrl && (
              <a 
                href={studio.linkUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[#FFEA00] hover:text-[#FFEA00]/80 font-black uppercase tracking-widest text-xs transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                {studio.linkLabel || 'Visit Studio'}
              </a>
            )}
          </div>
        )}

        <div className="space-y-8">
          <h2 className="text-sm font-black uppercase tracking-[0.3em] text-white/40">Projects</h2>
          
          <div className="space-y-6">
            {projects?.map((project) => {
              // Calculate progress for this project if it's selected, 
              // or just show a placeholder if we don't have all level data yet.
              // In a more robust version, you'd fetch all levels for the studio.
              const isSelected = selectedProjectId === project.id;
              const projectLevels = isSelected ? levels : [];
              const completedCount = projectLevels?.filter(l => getLevelProgress(l.id))?.length || 0;
              const totalCount = projectLevels?.length || 4; // Default to 4 levels
              const progressPercent = Math.round((completedCount / totalCount) * 100);

              return (
                <div key={project.id} className="space-y-4">
                  <div 
                    onClick={() => setSelectedProjectId(selectedProjectId === project.id ? null : project.id)}
                    className="cursor-pointer relative gemini-border overflow-visible"
                  >
                    <Card className={cn(
                      "p-8 border-none bg-transparent transition-all relative z-10",
                      isSelected ? "bg-white/5" : ""
                    )}>
                      <div className="flex justify-between items-center text-white mb-6">
                        <div>
                          <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">{project.name}</h3>
                          <p className="text-sm font-bold tracking-widest uppercase mt-1 text-[#FFEA00]">{project.bpm} BPM</p>
                        </div>
                        <LayoutGrid className={cn("w-8 h-8 transition-all", isSelected ? "text-[#FFEA00] scale-110" : "opacity-20")} />
                      </div>

                      {/* Project Progress Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-end">
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Project Progress</span>
                          <span className="text-xs font-black italic text-[#FFEA00]">{isSelected ? progressPercent : '??'}%</span>
                        </div>
                        <Progress value={isSelected ? progressPercent : 0} className="h-1 bg-white/5" />
                      </div>
                    </Card>
                  </div>

                  {isSelected && (
                    <div className="pl-4 py-2 animate-in slide-in-from-top-4 duration-300">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {isLoadingLevels ? (
                          [1,2,3,4].map(i => <div key={i} className="h-24 bg-white/5 animate-pulse rounded-2xl" />)
                        ) : (
                          levels?.sort((a,b) => a.difficulty - b.difficulty).map((level) => {
                            const progress = getLevelProgress(level.id);
                            return (
                              <Button
                                key={level.id}
                                onClick={() => router.push(`/play/${studioId}/${project.id}/${level.id}`)}
                                variant="ghost"
                                className={cn(
                                  "h-32 border-2 hover:bg-white/5 flex flex-col items-center justify-center gap-1 group transition-all rounded-2xl relative overflow-hidden",
                                  progress 
                                    ? "border-[#00E676]/40 bg-[#00E676]/5" 
                                    : "border-white/10 bg-black/40 hover:border-white/30"
                                )}
                              >
                                <span className="text-[10px] opacity-40 font-black uppercase tracking-[0.2em] text-white relative z-10">Level {level.difficulty}</span>
                                <div className="flex items-center gap-1 uppercase italic text-white group-hover:text-[#FFEA00] relative z-10">
                                  {level.name || 'Untitled'}
                                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                </div>
                                
                                {progress && (
                                  <div className="mt-2 flex items-center gap-1.5 bg-[#00E676]/20 px-2 py-0.5 rounded-full border border-[#00E676]/30">
                                    <Trophy className="w-3 h-3 text-[#00E676]" />
                                    <span className="text-[9px] font-black text-[#00E676]">{progress.accuracy}%</span>
                                  </div>
                                )}
                              </Button>
                            );
                          })
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
              );
            })}

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
