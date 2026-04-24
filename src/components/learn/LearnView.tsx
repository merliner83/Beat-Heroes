
"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { 
  BookOpen, 
  Cpu, 
  Music, 
  Mic2, 
  Wand2, 
  Disc, 
  Share2, 
  Lock, 
  Sparkles, 
  Play, 
  Gamepad2,
  Headphones,
  Keyboard,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Game, Article, hasAccess } from '@/lib/game/types';

const CATEGORY_MAP = [
  { id: 'intro', title: 'Introduction', icon: BookOpen, color: 'text-primary' },
  { id: 'daws', title: 'DAWs', icon: Cpu, color: 'text-[#00E676]' },
  { id: 'composing', title: 'Composing', icon: Music, color: 'text-[#FFEA00]' },
  { id: 'recording', title: 'Recording', icon: Mic2, color: 'text-[#FF3D00]' },
  { id: 'effects', title: 'Effekte', icon: Wand2, color: 'text-[#3838FA]' },
  { id: 'djing', title: 'DJing', icon: Disc, color: 'text-primary' },
  { id: 'brand', title: 'Brand', icon: Share2, color: 'text-[#00FFFF]' },
  { id: 'release', title: 'Release', icon: Play, color: 'text-[#FF9100]' },
  { id: 'rights', title: 'Rechte', icon: Lock, color: 'text-[#EB3D99]' },
  { id: 'others', title: 'Weitere Themen', icon: Sparkles, color: 'text-white' }
];

const GAME_ICON_MAP: Record<string, any> = {
  'rhythm-producer': Gamepad2,
  'ear-training': Headphones,
  'notation-pro': Keyboard
};

const GAME_COLOR_MAP: Record<string, string> = {
  'rhythm-producer': '#FF3399',
  'ear-training': '#00E676',
  'notation-pro': '#FFEA00'
};

export const LearnView = () => {
  const { profile } = useUser();
  const db = useFirestore();

  const gamesQuery = useMemoFirebase(() => db ? query(collection(db, 'games')) : null, [db]);
  const articlesQuery = useMemoFirebase(() => db ? query(collection(db, 'articles')) : null, [db]);

  const { data: allGames } = useCollection<Game>(gamesQuery);
  const { data: allArticles } = useCollection<Article>(articlesQuery);

  const learnGames = allGames?.filter(g => g.studioId === 'learn-center') || [];

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
      <section className="relative p-8 rounded-[2rem] bg-gradient-to-br from-primary/10 via-black to-black border border-white/5 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] -z-10" />
        <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter mb-4 text-gradient">Master the Lab</h2>
        <p className="text-sm md:text-lg opacity-50 max-w-2xl font-medium tracking-tight">
          Von den ersten Beats bis zum globalen Release – hier lernst du alles, was du für deine Karriere als Musikproduzent wissen musst.
        </p>
      </section>

      {/* Learn Games Section */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <Gamepad2 className="w-5 h-5 text-primary" />
          <h3 className="text-xs font-black uppercase tracking-[0.5em] text-white/50">Learn-InApps</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {learnGames.map((game) => {
            const isLocked = !hasAccess(profile?.role, game.minRole || 'free');
            const Icon = GAME_ICON_MAP[game.type] || Gamepad2;
            const color = GAME_COLOR_MAP[game.type] || '#fff';
            
            return (
              <Link 
                key={game.id} 
                href={isLocked ? '#' : `/session/${game.id === 'global-ear-training' ? 'global-ear-training' : (game.id === 'global-notation-pro' ? 'global-notation-1' : 'global-rhythm-1')}`}
                className={cn(isLocked && "cursor-not-allowed")}
              >
                <div className="gemini-border group transition-transform hover:scale-[1.02] active:scale-95">
                  <div className="p-6 bg-black/40 backdrop-blur-xl flex flex-col items-center text-center gap-4 relative min-h-[160px] justify-center">
                    {isLocked && (
                      <div className="absolute top-4 right-4 text-white/20">
                        <Lock className="w-5 h-5" />
                      </div>
                    )}
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                      <Icon className={cn("w-8 h-8", isLocked && "opacity-20")} style={{ color: isLocked ? undefined : color }} />
                    </div>
                    <div>
                      <h4 className={cn("text-lg font-black uppercase italic tracking-tighter group-hover:text-primary transition-colors", isLocked && "opacity-20")}>
                        {game.name}
                      </h4>
                      <p className="text-[10px] uppercase font-bold tracking-widest opacity-30 mt-1">Learn-Game</p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Knowledge Base Section */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="text-xs font-black uppercase tracking-[0.5em] text-white/50">Knowledge Base</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CATEGORY_MAP.map((cat) => {
            const catArticles = allArticles?.filter(a => a.categoryId === cat.id) || [];
            if (catArticles.length === 0) return null;

            return (
              <Card key={cat.id} className="bg-black/40 border-white/5 group overflow-hidden rounded-[2rem]">
                <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-4">
                  <div className={cn("p-2.5 rounded-xl bg-white/5", cat.color)}>
                    <cat.icon className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-xl font-black uppercase italic tracking-tighter">{cat.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {catArticles.map((article) => {
                    const locked = !hasAccess(profile?.role, article.minRole || 'free');
                    return (
                      <Link 
                        key={article.id} 
                        href={locked ? '#' : `/learn/article/${article.id}`}
                        className={cn(locked && "cursor-not-allowed")}
                      >
                        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-primary/10 hover:border-primary/20 transition-all group/topic mb-2 relative">
                          <span className={cn(
                            "text-[11px] font-black uppercase tracking-widest opacity-50 italic transition-all",
                            !locked && "group-hover/topic:opacity-100 group-hover/topic:text-primary",
                            locked && "opacity-10"
                          )}>
                            {article.title}
                          </span>
                          {locked ? (
                            <Lock className="w-4 h-4 text-white/10" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-white/10 group-hover/topic:text-primary" />
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
};
