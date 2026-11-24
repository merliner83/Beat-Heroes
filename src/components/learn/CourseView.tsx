'use client';

import React from 'react';
import { TopicProgress, topicLevel } from './TopicProgress';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, Gamepad2, Loader2, Lock, Plus } from 'lucide-react';
import { Article, hasAccess, isSuperAdmin } from '@/lib/game/types';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useLearnData } from './useLearnData';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { APP_COLORS, APP_ICONS, LEARN_ICONS } from './icons';
import { lessonOutline } from './LessonContent';

function LessonLink({ lesson, passed, locked }: { lesson: Article; passed: boolean; locked: boolean }) {
  return (
    <Link href={locked ? '#' : `/learn/article/${lesson.id}`} className={cn('block group/l', locked && 'cursor-not-allowed opacity-50')}>
      <div className={cn(
        'p-4 rounded-xl border transition-all flex items-center justify-between gap-3',
        passed ? 'bg-success/10 border-success/30' : 'bg-black/40 border-white/5 hover:border-primary/30',
      )}>
        <div className="flex items-center gap-3 min-w-0">
          {passed && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
          <span className={cn('text-sm font-bold truncate', passed ? 'text-success' : 'group-hover/l:text-primary')}>{lesson.title}</span>
        </div>
        {locked ? <Lock className="w-3 h-3 text-white/20 shrink-0" /> : <ChevronRight className="w-4 h-4 text-white/20 shrink-0" />}
      </div>
    </Link>
  );
}

/** Auswahl in Wahlkapiteln, z.B. «Dein DAW»: Logos der Unterthemen als Knöpfe. */
function ChoicePicker({ chapterId, choice, accent }: {
  chapterId: string; accent: string;
  choice: NonNullable<ReturnType<ReturnType<typeof useLearnData>['choiceOf']>>;
}) {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const pick = async (id: string) => {
    if (!db || !user) { toast({ title: 'Bitte anmelden', description: 'Dann merkt sich Beat Heroes deine Wahl.' }); return; }
    try {
      await updateDoc(doc(db, 'users', user.uid), { [`choices.${chapterId}`]: id });
    } catch {
      toast({ variant: 'destructive', title: 'Speichern fehlgeschlagen' });
    }
  };
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{choice.chosen ? choice.label : `${choice.label}: Womit arbeitest du?`}</p>
      <div className="flex flex-wrap gap-2">
        {choice.options.map((o) => {
          const active = choice.chosen && choice.selected?.id === o.id;
          return (
            <button key={o.id} type="button" onClick={() => pick(o.id)} aria-pressed={active}
              className={cn('h-11 pl-2 pr-4 rounded-full border flex items-center gap-2 text-sm font-medium transition-colors',
                active ? 'text-white' : 'border-white/15 text-white/75 hover:border-white/40')}
              style={active ? { borderColor: accent, background: `${accent}26` } : undefined}>
              {o.iconUrl ? <img src={o.iconUrl} alt="" className="w-7 h-7 rounded-md object-contain bg-white/5" /> : <span className="w-7 h-7" />}
              {o.title}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-white/60">Du kannst jederzeit wechseln. Credits gibt es in diesem Kapitel insgesamt so viele wie für ein Programm.</p>
    </div>
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
  const open = data.orderedLessonsOf(course.id).filter((l) => hasAccess(data.role, l.minRole) && !data.passed(l.id));
  const nextLesson = open.find((l) => l.content?.trim()) ?? open[0];
  const nextChapter = nextLesson && course.chapters.find((c) => c.id === (nextLesson.chapterId ?? nextLesson.categoryId));

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="space-y-4">
        <Link href="/learn" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white"><ArrowLeft className="w-4 h-4" /> Alle Kurse</Link>
        <div className="relative overflow-hidden p-6 md:p-10 rounded-[2rem] border border-white/10 bg-black">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full blur-[110px] opacity-30" style={{ backgroundColor: course.color }} />
          <h1 className="relative text-3xl md:text-5xl h-display">{course.title}</h1>
          {course.description && <p className="relative text-white/60 mt-3 max-w-2xl">{course.description}</p>}
          {stats.total > 0 && (
            <div className="relative mt-5 max-w-md">
              <p className="text-sm text-white/70 mb-2">{stats.done} von {stats.total} Lektionen bestanden</p>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(stats.done / stats.total) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {nextLesson ? (
        <Link href={`/learn/article/${nextLesson.id}`}
          className="group flex items-center gap-4 p-5 md:p-6 rounded-2xl border bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
          style={{ borderColor: `${course.color}66` }}>
          <div className="flex-1 min-w-0">
            <p className="eyebrow" style={{ color: course.color }}>{stats.done === 0 ? 'Starte hier' : 'Weitermachen'}</p>
            <p className="mt-1 text-xl md:text-2xl font-bold truncate">{nextLesson.title}</p>
            <p className="mt-1 text-sm text-white/60 truncate">
              {nextChapter?.title}{nextLesson.content ? ` · ca. ${lessonOutline(nextLesson.content).minutes} Min.` : ''}
            </p>
          </div>
          <span className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 group-hover:translate-x-1 transition-transform" style={{ background: course.color }}>
            <ArrowRight className="w-5 h-5 text-white" />
          </span>
        </Link>
      ) : stats.total > 0 ? (
        <div className="flex items-center gap-3 p-5 rounded-2xl border border-success/30 bg-success/10 text-success font-semibold">
          <CheckCircle2 className="w-5 h-5" /> Alle Lektionen in «{course.title}» bestanden – stark!
        </div>
      ) : null}

      <Accordion type="multiple" className="space-y-3">
        {chapters.map((ch) => {
          const chLessons = lessons.filter((l) => (l.chapterId ?? l.categoryId) === ch.id);
          const subCats = data.subCats.filter((s) => s.categoryId === ch.id).sort(byOrder);
          const direct = chLessons.filter((l) => !l.subCategoryId || !subCats.some((s) => s.id === l.subCategoryId)).sort(byOrder);
          const apps = data.apps.filter((a) => ch.appIds?.includes(a.id));
          const done = chLessons.filter((l) => data.passed(l.id)).length;
          const level = topicLevel(done, chLessons.length);
          const ordered = data.chapterLessons(course.id, ch.id);
          const mastered = chLessons.length > 0 && done >= chLessons.length;
          const started = done > 0;
          const Icon = LEARN_ICONS[ch.iconName ?? ''] ?? LEARN_ICONS.BookOpen;
          const choice = data.choiceOf(course.id, ch.id);
          const empty = chLessons.length === 0 && apps.length === 0;

          return (
            <div key={ch.id} className="relative pl-12 md:pl-14">
              {/* Status-Kreis mit Kapitelsymbol: grau = offen, Kursfarbe = angefangen, grün = gemeistert */}
              <span className={cn('absolute left-0 top-4 w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center border',
                mastered ? 'bg-success text-black border-success' : started ? 'bg-black border-2' : 'bg-black border-white/15 text-white/60')}
                style={started && !mastered ? { borderColor: course.color, color: course.color } : undefined}>
                {mastered ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4 md:w-5 md:h-5" />}
              </span>
            <AccordionItem value={ch.id} className={cn('border rounded-2xl bg-white/[0.02] px-4 md:px-6', empty ? 'border-white/5 opacity-60' : 'border-white/10')}>
              <AccordionTrigger className="hover:no-underline py-4 md:py-5">
                <div className="flex items-start gap-3 w-full pr-3">
                  <div className="flex-1 min-w-0 text-left">
                    <h2 className="text-lg md:text-xl font-bold leading-snug">{ch.title}</h2>
                    {ch.description && <p className="mt-1 text-sm text-white/65 font-normal line-clamp-2">{ch.description}</p>}
                    {choice && (
                      <p className="mt-1 text-sm font-normal" style={{ color: choice.chosen ? course.color : undefined }}>
                        {choice.chosen ? `${choice.label}: ${choice.selected?.title}` : <span className="text-warning">{choice.label} wählen</span>}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-white/60 font-normal">
                      {empty ? 'Lektionen folgen bald' : `${chLessons.length ? `${chLessons.length} Lektion${chLessons.length === 1 ? '' : 'en'}` : ''}${chLessons.length && apps.length ? ' · ' : ''}${apps.length ? `${apps.length} Übung${apps.length === 1 ? '' : 'en'}` : ''}`}
                    </p>
                    {chLessons.length > 0 && (
                      <TopicProgress className="mt-2 max-w-xs" passed={ordered.map((l) => data.passed(l.id))} />
                    )}
                  </div>
                  {chLessons.length > 0 && (
                    <span className={cn('mt-1 text-xs font-semibold whitespace-nowrap', level.className)}>{level.label}</span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-6 space-y-5">
                {choice && <ChoicePicker chapterId={ch.id} choice={choice} accent={course.color} />}
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
                          <span className="h-display text-sm">{app.name}</span>
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
                      <h3 className="text-base font-bold text-white/90">{sc.title}</h3>
                      <div className="grid gap-2 md:grid-cols-2">
                        {scLessons.map((l) => <LessonLink key={l.id} lesson={l} passed={data.passed(l.id)} locked={!hasAccess(data.role, l.minRole)} />)}
                      </div>
                    </div>
                  );
                })}
              </AccordionContent>
            </AccordionItem>
            </div>
          );
        })}
      </Accordion>
    </div>
  );
}
