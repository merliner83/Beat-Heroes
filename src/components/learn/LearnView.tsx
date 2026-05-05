
"use client";

import React, { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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

  // Helper to format article title in list
  const formatListTitle = (article: Article, subTitle?: string) => {
    if (!subTitle) return article.title;
    // Remove subCategory name from title for cleaner list view if it exists
    const prefix = `${subTitle}:`;
    if (article.title.startsWith(prefix)) {
      return article.title.replace(prefix, '').trim();
    }
    return article.title;
  };

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
        
        <div className="space-y-10">
          {CATEGORY_MAP.map((cat) => {
            const catArticles = allArticles?.filter(a => a.categoryId === cat.id) || [];
            if (catArticles.length === 0) return null;

            // Grouping logic for 2 or 3 stages
            const subGroups = catArticles.reduce((acc, article) => {
              const subId = article.subCategoryId || 'direct';
              if (!acc[subId]) acc[subId] = { 
                id: subId, 
                title: article.subCategoryTitle || '', 
                iconUrl: article.subCategoryIconUrl,
                articles: [] 
              };
              acc[subId].articles.push(article);
              return acc;
            }, {} as Record<string, { id: string, title: string, iconUrl?: string, articles: Article[] }>);

            const directArticles = subGroups['direct']?.articles || [];
            const groupList = Object.values(subGroups).filter(g => g.id !== 'direct');

            return (
              <div key={cat.id} className="space-y-4">
                <div className="flex items-center gap-4 px-2">
                  <div className={cn("p-2.5 rounded-xl bg-white/5", cat.color)}>
                    <cat.icon className="w-6 h-6" />
                  </div>
                  <h4 className="text-2xl font-black uppercase italic tracking-tighter text-white">{cat.title}</h4>
                  <div className="h-px flex-1 bg-white/5" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Direct Articles (Stage 2) */}
                  {directArticles.map((article) => {
                    const locked = !hasAccess(profile?.role, article.minRole || 'free');
                    return (
                      <Link 
                        key={article.id} 
                        href={locked ? '#' : `/learn/article/${article.id}`}
                        className={cn("block group", locked && "cursor-not-allowed opacity-50")}
                      >
                        <div className="p-5 rounded-2xl bg-black/40 border border-white/5 hover:border-primary/30 transition-all flex items-center justify-between">
                          <span className="text-sm font-black uppercase tracking-widest italic group-hover:text-primary transition-colors">
                            {article.title}
                          </span>
                          {locked ? <Lock className="w-4 h-4 text-white/20" /> : <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-primary" />}
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* Sub-Categories (Stage 3 via Accordion) */}
                {groupList.length > 0 && (
                  <Accordion type="single" collapsible className="space-y-3">
                    {groupList.map((group) => (
                      <AccordionItem 
                        key={group.id} 
                        value={group.id}
                        className="border-none bg-black/40 rounded-2xl overflow-hidden border border-white/5"
                      >
                        <AccordionTrigger className="px-6 py-5 hover:no-underline group">
                          <div className="flex items-center gap-4">
                            {group.iconUrl && (
                              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center p-1.5 shrink-0 overflow-hidden relative">
                                <Image 
                                  src={group.iconUrl} 
                                  alt={group.title} 
                                  fill 
                                  className="object-contain p-1"
                                  sizes="40px"
                                />
                              </div>
                            )}
                            <span className="text-lg font-black uppercase italic tracking-tighter text-left group-hover:text-primary transition-colors">
                              {group.title}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-6 pt-2 space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {group.articles.map((article) => {
                              const locked = !hasAccess(profile?.role, article.minRole || 'free');
                              return (
                                <Link 
                                  key={article.id} 
                                  href={locked ? '#' : `/learn/article/${article.id}`}
                                  className={cn("block", locked && "cursor-not-allowed")}
                                >
                                  <div className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-primary/5 hover:border-primary/20 transition-all group/item flex items-center justify-between">
                                    <span className={cn(
                                      "text-[11px] font-black uppercase tracking-widest italic opacity-60",
                                      !locked && "group-hover/item:text-primary group-hover/item:opacity-100"
                                    )}>
                                      {formatListTitle(article, group.title)}
                                    </span>
                                    {locked ? <Lock className="w-3 h-3 text-white/10" /> : <ChevronRight className="w-3 h-3 text-white/10 group-hover/item:text-primary" />}
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
