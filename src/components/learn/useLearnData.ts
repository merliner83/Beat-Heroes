'use client';

import { useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import {
  Achievement, Article, ArticleProgress, Course, LearnApp, LearnSubCat, LearningPath, hasAccess, isLessonPassed,
} from '@/lib/game/types';
import { testsPassed } from '@/lib/learn/tests';

/** Lädt Kurse, Lektionen, Fortschritt und Lernpfade für den Lernbereich. */
export function useLearnData() {
  const db = useFirestore();
  const { user, profile } = useUser();

  const coursesQ = useMemoFirebase(() => (db ? query(collection(db, 'courses')) : null), [db]);
  const articlesQ = useMemoFirebase(() => (db ? query(collection(db, 'articles')) : null), [db]);
  const subCatsQ = useMemoFirebase(() => (db ? query(collection(db, 'learnSubCats')) : null), [db]);
  const appsQ = useMemoFirebase(() => (db ? query(collection(db, 'learnApps')) : null), [db]);
  const pathsQ = useMemoFirebase(() => (db ? query(collection(db, 'learningPaths')) : null), [db]);
  const progressQ = useMemoFirebase(() => (db && user ? query(collection(db, 'users', user.uid, 'articleProgress')) : null), [db, user]);
  const appProgressQ = useMemoFirebase(() => (db && user ? query(collection(db, 'users', user.uid, 'progress')) : null), [db, user]);
  const achievementsQ = useMemoFirebase(() => (db && user ? query(collection(db, 'achievements'), where('uid', '==', user.uid)) : null), [db, user]);

  const { data: courses, isLoading: loadingCourses } = useCollection<Course>(coursesQ);
  const { data: articles } = useCollection<Article>(articlesQ);
  const { data: subCats } = useCollection<LearnSubCat>(subCatsQ);
  const { data: apps } = useCollection<LearnApp>(appsQ);
  const { data: paths } = useCollection<LearningPath>(pathsQ);
  const { data: progress } = useCollection<ArticleProgress>(progressQ);
  const { data: appProgress } = useCollection<{ id: string; accuracy?: number }>(appProgressQ);
  const { data: achievements } = useCollection<Achievement>(achievementsQ);

  return useMemo(() => {
    const role = profile?.role;
    const visibleCourses = (courses ?? [])
      .filter((c) => hasAccess(role, c.minRole))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const progressById = new Map((progress ?? []).map((p) => [p.articleId ?? p.id, p]));
    const appBest = new Map((appProgress ?? []).map((p) => [p.id, p.accuracy ?? 0]));
    const contentById = new Map((articles ?? []).map((a) => [a.id, a.content]));
    /** Quiz bestanden und alle Prüfungen (z.B. Mitklopfen) der Lektion erfüllt. */
    const passed = (lessonId: string, minScore = 80) =>
      isLessonPassed(progressById.get(lessonId), minScore) && testsPassed(contentById.get(lessonId), (id) => appBest.get(id));
    const byOrder = (a: { order?: number }, b: { order?: number }) => (a.order ?? 0) - (b.order ?? 0);
    /**
     * Wahlkapitel (z.B. DAWs): Optionen = Unterthemen. Ohne eigene Wahl gilt
     * das erste Unterthema, damit Zählung und «Weitermachen» stimmen.
     */
    const choiceOf = (courseId: string, chapterId: string) => {
      const chapter = (courses ?? []).find((c) => c.id === courseId)?.chapters.find((ch) => ch.id === chapterId);
      if (!chapter?.choice) return null;
      const options = (subCats ?? []).filter((s) => s.categoryId === chapterId).sort(byOrder);
      const mine = profile?.choices?.[chapterId];
      const selected = options.find((o) => o.id === mine) ?? options[0];
      return { label: chapter.choice.label, options, selected, chosen: !!mine && selected?.id === mine };
    };
    // Entwürfe (minRole teacher) und leere Lektionen sehen Schüler:innen nicht; in Wahlkapiteln
    // nur die Lektionen der gewählten Option.
    const lessonsOf = (courseId: string) => (articles ?? []).filter((a) => {
      if ((a.courseId ?? 'producing') !== courseId || !hasAccess(role, a.minRole)) return false;
      // Leere Lektionen (noch ohne Text) sieht nur der superAdmin.
      if (!a.content?.trim() && role !== 'superAdmin') return false;
      const choice = choiceOf(courseId, a.chapterId ?? a.categoryId ?? '');
      return !choice?.selected || !a.subCategoryId || a.subCategoryId === choice.selected.id;
    });
    /** Lektionen eines Kapitels in Kursreihenfolge: direkte Lektionen, dann Unterthemen. */
    const chapterLessons = (courseId: string, chapterId: string) => {
      const chLessons = lessonsOf(courseId).filter((l) => (l.chapterId ?? l.categoryId) === chapterId);
      const scs = (subCats ?? []).filter((s) => s.categoryId === chapterId).sort(byOrder);
      return [
        ...chLessons.filter((l) => !l.subCategoryId || !scs.some((s) => s.id === l.subCategoryId)).sort(byOrder),
        ...scs.flatMap((sc) => chLessons.filter((l) => l.subCategoryId === sc.id).sort(byOrder)),
      ];
    };
    /** Alle Lektionen eines Kurses in der Reihenfolge der Kursseite. */
    const orderedLessonsOf = (courseId: string) => {
      const course = visibleCourses.find((c) => c.id === courseId);
      return course ? [...course.chapters].sort(byOrder).flatMap((ch) => chapterLessons(courseId, ch.id)) : [];
    };
    const courseStats = (courseId: string) => {
      const lessons = lessonsOf(courseId);
      const done = lessons.filter((l) => passed(l.id)).length;
      return { total: lessons.length, done, percent: lessons.length ? Math.round((done / lessons.length) * 100) : 0 };
    };
    const visiblePaths = (paths ?? [])
      .filter((p) => p.published !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const achievedPathIds = new Set((achievements ?? []).map((a) => a.pathId));

    return {
      loading: loadingCourses,
      courses: visibleCourses,
      articles: articles ?? [],
      subCats: subCats ?? [],
      apps: (apps ?? []).filter((a) => hasAccess(role, a.minRole)),
      paths: visiblePaths,
      achievedPathIds,
      progressById,
      passed,
      appBest,
      lessonsOf,
      chapterLessons,
      choiceOf,
      orderedLessonsOf,
      courseStats,
      role,
    };
  }, [courses, loadingCourses, articles, subCats, apps, paths, progress, appProgress, achievements, profile?.role, profile?.choices]);
}
