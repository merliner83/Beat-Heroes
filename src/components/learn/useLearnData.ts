'use client';

import { useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import {
  Achievement, Article, ArticleProgress, Course, LearnApp, LearnSubCat, LearningPath, hasAccess, isLessonPassed,
} from '@/lib/game/types';

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
  const achievementsQ = useMemoFirebase(() => (db && user ? query(collection(db, 'achievements'), where('uid', '==', user.uid)) : null), [db, user]);

  const { data: courses, isLoading: loadingCourses } = useCollection<Course>(coursesQ);
  const { data: articles } = useCollection<Article>(articlesQ);
  const { data: subCats } = useCollection<LearnSubCat>(subCatsQ);
  const { data: apps } = useCollection<LearnApp>(appsQ);
  const { data: paths } = useCollection<LearningPath>(pathsQ);
  const { data: progress } = useCollection<ArticleProgress>(progressQ);
  const { data: achievements } = useCollection<Achievement>(achievementsQ);

  return useMemo(() => {
    const role = profile?.role;
    const visibleCourses = (courses ?? [])
      .filter((c) => hasAccess(role, c.minRole))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const progressById = new Map((progress ?? []).map((p) => [p.articleId ?? p.id, p]));
    const passed = (lessonId: string, minScore = 80) => isLessonPassed(progressById.get(lessonId), minScore);
    // Entwürfe (minRole teacher) sehen Schüler:innen gar nicht.
    const lessonsOf = (courseId: string) => (articles ?? []).filter((a) => (a.courseId ?? 'producing') === courseId && hasAccess(role, a.minRole));
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
      lessonsOf,
      courseStats,
      role,
    };
  }, [courses, loadingCourses, articles, subCats, apps, paths, progress, achievements, profile?.role]);
}
