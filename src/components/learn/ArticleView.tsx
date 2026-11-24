'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { doc } from 'firebase/firestore';
import {
  ArrowLeft, ArrowRight, BookCheck, CheckCircle2, Clock, HelpCircle, Pencil, RotateCcw, Share2,
} from 'lucide-react';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Article, ArticleProgress, LearnQuiz, isLessonPassed, isSuperAdmin } from '@/lib/game/types';
import { submitResult } from '@/lib/credits';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { LessonContent, getYouTubeEmbedUrl, lessonOutline } from './LessonContent';
import { useLearnData } from './useLearnData';
import { TopicProgress } from './TopicProgress';

/** Dünner Balken unter dem Kopf: wie weit ist die Lektion gelesen? */
function useReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return progress;
}

/** Lektionen eines Kurses in der Reihenfolge der Kursseite (Kapitel → Lektion → Unterthema). */
function useNeighbours(article: Article) {
  const data = useLearnData();
  return useMemo(() => {
    const courseId = article.courseId ?? 'producing';
    const course = data.courses.find((c) => c.id === courseId);
    if (!course) return { course: undefined, chapter: undefined, next: undefined, chapterLessons: [] as Article[], passedOf: data.passed };
    const ordered = data.orderedLessonsOf(courseId);
    const i = ordered.findIndex((l) => l.id === article.id);
    const chapterId = article.chapterId ?? article.categoryId;
    const chapter = course.chapters.find((c) => c.id === chapterId);
    const chapterLessons = chapterId ? data.chapterLessons(courseId, chapterId) : [];
    return { course, chapter, next: i >= 0 ? ordered[i + 1] : undefined, chapterLessons, passedOf: data.passed };
  }, [data, article]);
}

