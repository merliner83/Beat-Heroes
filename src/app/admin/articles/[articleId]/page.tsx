'use client';

import { useParams } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Article } from '@/lib/game/types';
export default function AdminArticlePage() {
  const { articleId } = useParams();
  const db = useFirestore();
  const { profile, isUserLoading } = useUser();
  const articleRef = useMemoFirebase(() => { if (db == null || articleId == null) return null; return doc(db, 'articles', articleId as string); }, [db, articleId]);
  const { data: article, isLoading: isLoadingArticle } = useDoc<Article>(articleRef);
  if (isUserLoading || isLoadingArticle) return <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">Loading...</div>;
  if (profile?.role !== "admin") return <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">Access denied.</div>;
  return <main className="min-h-screen bg-[#050505] text-white p-6 md:p-10"><div className="max-w-4xl mx-auto"><p className="text-xs uppercase tracking-[0.3em] text-primary font-bold mb-3">Article Editor</p><h1 className="text-3xl md:text-5xl font-bold tracking-tight">{article?.title || "Article not found"}</h1><p className="text-sm text-white/40 mt-3">{articleId as string}</p></div></main>;
}
