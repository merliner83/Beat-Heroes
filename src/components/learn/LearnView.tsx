
"use client";

import React, { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  ChevronRight,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LearnApp, Article, hasAccess } from '@/lib/game/types';

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

const APP_ICON_MAP: Record<string, any> = {
  'ear-training': Headphones,
  'rhythm-trainer': Target
};

const APP_COLOR_MAP: Record<string, string> = {
  'ear-training': '#00E676',
  'rhythm-trainer': '#FFEA00'
};

export const LearnView = () => {
  const { profile } = useUser();
  const db = useFirestore();

  const learnAppsQuery = useMemoFirebase(() => db ? query(collection(db, 'learnApps')) : null, [db]);
  const articlesQuery = useMemoFirebase(() => db ? query(collection(db, 'articles')) : null, [db]);

  const { data: allLearnApps } = useCollection<LearnApp>(learnAppsQuery);
  const { data: allArticles } = useCollection<Article>(articlesQuery);

  const filteredLearnApps = useMemo(() => {
    if (!allLearnApps) return [];
    return allLearnApps.filter(a => hasAccess(profile?.role, a.minRole || 'free'));
  }, [allLearnApps, profile?.role]);

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
      <section className="relative p-8 rounded-[2rem] bg-gradient-to-br from-primary/10 via-black to-black border border-white/5 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] -z-10" />
        <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter mb-4 text-gradient">Master the Lab</h2>
        <p className="text-sm md:text-lg opacity-50 max-w-2xl font-medium tracking-tight">
          Von den ersten Beats bis zum globalen Release – hier lernst du alles, was du für deine Karriere als Musikproduzent wissen musst.
        </p>
      </section>

      {/* Learn Apps Section */}
      {filteredLearnApps.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Gamepad2 className="w-5 h-5 text-primary" />
            <h3 className="text-xs font-black uppercase tracking-[0.5em] text-white/50">Learn-InApps</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {filteredLearnApps.map((app) => {
              const Icon = APP_ICON_MAP[app.type] || Gamepad2;
              const color = APP_COLOR_MAP[app.type] || '#fff';
              
              return (
                <Link 
                  key={app.id} 
                  href={`/session/${app.id}`}
                >
                  <div className="gemini-border group transition-transform hover:scale-[1.02] active:scale-95">
                    <div className="p-6 bg-black/40 backdrop-blur-xl flex flex-col items-center text-center gap-4 relative min-h-[160px] justify-center">
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                        <Icon className="w-8 h-8" style={{ color }} />
                      </div>
                      <div>
                        <h4 className="text-lg font-black uppercase italic tracking-tighter group-hover:text-primary transition-colors">
                          {app.name}
                        </h4>
                        <p className="text-[10px] uppercase font-bold tracking-widest opacity-30 mt-1">Special Module</p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Knowledge Base Section */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="text-xs font-black uppercase tracking-[0.5em] text-white/50">Knowledge Base</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-1 gap-10">
          {CATEGORY_MAP.map((cat) => {
            const catArticles = allArticles?.filter(a => a.categoryId === cat.id) || [];
            if (catArticles.length === 0) return null;

            // Grouping by SubCategory
            const subGroups = catArticles.reduce((acc, article) => {
              const subId = article.subCategoryId || 'default';
              if (!acc[subId]) acc[subId] = { 
                id: subId, 
                title: article.subCategoryTitle || '', 
                iconUrl: article.subCategoryIconUrl,
                articles: [] 
              };
              acc[subId].articles.push(article);
              return acc;
            }, {} as Record<string, { id: string, title: string, iconUrl?: string, articles: Article[] }>);

            const groupsArray = Object.values(subGroups).sort((a,b) => a.id === 'default' ? 1 : -1);

            return (
              <div key={cat.id} className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className={cn("p-2 rounded-lg bg-white/5", cat.color)}>
                    <cat.icon className="w-5 h-5" />
                  </div>
                  <h4 className="text-xl font-black uppercase italic tracking-tighter text-white">{cat.title}</h4>
                  <div className="h-px flex-1 bg-white/5" />
                </div>

                <div className={cn(
                  "grid gap-6",
                  cat.id === 'daws' ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                )}>
                  {groupsArray.map((group) => (
                    <Card key={group.id} className="bg-black/40 border-white/5 group overflow-hidden rounded-[2rem] flex flex-col">
                      <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-4">
                        {group.iconUrl ? (
                          <div className="w-12 h-12 rounded-xl bg-white/5 overflow-hidden flex items-center justify-center p-2 relative">
                            <Image 
                              src={group.iconUrl} 
                              alt={group.title} 
                              fill 
                              className="object-contain p-2"
                              sizes="48px"
                            />
                          </div>
                        ) : group.id !== 'default' && (
                          <div className="p-2.5 rounded-xl bg-white/5 text-primary">
                            <Sparkles className="w-6 h-6" />
                          </div>
                        )}
                        {group.title && (
                          <CardTitle className="text-lg font-black uppercase italic tracking-tighter">{group.title}</CardTitle>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-2 flex-1">
                        {group.articles.map((article) => {
                          const locked = !hasAccess(profile?.role, article.minRole || 'free');
                          return (
                            <Link 
                              key={article.id} 
                              href={locked ? '#' : `/learn/article/${article.id}`}
                              className={cn(locked && "cursor-not-allowed")}
                            >
                              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-primary/10 hover:border-primary/20 transition-all group/topic mb-1 relative">
                                <span className={cn(
                                  "text-[10px] font-black uppercase tracking-widest opacity-50 italic transition-all",
                                  !locked && "group-hover/topic:opacity-100 group-hover/topic:text-primary",
                                  locked && "opacity-10"
                                )}>
                                  {article.title}
                                </span>
                                {locked ? (
                                  <Lock className="w-3.5 h-3.5 text-white/10" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-white/10 group-hover/topic:text-primary" />
                                )}
                              </div>
                            </Link>
                          );
                        })}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
