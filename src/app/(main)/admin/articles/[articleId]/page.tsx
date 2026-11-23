'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useUser } from '@/firebase';
import { isSuperAdmin } from '@/lib/game/types';
import { LessonEditor } from '@/components/admin/LessonEditor';

function EditorPage() {
  const { articleId } = useParams<{ articleId: string }>();
  const params = useSearchParams();
  const { profile, isUserLoading } = useUser();
  if (isUserLoading) return <div className="h-64 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  if (!isSuperAdmin(profile?.role)) return <p className="font-bold text-center py-20">Kein Zugriff.</p>;
  const isNew = articleId === 'new';
  return (
    <LessonEditor
      key={articleId}
      lessonId={isNew ? null : articleId}
      defaults={isNew ? { courseId: params.get('course') ?? undefined, chapterId: params.get('chapter') ?? undefined } : undefined}
    />
  );
}

export default function AdminArticlePage() {
  return <Suspense><EditorPage /></Suspense>;
}
