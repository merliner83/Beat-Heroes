'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ChevronRight, Gamepad2, Loader2, Lock, Plus } from 'lucide-react';
import { Article, getAccuracyColor, hasAccess, isSuperAdmin } from '@/lib/game/types';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useLearnData } from './useLearnData';
import { APP_COLORS, APP_ICONS, LEARN_ICONS } from './icons';

function LessonLink({ lesson, passed, locked }: { lesson: Article; passed: boolean; locked: boolean }) {
  return (
    <Link href={locked ? '#' : `/learn/article/${lesson.id}`} className={cn('block group/l', locked && 'cursor-not-allowed opacity-50')}>
      <div className={cn(
        'p-4 rounded-xl border transition-all flex items-center justify-between gap-3',
        passed ? 'bg-[#00E676]/10 border-[#00E676]/30' : 'bg-black/40 border-white/5 hover:border-primary/30',
      )}>
        <div className="flex items-center gap-3 min-w-0">
          {passed && <CheckCircle2 className="w-4 h-4 text-[#00E676] shrink-0" />}
          <span className={cn('text-sm font-bold truncate', passed ? 'text-[#00E676]' : 'group-hover/l:text-primary')}>{lesson.title}</span>
        </div>
        {locked ? <Lock className="w-3 h-3 text-white/20 shrink-0" /> : <ChevronRight className="w-4 h-4 text-white/20 shrink-0" />}
      </div>
    </Link>
  );
}

export function CourseView({ courseId }: { courseId: string }) {
  const data = useLearnData();
  const course = data.courses.find((c) => c.id === courseId);

  if (data.loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  if (!course) return <p className="py-20 text-center font-bold">Kurs nicht gefunden.</p>;

  const lessons = data.lessonsOf(course.id);
  const stats = data.courseStats(course.id);
  const chapters = [...course.chapters].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const byOrder = (a: { order?: number }, b: { order?: number }) => (a.order ?? 0) - (b.order ?? 0);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="space-y-4">
        <Link href="/learn" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white"><ArrowLeft className="w-4 h-4" /> Alle Kurse</Link>
        <div className="relative overflow-hidden p-6 md:p-10 rounded-[2rem] border border-white/10 bg-black">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full blur-[110px] opacity-30" style={{ backgroundColor: course.color }} />
          <h1 className="relative text-3xl md:text-5xl font-black uppercase italic tracking-tighter">{course.title}</h1>
          {course.description && <p className="relative text-white/60 mt-3 max-w-2xl">{course.description}</p>}
          {stats.total > 0 && <p className="relative text-sm text-white/50 mt-4">{stats.done} von {stats.total} Lektionen bestanden</p>}
        </div>
      </div>

      <Accordion type="multiple" className="space-y-4">
        {chapters.map((ch) => {
          const chLessons = lessons.filter((l) => (l.chapterId ?? l.categoryId) === ch.id);
          const subCats = data.subCats.filter((s) => s.categoryId === ch.id).sort(byOrder);
          const direct = chLessons.filter((l) => !l.subCategoryId || !subCats.some((s) => s.id === l.subCategoryId)).sort(byOrder);
          const apps = data.apps.filter((a) => ch.appIds?.includes(a.id));
          const done = chLessons.filter((l) => data.passed(l.id)).length;
          const percent = chLessons.length ? Math.round((done / chLessons.length) * 100) : 0;
          const Icon = LEARN_ICONS[ch.iconName ?? ''] ?? LEARN_ICONS.BookOpen;
          const empty = chLessons.length === 0 && apps.length === 0;

          return (
            <AccordionItem key={ch.id} value={ch.id} className="border border-white/10 rounded-2xl bg-white/[0.02] px-4 md:px-6">
              <AccordionTrigger className="hover:no-underline py-5">
                <div className="flex items-center gap-4 w-full pr-3">
                  <div className={cn('p-2 rounded-xl bg-white/5', ch.colorClass)}><Icon className="w-5 h-5" /></div>
                  <div className="flex-1 min-w-0 text-left">
                    <h2 className="text-lg md:text-2xl font-black uppercase italic tracking-tighter truncate">{ch.title}</h2>
                    <p className="text-xs text-white/40 font-normal">
                      {empty ? 'Lektionen folgen bald' : `${chLessons.length} Lektionen${apps.length ? ` · ${apps.length} Übung` : ''}`}
                    </p>
                  </div>
                  {percent > 0 && <span className="text-xs font-black" style={{ color: getAccuracyColor(percent) }}>{percent}%</span>}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-6 space-y-5">
                {ch.description && <p className="text-sm text-white/60">{ch.description}</p>}
                {isSuperAdmin(data.role) && (
                  <Link href={`/admin/articles/new?course=${course.id}&chapter=${ch.id}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    <Plus className="w-4 h-4" /> Lektion in diesem Kapitel
                  </Link>
                )}

                {apps.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {apps.map((app) => {
                      const AppIcon = APP_ICONS[app.type] ?? Gamepad2;
                      return (
                        <Link key={app.id} href={`/session/${app.id}`} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/30 flex items-center gap-3">
                          <AppIcon className="w-6 h-6 shrink-0" style={{ color: APP_COLORS[app.type] ?? '#fff' }} />
                          <span className="font-black uppercase italic tracking-tighter text-sm">{app.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {direct.length > 0 && (
                  <div className="grid gap-2 md:grid-cols-2">
                    {direct.map((l) => <LessonLink key={l.id} lesson={l} passed={data.passed(l.id)} locked={!hasAccess(data.role, l.minRole)} />)}
                  </div>
                )}

                {subCats.map((sc) => {
                  const scLessons = chLessons.filter((l) => l.subCategoryId === sc.id).sort(byOrder);
                  if (scLessons.length === 0) return null;
                  return (
                    <div key={sc.id} className="space-y-2">
                      <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/50">{sc.title}</h3>
                      <div className="grid gap-2 md:grid-cols-2">
                        {scLessons.map((l) => <LessonLink key={l.id} lesson={l} passed={data.passed(l.id)} locked={!hasAccess(data.role, l.minRole)} />)}
                      </div>
                    </div>
                  );
                })}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