export function ArticleView({ article }: { article: Article }) {
  const db = useFirestore();
  const { user, profile } = useUser();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const reading = useReadingProgress();
  const { course, chapter, next, chapterLessons, passedOf } = useNeighbours(article);

  const quizRef = useMemoFirebase(() => (db ? doc(db, 'learnQuizzes', article.id) : null), [db, article.id]);
  const { data: quiz, isLoading: loadingQuiz } = useDoc<LearnQuiz>(quizRef);
  const progressRef = useMemoFirebase(() => (db && user ? doc(db, 'users', user.uid, 'articleProgress', article.id) : null), [db, user, article.id]);
  const { data: progress } = useDoc<ArticleProgress>(progressRef);

  const outline = useMemo(() => lessonOutline(article.content), [article.content]);
  const questions = quiz?.questions ?? [];
  const hasQuiz = questions.length > 0;
  const passed = isLessonPassed(progress ?? undefined) || (quizScore ?? 0) >= 80;
  const courseHref = `/learn/${article.courseId ?? 'producing'}`;
  const accent = course?.color ?? '#FF3399';
  const chapterIndex = chapterLessons.findIndex((l) => l.id === article.id);
  const chapterPassed = chapterLessons.map((l) => (l.id === article.id ? passed : passedOf(l.id)));
  const allAnswered = questions.every((_, i) => selected[i] !== undefined);

  const submit = async (answers: (number | null)[]) => {
    if (!user) {
      toast({ title: 'Bitte anmelden', description: 'Nur angemeldet wird dein Fortschritt gespeichert.' });
      return null;
    }
    setBusy(true);
    const result = await submitResult(user, { kind: 'article', refId: article.id, answers });
    setBusy(false);
    if (!result) toast({ variant: 'destructive', title: 'Speichern fehlgeschlagen', description: 'Bitte nochmals versuchen.' });
    return result;
  };

  /** Nach dem Bestehen: Fortschritt im Kapitel statt Credits zeigen. */
  const progressNote = () => {
    if (!chapter || chapterIndex < 0) return undefined;
    const done = chapterLessons.filter((l) => l.id === article.id || passedOf(l.id)).length;
    return done >= chapterLessons.length
      ? `«${chapter.title}» gemeistert!`
      : `${done} von ${chapterLessons.length} in «${chapter.title}»`;
  };

  const markRead = async () => {
    const result = await submit([]);
    if (result) toast({ title: 'Lektion abgeschlossen', description: progressNote() });
  };

  const evaluate = async () => {
    const result = await submit(questions.map((_, i) => selected[i] ?? null));
    if (result) {
      setQuizScore(result.score);
      if (result.score >= 80) toast({ title: 'Bestanden', description: progressNote() });
    }
  };

  const share = () => {
    navigator.clipboard.writeText(`${window.location.origin}/learn/article/${article.id}`);
    toast({ title: 'Link kopiert' });
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-primary/40 overflow-x-hidden">
      <header className="sticky top-0 z-50 bg-black/85 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href={courseHref} aria-label="Zurück zum Kurs" className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-white/5">
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </Link>
          <p className="flex-1 min-w-0 truncate text-sm font-medium text-white/80">{article.title}</p>
          {isSuperAdmin(profile?.role) && (
            <>
              <Link href={`/admin/articles/${article.id}`} aria-label="Bearbeiten" className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/5"><Pencil className="w-4 h-4 text-white/70" /></Link>
              <button type="button" onClick={share} aria-label="Link kopieren" className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/5"><Share2 className="w-4 h-4 text-white/70" /></button>
            </>
          )}
        </div>
        <div className="h-0.5 bg-white/5"><div className="h-full transition-[width] duration-150" style={{ width: `${reading * 100}%`, background: accent }} /></div>
      </header>

      <main className="max-w-3xl mx-auto px-5 md:px-8 pb-24">
        {/* Kopfbereich */}
        <section className="relative pt-10 md:pt-16 pb-8">
          <div className="absolute -top-10 -right-24 w-72 h-72 rounded-full blur-[120px] opacity-25 pointer-events-none" style={{ background: accent }} />
          <p className="relative eyebrow" style={{ color: accent }}>
            {[course?.title, chapter?.title].filter(Boolean).join(' · ') || 'Lektion'}
          </p>
          <h1 className="relative mt-3 text-4xl md:text-6xl h-display text-gradient break-words">{outline.title ?? article.title}</h1>
          <div className="relative mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/70">
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> ca. {outline.minutes} Min.</span>
            {hasQuiz && <span className="flex items-center gap-1.5"><HelpCircle className="w-4 h-4" /> Quiz mit {questions.length} {questions.length === 1 ? 'Frage' : 'Fragen'}</span>}
            {passed && <span className="flex items-center gap-1.5 text-success"><CheckCircle2 className="w-4 h-4" /> Bestanden</span>}
          </div>
          {chapter && chapterIndex >= 0 && chapterLessons.length > 1 && (
            <div className="relative mt-6 max-w-sm">
              <p className="text-xs text-white/60 mb-2">
                Lektion {chapterIndex + 1} von {chapterLessons.length} in «{chapter.title}» · {chapterPassed.filter(Boolean).length} bestanden
              </p>
              <TopicProgress passed={chapterPassed} currentIndex={chapterIndex} accent={accent} />
            </div>
          )}
        </section>

        {/* Inhaltsverzeichnis für längere Lektionen */}
        {outline.sections.length >= 3 && (
          <nav aria-label="Inhalt" className="mb-10 flex flex-wrap gap-2">
            {outline.sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="px-3 h-8 inline-flex items-center rounded-full border border-white/15 text-sm text-white/75 hover:text-white hover:border-white/40">
                {s.text}
              </a>
            ))}
          </nav>
        )}

        <article className="max-w-2xl">
          <LessonContent content={outline.body} />
          {article.youtubeUrls?.map((url) => {
            const src = getYouTubeEmbedUrl(url);
            return src ? (
              <div key={url} className="mb-8 aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
                <iframe src={src} title="YouTube" className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen loading="lazy" />
              </div>
            ) : null;
          })}
        </article>

        {/* Quiz */}
        {hasQuiz && (
          <section className="mt-16 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-10">
            <p className="eyebrow" style={{ color: accent }}>Wissens-Check</p>
            <h2 className="mt-2 text-2xl md:text-3xl font-bold">Hast du's verstanden?</h2>
            <p className="mt-2 text-white/70">Ab 80 % bestanden. Du kannst es so oft versuchen, wie du willst.</p>
            {quizScore === null ? (
              <div className="mt-8 space-y-10">
                {questions.map((q, i) => (
                  <fieldset key={i} className="space-y-3">
                    <legend className="text-lg font-bold leading-snug mb-3">{i + 1}. {q.question}</legend>
                    <div className="grid gap-2">
                      {q.options.map((opt, o) => (
                        <button key={o} type="button" onClick={() => setSelected({ ...selected, [i]: o })} aria-pressed={selected[i] === o}
                          className={cn('text-left min-h-12 px-5 py-3 rounded-xl border text-base transition-colors',
                            selected[i] === o ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/10 hover:bg-white/10')}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ))}
                <Button onClick={evaluate} disabled={busy || !allAnswered} className="w-full h-14 rounded-2xl text-base font-bold">
                  {allAnswered ? 'Auswerten' : `Noch ${questions.length - Object.keys(selected).length} offen`}
                </Button>
              </div>
            ) : (
              <div className="mt-8 flex flex-col items-center text-center gap-3">
                <p className={cn('text-6xl font-black italic tracking-tighter', quizScore >= 80 ? 'text-success' : 'text-warning')}>{quizScore}%</p>
                <p className="text-white/80">{quizScore >= 80 ? 'Bestanden – stark!' : 'Noch nicht ganz. Lies die Stellen nochmals nach und versuch es erneut.'}</p>
                {quizScore < 80 && (
                  <Button variant="outline" onClick={() => { setQuizScore(null); setSelected({}); }} className="mt-2 rounded-full"><RotateCcw className="w-4 h-4 mr-2" /> Nochmals versuchen</Button>
                )}
              </div>
            )}
          </section>
        )}

        {/* Abschluss */}
        <section className="mt-12 space-y-4">
          {!hasQuiz && !loadingQuiz && !passed && (
            <Button onClick={markRead} disabled={busy} className="w-full h-14 rounded-2xl text-base font-bold"><BookCheck className="w-5 h-5 mr-2" /> Als gelesen markieren</Button>
          )}
          {passed && (
            <p className="flex items-center justify-center gap-2 text-success font-semibold"><CheckCircle2 className="w-5 h-5" /> Lektion bestanden</p>
          )}
          {next ? (
            <Link href={`/learn/article/${next.id}`}
              className="group flex items-center gap-4 p-5 rounded-2xl border border-white/10 bg-white/[0.03] hover:border-white/30 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="eyebrow">Weiter</p>
                <p className="mt-1 text-lg font-bold truncate">{next.title}</p>
              </div>
              <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 group-hover:translate-x-1 transition-transform" style={{ background: accent }}>
                <ArrowRight className="w-5 h-5 text-white" />
              </span>
            </Link>
          ) : null}
          <Link href={courseHref} className="block text-center text-sm text-white/60 hover:text-white py-2">Zurück zum Kurs</Link>
        </section>
      </main>
    </div>
  );
}
