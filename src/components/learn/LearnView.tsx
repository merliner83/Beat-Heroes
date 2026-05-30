
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
  Target,
  Scale,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LearnApp, Article, hasAccess, LearnSubCat, LearnCategory, ArticleProgress, getAccuracyColor } from '@/lib/game/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from '@/components/ui/progress';

const ICON_COMPONENTS: Record<string, any> = {
  BookOpen,
  Cpu,
  Music,
  Mic2,
  Wand2,
  Disc,
  Share2,
  Scale,
  Sparkles,
  Gamepad2,
  Headphones,
  Target
};

const APP_ICON_MAP: Record<string, any> = {
  'ear-training': Headphones,
  'rhythm-trainer': Target
};

const APP_COLOR_MAP: Record<string, string> = {
  'ear-training': '#00E676',
  'rhythm-trainer': '#FFEA00'
};

export const LearnView = () => {
  const { user, profile } = useUser();
  const db = useFirestore();

  const learnAppsQuery = useMemoFirebase(() => db ? query(collection(db, 'learnApps')) : null, [db]);
  const categoriesQuery = useMemoFirebase(() => db ? query(collection(db, 'learnCategories')) : null, [db]);
  const subCategoriesQuery = useMemoFirebase(() => db ? query(collection(db, 'learnSubCats')) : null, [db]);
  const articlesQuery = useMemoFirebase(() => db ? query(collection(db, 'articles')) : null, [db]);
  const articleProgressQuery = useMemoFirebase(() => user && db ? query(collection(db, 'users', user.uid, 'articleProgress')) : null, [user, db]);

  const { data: allLearnApps } = useCollection<LearnApp>(learnAppsQuery);
  const { data: allCategories } = useCollection<LearnCategory>(categoriesQuery);
  const { data: allSubCategories } = useCollection<LearnSubCat>(subCategoriesQuery);
  const { data: allArticles } = useCollection<Article>(articlesQuery);
  const { data: articleProgress } = useCollection<ArticleProgress>(articleProgressQuery);

  const filteredLearnApps = useMemo(() => {
    if (!allLearnApps) return [];
    return allLearnApps.filter(a => hasAccess(profile?.role, a.minRole || 'free'));
  }, [allLearnApps, profile?.role]);

  const sortedCategories = useMemo(() => {
    if (!allCategories) return [];
    return [...allCategories].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [allCategories]);

  const isArticleCompleted = (articleId: string) => {
    const prog = articleProgress?.find(ap => ap.articleId === articleId);
    return prog?.completed && (prog.quizScore || 0) >= 80;
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-32">
      {/* Hero Section */}
      <section className="relative p-8 rounded-[2rem] bg-gradient-to-br from-primary/10 via-black to-black border border-white/5 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] -z-10" />
        <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter mb-4 text-gradient">Master the Lab</h2>
        <p className="text-sm md:text-lg opacity-50 max-w-2xl font-medium tracking-tight">Vom ersten Beat bis zum globalen Release – hier lernst du alles für deine Musikkarriere.</p>
      </section>

      {/* Interactive Modules Grid */}
      {filteredLearnApps.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Gamepad2 className="w-5 h-5 text-primary" />
            <h3 className="text-xs font-black uppercase tracking-[0.5em] text-white/50">Special Modules</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {filteredLearnApps.map((app) => {
              const Icon = APP_ICON_MAP[app.type] || Gamepad2;
              const color = APP_COLOR_MAP[app.type] || '#fff';
              return (
                <Link key={app.id} href={`/session/${app.id}`}>
                  <div className="gemini-border group transition-transform hover:scale-[1.02] active:scale-95">
                    <div className="p-4 bg-black/40 backdrop-blur-xl flex flex-col items-center text-center gap-3 justify-center min-h-[140px]">
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10">
                        <Icon className="w-6 h-6" style={{ color }} />
                      </div>
                      <h4 className="text-sm font-black uppercase italic tracking-tighter group-hover:text-primary transition-colors">{app.name}</h4>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Knowledge Base with nested Accordions */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="text-xs font-black uppercase tracking-[0.5em] text-white/50">Knowledge Base</h3>
        </div>

        <Accordion type="multiple" className="space-y-6">
          {sortedCategories.map((cat) => {
            const catArticles = allArticles?.filter(a => a.categoryId === cat.id) || [];
            const catSubCats = allSubCategories?.filter(sc => sc.categoryId === cat.id) || [];
            
            if (catArticles.length === 0 && catSubCats.length === 0) return null;

            const completedInCat = catArticles.filter(a => isArticleCompleted(a.id)).length;
            const catPercent = catArticles.length > 0 ? Math.round((completedInCat / catArticles.length) * 100) : 0;

            const directArticles = catArticles
              .filter(a => !a.subCategoryId)
              .sort((a, b) => (a.order || 0) - (b.order || 0));

            const sortedSubCats = [...catSubCats].sort((a, b) => (a.order || 0) - (b.order || 0));

            const Icon = ICON_COMPONENTS[cat.iconName] || BookOpen;

            return (
              <AccordionItem key={cat.id} value={cat.id} className="border-none">
                <AccordionTrigger className="hover:no-underline group p-0">
                  <div className="flex items-center gap-4 w-full px-2">
                    <div className={cn("p-2 rounded-xl bg-white/5 transition-transform group-hover:scale-110", cat.colorClass)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h4 className="text-2xl font-black uppercase italic tracking-tighter text-white group-hover:text-primary transition-colors whitespace-nowrap">
                      {cat.title}
                    </h4>
                    
                    <div className="flex-1 flex items-center gap-4 ml-4">
                      <div className="h-px flex-1 bg-white/5 relative overflow-hidden">
                        <div 
                          className="absolute inset-y-0 left-0 transition-all duration-1000 ease-in-out opacity-40"
                          style={{ 
                            width: `${catPercent}%`, 
                            backgroundColor: getAccuracyColor(catPercent) 
                          }}
                        />
                      </div>
                      {catPercent > 0 && (
                        <span className="text-[10px] font-black italic opacity-40" style={{ color: getAccuracyColor(catPercent) }}>
                          {catPercent}%
                        </span>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                
                <AccordionContent className="pt-6 pb-2 space-y-6">
                  {/* Direct Articles Grid */}
                  {directArticles.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {directArticles.map((article) => {
                        const locked = !hasAccess(profile?.role, article.minRole || 'free');
                        const completed = isArticleCompleted(article.id);
                        return (
                          <Link key={article.id} href={locked ? '#' : `/learn/article/${article.id}`} className={cn("block group/art", locked && "cursor-not-allowed opacity-50")}>
                            <div className={cn(
                              "p-4 rounded-xl border transition-all flex items-center justify-between",
                              completed 
                                ? "bg-[#00E676]/10 border-[#00E676]/30" 
                                : "bg-black/40 border-white/5 hover:border-primary/30"
                            )}>
                              <div className="flex items-center gap-3">
                                {completed && <CheckCircle2 className="w-4 h-4 text-[#00E676]" />}
                                <span className={cn(
                                  "text-xs font-black uppercase tracking-widest italic transition-colors",
                                  completed ? "text-[#00E676]" : "group-hover/art:text-primary"
                                )}>
                                  {article.title}
                                </span>
                              </div>
                              {locked ? <Lock className="w-3 h-3 text-white/20" /> : <ChevronRight className="w-3 h-3 text-white/20" />}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {/* Sub-Categories (Nested Accordion) */}
                  {sortedSubCats.length > 0 && (
                    <Accordion type="single" collapsible className="space-y-3">
                      {sortedSubCats.map((group) => {
                        const groupArticles = allArticles
                          ?.filter(a => a.subCategoryId === group.id)
                          .sort((a, b) => (a.order || 0) - (b.order || 0)) || [];
                        
                        if (groupArticles.length === 0) return null;

                        const completedInSub = groupArticles.filter(a => isArticleCompleted(a.id)).length;
                        const subPercent = Math.round((completedInSub / groupArticles.length) * 100);
                        
                        return (
                          <AccordionItem key={group.id} value={group.id} className="border-none bg-black/40 rounded-xl overflow-hidden border border-white/5">
                            <AccordionTrigger className="px-5 py-4 hover:no-underline group/sub">
                              <div className="flex items-center justify-between w-full pr-4">
                                <div className="flex items-center gap-3">
                                  {group.iconUrl && (
                                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center p-1 overflow-hidden relative">
                                      <Image src={group.iconUrl} alt={group.title} fill className="object-contain p-1" sizes="32px" />
                                    </div>
                                  )}
                                  <span className="text-base font-black uppercase italic tracking-tighter text-left group-hover/sub:text-primary transition-colors">
                                    {group.title}
                                  </span>
                                </div>
                                {subPercent > 0 && (
                                  <span className="text-[9px] font-black italic opacity-30" style={{ color: getAccuracyColor(subPercent) }}>
                                    {subPercent}%
                                  </span>
                                )}
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-5 pb-5 pt-0">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {groupArticles.map((article) => {
                                  const locked = !hasAccess(profile?.role, article.minRole || 'free');
                                  const completed = isArticleCompleted(article.id);
                                  return (
                                    <Link key={article.id} href={locked ? '#' : `/learn/article/${article.id}`} className={cn("block", locked && "cursor-not-allowed")}>
                                      <div className={cn(
                                        "p-3 rounded-lg border flex items-center justify-between group/item",
                                        completed 
                                          ? "bg-[#00E676]/5 border-[#00E676]/20" 
                                          : "bg-white/5 border-white/5 hover:border-primary/20"
                                      )}>
                                        <div className="flex items-center gap-2">
                                          {completed && <CheckCircle2 className="w-3 h-3 text-[#00E676]" />}
                                          <span className={cn(
                                            "text-[10px] font-black uppercase tracking-widest italic opacity-60 transition-colors",
                                            completed ? "text-[#00E676]" : "group-hover/item:text-primary"
                                          )}>
                                            {article.title}
                                          </span>
                                        </div>
                                        {locked ? <Lock className="w-2.5 h-2.5 text-white/10" /> : <ChevronRight className="w-2.5 h-2.5 text-white/10" />}
                                      </div>
                                    </Link>
                                  );
                                })}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </section>
    </div>
  );
};
