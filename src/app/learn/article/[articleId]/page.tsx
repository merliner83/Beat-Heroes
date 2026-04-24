
"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Article } from '@/lib/game/types';
import { ArticleView } from '@/components/learn/ArticleView';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ArticlePage() {
  const { articleId } = useParams();
  const db = useFirestore();

  const articleRef = useMemoFirebase(() => {
    if (!db || !articleId) return null;
    return doc(db, 'articles', articleId as string);
  }, [db, articleId]);

  const { data: article, isLoading } = useDoc<Article>(articleRef);

  if (isLoading) {
    return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-center text-white gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 italic">Decrypting Data...</p>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-center text-white p-6 text-center">
        <AlertCircle className="w-16 h-16 text-destructive mb-6" />
        <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-2 text-gradient">Data Corrupted</h2>
        <p className="text-sm opacity-50 mb-8 max-w-xs font-medium">This article does not exist in the Knowledge Base.</p>
        <Link href="/">
          <Button className="bg-white text-black font-black uppercase italic rounded-full px-12 h-14">Back to Lab</Button>
        </Link>
      </div>
    );
  }

  return <ArticleView article={article} />;
}
