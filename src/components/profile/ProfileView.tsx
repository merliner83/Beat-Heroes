"use client";

import React, { useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Studio, Game, Level, LevelProgress, LearnApp, hasAccess } from '@/lib/game/types';
import { Progress } from '@/components/ui/progress';
import { 
  Trophy, 
  Zap, 
  Target, 
  Headphones, 
  LayoutGrid, 
  Music, 
  Loader2,
  TrendingUp,
  Award
} from 'lucide-react';
import { cn } from '@/lib/utils';

const APP_ICON_MAP: Record<string, any> = {
  'ear-training': Headphones,
  'rhythm-trainer': Target
};

const GAME_ICON_MAP: Record<string, any> = {
  'rhythm-producer': Music,
  'sample-hunter': Target,
  'sample-catcher': LayoutGrid
};

export const ProfileView = () => {
  const { user, profile, isUserLoading } = useUser();
  const db = useFirestore();

  const studiosQuery = useMemoFirebase(() => db ? query(collection(db, 'studios')) : null, [db]);
  const gamesQuery = useMemoFirebase(() => db ? query(collection(db, 'games')) : null, [db]);
  const levelsQuery = useMemoFirebase(() => db ? query(collection(db, 'levels')) : null, [db]);
  const learnAppsQuery = useMemoFirebase(() => db ? query(collection(db, 'learnApps')) : null, [db]);
  const progressQuery = useMemoFirebase(() => user && db ? query(collection(db, 'users', user.uid, 'progress')) : null, [user, db]);

  const { data: studios, isLoading: isLoadingStudios } = useCollection<Studio>(studiosQuery);
  const { data: games } = useCollection<Game>(gamesQuery);
  const { data: levels } = useCollection<Level>(levelsQuery);
  const { data: learnApps } = useCollection<LearnApp>(learnAppsQuery);
  const { data: userProgress } = useCollection<LevelProgress>(progressQuery);

  const stats = useMemo(() => {
    if (!userProgress || userProgress.length === 0) return { avgAccuracy: 0, completedSessions: 0 };
    const totalAccuracy = userProgress.reduce((acc, curr) => acc + curr.accuracy, 0);
    return {
      avgAccuracy: Math.round(totalAccuracy / userProgress.length),
      completedSessions: userProgress.length
    };
  }, [userProgress]);

  const getGameMastery = (gameId: string) => {
    const gameLevels = levels?.filter(l => l.gameId === gameId) || [];
    if (gameLevels.length === 0) return 0;
    
    const totalAccuracy = gameLevels.reduce((acc, level) => {
      const progress = userProgress?.find(p => p.levelId === level.id);
      return acc + (progress?.accuracy || 0);
    }, 0);
    
    return Math.round(totalAccuracy / gameLevels.length);
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return "text-[#00E676]";
    if (accuracy >= 50) return "text-[#FFEA00]";
    return "text-[#FF3D00]";
  };

  if (isUserLoading || isLoadingStudios) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#FFEA00]" />
        <p className="text-xs font-black uppercase tracking-[0.4em] opacity-30">Loading Profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
      {/* Header Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="gemini-border-accent">
          <div className="p-8 bg-black/40 backdrop-blur-xl flex flex-col items-center text-center gap-4">
            <Zap className="w-10 h-10 text-[#FFEA00]" fill="currentColor" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1">Total Street Cred</p>
              <h3 className="text-4xl font-black italic tracking-tighter text-white">
                {profile?.streetCred?.toLocaleString() || 0}
              </h3>
            </div>
          </div>
        </div>

        <div className="gemini-border-primary">
          <div className="p-8 bg-black/40 backdrop-blur-xl flex flex-col items-center text-center gap-4">
            <TrendingUp className="w-10 h-10 text-primary" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1">Sync Performance</p>
              <h3 className={cn("text-4xl font-black italic tracking-tighter", getAccuracyColor(stats.avgAccuracy))}>
                {stats.avgAccuracy}%
              </h3>
            </div>
          </div>
        </div>

        <div className="gemini-border">
          <div className="p-8 bg-black/40 backdrop-blur-xl flex flex-col items-center text-center gap-4">
            <Award className="w-10 h-10 text-[#00E676]" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1">Active Rank</p>
              <h3 className="text-3xl font-black italic tracking-tighter text-[#00E676] uppercase">
                {profile?.role || 'FREE'}
              </h3>
            </div>
          </div>
        </div>
      </section>

      {/* Learn Progress */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="w-5 h-5 text-[#FFEA00]" />
          <h3 className="text-xs font-black uppercase tracking-[0.5em] text-white/50">Learn Mastery</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {learnApps?.map(app => {
            const mastery = userProgress?.find(p => p.levelId === app.id)?.accuracy || 0;
            const Icon = APP_ICON_MAP[app.type] || Headphones;
            return (
              <div key={app.id} className="gemini-border">
                <div className="p-6 bg-black/40 flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-black uppercase italic tracking-tight">{app.name}</h4>
                      <span className={cn("text-xs font-black italic", getAccuracyColor(mastery))}>{mastery}%</span>
                    </div>
                    <Progress value={mastery} className="h-1.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Studio & Game Progress */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <Music className="w-5 h-5 text-primary" />
          <h3 className="text-xs font-black uppercase tracking-[0.5em] text-white/50">Studio Modules</h3>
        </div>
        <div className="space-y-8">
          {studios?.map(studio => {
            const studioGames = games?.filter(g => g.studioId === studio.id) || [];
            if (studioGames.length === 0) return null;

            return (
              <div key={studio.id} className="space-y-4">
                <div className="flex items-center gap-4">
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white/30">{studio.name}</h4>
                  <div className="h-px flex-1 bg-white/5" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {studioGames.map(game => {
                    const mastery = getGameMastery(game.id);
                    const Icon = GAME_ICON_MAP[game.type] || Music;
                    return (
                      <div key={game.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-4">
                        <Icon className="w-5 h-5 text-primary opacity-40" />
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-black uppercase italic tracking-tighter opacity-70">{game.name}</span>
                            <span className={cn("text-[10px] font-black italic", getAccuracyColor(mastery))}>{mastery}%</span>
                          </div>
                          <Progress value={mastery} className="h-1" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
