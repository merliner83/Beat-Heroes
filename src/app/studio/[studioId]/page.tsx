
"use client";

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useMemoFirebase, useCollection, useDoc, useUser } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Studio, Project, Level, LevelProgress } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, LayoutGrid, ChevronRight, ExternalLink, Trophy, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const DIFFICULTY_MAP: Record<number, { label: string, color: string }> = {
  1: { label: 'BEGINNER', color: '#00E676' },
  2: { label: 'SKILLED', color: '#FFEA00' },
  3: { label: 'PRO', color: '#EB3D99' },
  4: { label: 'MASTER', color: '#FF3D00' },
};

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

  const allLevelsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'levels'));
  }, [db]);
  const { data: allLevels, isLoading: isLoadingLevels } = useCollection<Level>(allLevelsQuery);

  const progressQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'users', user.uid, 'progress'));
  }, [db, user]);
  const { data: userProgress } = useCollection<LevelProgress>(progressQuery);

  const getLevelProgress = (levelId: string) => {
    return userProgress?.find(p => p.levelId === levelId);
  };

  const calculateProjectProgress = (projectId: string) => {
    if (!allLevels || !userProgress) return 0;
    
    const projectLevels = allLevels.filter(l => l.projectId === projectId);
    if (projectLevels.length === 0) return 0;

    const completedCount = projectLevels.filter(l => getLevelProgress(l.id)).length;
    return Math.round((completedCount / projectLevels.length) * 100);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8 font-body">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm opacity-50 hover:opacity-100 mb-8 transition-opacity uppercase font-bold tracking-widest text-white">
          <ArrowLeft className="w-4 h-4" /> Back to Map
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
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-[0.3em] text-white/40">Projects</h2>
            {isLoadingLevels && <Loader2 className="w-4 h-4 animate-spin opacity-20" />}
          </div>
          
          <div className="space-y-6">
            {projects?.map((project) => {
              const isSelected = selectedProjectId === project.id;
              const progressPercent = calculateProjectProgress(project.id);
              const projectLevels = allLevels?.filter(l => l.projectId === project.id) || [];
              const diffInfo = DIFFICULTY_MAP[project.difficulty || 1];

              return (
                <div key={project.id} className="space-y-4">
                  <div 
                    onClick={() => setSelectedProjectId(isSelected ? null : project.id)}
                    className="cursor-pointer relative gemini-border overflow-visible"
                  >
                    <Card className={cn(
                      "p-8 border-none bg-transparent transition-all relative z-10",
                      isSelected ? "bg-white/5" : "hover:bg-white/2"
                    )}>
                      <div className="flex justify-between items-start text-white mb-6">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white leading-none">{project.name}</h3>
                            <div 
                              className="px-2 py-0.5 rounded border-2 text-[8px] font-black tracking-widest italic"
                              style={{ 
                                borderColor: diffInfo.color, 
                                color: diffInfo.color,
                                boxShadow: `0 0 10px ${diffInfo.color}44`,
                                textShadow: `0 0 5px ${diffInfo.color}`
                              }}
                            >
                              {diffInfo.label}
                            </div>
                          </div>
                          <p className="text-sm font-bold tracking-widest uppercase text-[#FFEA00]">{project.bpm} BPM</p>
                        </div>
                        <LayoutGrid className={cn("w-8 h-8 transition-all", isSelected ? "text-[#FFEA00] scale-110" : "opacity-20")} />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-end">
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Project Progress</span>
                          <span className="text-xs font-black italic text-[#FFEA00]">{progressPercent}%</span>
                        </div>
                        <Progress value={progressPercent} className="h-1 bg-white/5" />
                      </div>
                    </Card>
                  </div>

                  {isSelected && (
                    <div className="pl-4 py-2 animate-in slide-in-from-top-4 duration-300">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {projectLevels.sort((a,b) => a.difficulty - b.difficulty).map((level) => {
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
                        })}
                        {projectLevels.length === 0 && !isLoadingLevels && (
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
