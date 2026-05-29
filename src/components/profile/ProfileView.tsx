
"use client";

import React, { useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Studio, Game, Level, LevelProgress, getAccuracyColor, UserProfile, LearnCategory, Article, ArticleProgress } from '@/lib/game/types';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Zap, 
  Target, 
  LayoutGrid, 
  Music, 
  Loader2,
  TrendingUp,
  BarChart3,
  Calendar,
  BookOpen,
  LogIn,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip, 
  ResponsiveContainer 
} from 'recharts';
import { initiateGoogleSignIn } from '@/firebase/non-blocking-login';
import { useAuth } from '@/firebase/provider';

const GAME_ICON_MAP: Record<string, any> = {
  'rhythm-producer': Music,
  'sample-hunter': Target,
  'sample-catcher': LayoutGrid
};

export const ProfileView = () => {
  const { user, profile, isUserLoading } = useUser();
  const db = useFirestore();
  const auth = useAuth();
  const [collapsedStudios, setCollapsedStudios] = React.useState<Record<string, boolean>>({});

  const leaderboardQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'users'), orderBy('streetCred', 'desc'), limit(100));
  }, [db]);
  const { data: leaderboard } = useCollection<UserProfile>(leaderboardQuery);

  const studiosQuery = useMemoFirebase(() => db ? query(collection(db, 'studios')) : null, [db]);
  const gamesQuery = useMemoFirebase(() => db ? query(collection(db, 'games')) : null, [db]);
  const levelsQuery = useMemoFirebase(() => db ? query(collection(db, 'levels')) : null, [db]);
  const progressQuery = useMemoFirebase(() => user && db ? query(collection(db, 'users', user.uid, 'progress')) : null, [user, db]);
  const articleProgressQuery = useMemoFirebase(() => user && db ? query(collection(db, 'users', user.uid, 'articleProgress')) : null, [user, db]);
  const categoriesQuery = useMemoFirebase(() => db ? query(collection(db, 'learnCategories')) : null, [db]);
  const articlesQuery = useMemoFirebase(() => db ? query(collection(db, 'articles')) : null, [db]);

  const { data: studios, isLoading: isLoadingStudios } = useCollection<Studio>(studiosQuery);
  const { data: games } = useCollection<Game>(gamesQuery);
  const { data: levels } = useCollection<Level>(levelsQuery);
  const { data: userProgress } = useCollection<LevelProgress>(progressQuery);
  const { data: articleProgress } = useCollection<ArticleProgress>(articleProgressQuery);
  const { data: categories } = useCollection<LearnCategory>(categoriesQuery);
  const { data: articles } = useCollection<Article>(articlesQuery);

  const globalRank = useMemo(() => {
    if (!leaderboard || !user) return null;
    const index = leaderboard.findIndex(p => p.uid === user.uid);
    return index !== -1 ? `${index + 1}` : '--';
  }, [leaderboard, user]);

  const performanceData = useMemo(() => {
    if (!userProgress) return [];
    const now = new Date();
    const weeks: Record<string, { totalAcc: number, count: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - (i * 7));
      const weekLabel = `W${6-i}`;
      weeks[weekLabel] = { totalAcc: 0, count: 0 };
    }
    userProgress.forEach(s => {
      if (!s.completedAt) return;
      const date = new Date(s.completedAt.seconds ? s.completedAt.seconds * 1000 : s.completedAt);
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));
      const weekIdx = Math.floor(diffDays / 7);
      if (weekIdx >= 0 && weekIdx <= 5) {
        const label = `W${6-weekIdx}`;
        if (weeks[label]) {
          weeks[label].totalAcc += s.accuracy;
          weeks[label].count += 1;
        }
      }
    });
    return Object.entries(weeks).map(([name, data]) => ({
      name,
      accuracy: data.count > 0 ? Math.round(data.totalAcc / data.count) : null
    }));
  }, [userProgress]);

  const stats = useMemo(() => {
    if (!userProgress || userProgress.length === 0) return { avgAccuracy: 0 };
    const totalAccuracy = userProgress.reduce((acc, curr) => acc + curr.accuracy, 0);
    return { avgAccuracy: Math.round(totalAccuracy / userProgress.length) };
  }, [userProgress]);

  const categoryProgress = useMemo(() => {
    if (!categories || !articles || !articleProgress) return [];
    return categories.map(cat => {
      const catArticles = articles.filter(a => a.categoryId === cat.id);
      const earned = catArticles.reduce((acc, a) => {
        const prog = articleProgress.find(ap => ap.articleId === a.id);
        const score = prog?.quizScore || 0;
        return acc + (score / 100) * (a.maxPoints || 250);
      }, 0);
      const totalPossible = catArticles.reduce((acc, a) => acc + (a.maxPoints || 250), 0);
      return {
        ...cat,
        earned: Math.round(earned),
        total: totalPossible,
        percent: totalPossible > 0 ? Math.round((earned / totalPossible) * 100) : 0,
        completedCount: catArticles.filter(a => articleProgress.some(ap => ap.articleId === a.id && ap.completed)).length,
        articleCount: catArticles.length
      };
    }).sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [categories, articles, articleProgress]);

  const toggleStudio = (id: string) => { setCollapsedStudios(prev => ({ ...prev, [id]: !prev[id] })); };

  if (isUserLoading || isLoadingStudios) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#FFEA00]" />
        <p className="text-xs font-black uppercase tracking-[0.4em] opacity-30">Loading Rack Stats...</p>
      </div>
    );
  }

  const isAnonymous = user?.isAnonymous;
  const streetCred = profile?.streetCred || 0;

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-32 max-w-6xl mx-auto">
      
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="gemini-border">
          <div className="p-8 bg-black/40 backdrop-blur-xl flex flex-col items-center text-center gap-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[40px] -z-10" />
            <div className="relative">
              <span className="text-4xl">👑</span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1">Global Rank</p>
              <h3 className="text-5xl font-black italic tracking-tighter text-white uppercase leading-none">
                # {globalRank}
              </h3>
            </div>
          </div>
        </div>

        <div className="gemini-border-accent">
          <div className="p-8 bg-black/40 backdrop-blur-xl flex flex-col items-center text-center gap-4">
            <Zap className="w-10 h-10 text-[#FFEA00]" fill="currentColor" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1">Total Street Cred</p>
              <h3 className="text-6xl font-black italic tracking-tighter text-white">
                {streetCred.toLocaleString()}
              </h3>
            </div>
          </div>
        </div>

        <div className="gemini-border-primary">
          <div className="p-8 bg-black/40 backdrop-blur-xl flex flex-col items-center text-center gap-4">
            <TrendingUp className="w-10 h-10 text-[#00E676]" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1">Avg. Sync</p>
              <h3 className="text-6xl font-black italic tracking-tighter transition-colors duration-500" style={{ color: getAccuracyColor(stats.avgAccuracy) }}>
                {stats.avgAccuracy}%
              </h3>
            </div>
          </div>
        </div>
      </section>

      <section className="gemini-border-primary">
        <div className="p-8 bg-black/40 backdrop-blur-xl">
           <div className="flex items-center justify-between mb-8">
             <div className="flex items-center gap-3">
               <BarChart3 className="w-5 h-5 text-primary" />
               <h3 className="text-xs font-black uppercase tracking-[0.5em] text-white">Sync History</h3>
             </div>
             <div className="flex items-center gap-2 opacity-30 text-[10px] font-black uppercase tracking-widest">
               <Calendar className="w-4 h-4" /> Last 6 Weeks
             </div>
           </div>
           
           <div className="h-48 w-full mt-4">
             <ResponsiveContainer width="100%" height="100%">
               <LineChart data={performanceData}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#ffffff40', fontSize: 10, fontWeight: 900 }} />
                 <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#ffffff20', fontSize: 10 }} />
                 <ChartTooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #ffffff10', borderRadius: '12px' }} labelStyle={{ color: '#ffffff40', fontSize: '10px', fontWeight: 900 }} />
                 <Line type="monotone" dataKey="accuracy" stroke="#FF3399" strokeWidth={4} dot={{ fill: '#FF3399', r: 4, strokeWidth: 0 }} activeDot={{ r: 8, stroke: '#fff', strokeWidth: 2 }} connectNulls />
               </LineChart>
             </ResponsiveContainer>
           </div>
        </div>
      </section>

      {isAnonymous && (
        <section className="max-w-2xl mx-auto w-full">
          <div className="bg-white/5 border border-dashed border-white/10 p-8 rounded-3xl text-center space-y-6">
            <LogIn className="w-12 h-12 text-primary mx-auto opacity-40" />
            <div>
              <h4 className="text-xl font-black uppercase italic tracking-tight mb-2">Save your Progress</h4>
              <p className="text-sm opacity-40 font-medium">Log dich ein, um deine Erfolge dauerhaft in der Cloud zu speichern.</p>
            </div>
            <Button onClick={() => auth && initiateGoogleSignIn(auth)} className="bg-white text-black font-black uppercase italic rounded-full px-12 h-14">Login with Google</Button>
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center gap-3 mb-6">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="text-xs font-black uppercase tracking-[0.5em] text-white/50">Quiz Mastery</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
           {categoryProgress.map(cat => (
             <div key={cat.id} className="p-5 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn("p-1.5 rounded-lg bg-black/40", cat.colorClass)}><BookOpen className="w-4 h-4" /></div>
                  <h4 className="text-[10px] font-black uppercase italic tracking-tighter truncate">{cat.title}</h4>
                </div>
                <div className="flex justify-between items-baseline mb-2">
                   <span className="text-[9px] font-black uppercase opacity-20">Fulfillment</span>
                   <span className="text-lg font-black italic" style={{ color: getAccuracyColor(cat.percent) }}>{cat.percent}%</span>
                </div>
                <Progress value={cat.percent} className="h-1" />
                <p className="text-[8px] font-black uppercase tracking-widest opacity-20 mt-2 text-right">
                  {cat.earned} / {cat.total} SC
                </p>
             </div>
           ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-3 mb-6">
          <Music className="w-5 h-5 text-primary" />
          <h3 className="text-xs font-black uppercase tracking-[0.5em] text-white/50">Studio Sessions</h3>
        </div>
        <div className="space-y-4">
          {studios?.map(studio => {
            const studioGames = games?.filter(g => g.studioId === studio.id) || [];
            if (studioGames.length === 0) return null;
            const isCollapsed = collapsedStudios[studio.id];
            return (
              <div key={studio.id} className="gemini-border-primary overflow-hidden">
                <div onClick={() => toggleStudio(studio.id)} className="p-5 bg-black/60 flex items-center justify-between cursor-pointer hover:bg-black/40 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-black italic text-primary border border-primary/20">{studio.name.charAt(0)}</div>
                    <h4 className="text-sm font-black uppercase italic tracking-widest">{studio.name}</h4>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-[10px] font-black opacity-30 uppercase tracking-widest">{studioGames.length} Modules</span>
                    {isCollapsed ? <ChevronDown className="w-5 h-5 opacity-20" /> : <ChevronUp className="w-5 h-5 opacity-20" />}
                  </div>
                </div>
                {!isCollapsed && (
                  <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-3 bg-black/20 animate-in slide-in-from-top-2 duration-300">
                    {studioGames.map(game => {
                      const gameLevels = levels?.filter(l => l.gameId === game.id) || [];
                      const totalAccuracy = gameLevels.reduce((acc, level) => {
                        const progress = userProgress?.find(p => p.levelId === level.id);
                        return acc + (progress?.accuracy || 0);
                      }, 0);
                      const mastery = gameLevels.length > 0 ? Math.round(totalAccuracy / gameLevels.length) : 0;
                      const Icon = GAME_ICON_MAP[game.type] || Music;
                      return (
                        <div key={game.id} className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center gap-4">
                          <Icon className="w-5 h-5 text-primary opacity-40 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[9px] font-black uppercase italic tracking-tighter opacity-70 truncate pr-2">{game.name}</span>
                              <span className="text-[10px] font-black italic" style={{ color: getAccuracyColor(mastery) }}>{mastery}%</span>
                            </div>
                            <Progress value={mastery} className="h-0.5" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
