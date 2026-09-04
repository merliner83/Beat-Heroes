'use client';

import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Article } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, ShieldCheck } from 'lucide-react';

export default function AdminPage() {
  const { profile, isUserLoading } = useUser();
  const db = useFirestore();
  const articlesQuery = useMemoFirebase(() => db ? query(collection(db, 'articles')) : null, [db]);
  const { data: articles, isLoading: isLoadingArticles } = useCollection<Article>(articlesQuery);

  if (isUserLoading) return <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  if (profile?.role !== 'admin') return <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center"><p className="font-bold">Access denied.</p></div>;

  return <main className="min-h-screen bg-[#050505] text-white p-6 md:p-10"><div className="max-w-6xl mx-auto"><Link href="/"><Button variant="ghost" className="mb-8"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button></Link><div className="flex items-center gap-4 mb-10"><ShieldCheck className="w-10 h-10 text-primary" /><div><p className="text-xs uppercase tracking-[0.3em] text-primary font-bold">BeatHero Admin</p><h1 className="text-3xl md:text-5xl font-bold tracking-tight">Learn CMS</h1></div></div><section className="space-y-3">{isLoadingArticles ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : articles?.map(article => <div key={article.id} className="border border-white/10 rounded-2xl p-5 bg-white/[0.02]"><h2 className="font-bold text-lg">{article.title}</h2><p className="text-sm text-white/40">{article.id} · {article.categoryId} · {article.youtubeUrls?.length || 0} YouTube</p></div>)}</section></div></main>;
}
