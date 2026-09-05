'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Article } from '@/lib/game/types';
import { Input } from '@/components/ui/input';
export default function AdminArticlePage() {
  const { articleId } = useParams();
  const db = useFirestore();
  const { profile, isUserLoading } = useUser();
  const articleRef = useMemoFirebase(() => { if (db == null || articleId == null) return null; return doc(db, 'articles', articleId as string); }, [db, articleId]);
  const { data: article, isLoading: isLoadingArticle } = useDoc<Article>(articleRef);
  const [title, setTitle] = useState("");
  useEffect(() => { if (article) setTitle(article.title); }, [article]);
  if (isUserLoading || isLoadingArticle) return <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">Loading...</div>;
  if (profile?.role !== "admin") return <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">Access denied.</div>;
  return <main className="min-h-screen bg-[#050505] text-white p-6 md:p-10"><div className="max-w-4xl mx-auto"><p className="text-xs uppercase tracking-[0.3em] text-primary font-bold mb-3">Article Editor</p><h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-8">{article?.title || "Article not found"}</h1><div className="space-y-2"><label className="text-sm font-bold text-white/70">Title</label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div><p className="text-sm text-white/40 mt-6">{articleId as string}</p></div></main>;
}
