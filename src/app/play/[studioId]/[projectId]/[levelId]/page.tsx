
"use client";

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

/**
 * Legacy Route Redirection.
 * Da Next.js keine zwei identischen dynamischen Segmente ([gameId] vs [projectId]) erlaubt,
 * leiten wir hier hart auf die neue Struktur um.
 */
export default function LegacyRouteRedirect() {
  const router = useRouter();
  const { studioId, projectId, levelId } = useParams();

  useEffect(() => {
    if (studioId && projectId && levelId) {
      router.replace(`/play/${studioId}/${projectId}/${levelId}`);
    } else {
      router.replace('/');
    }
  }, [studioId, projectId, levelId, router]);

  return (
    <div className="h-screen bg-[#050505] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-[#FFEA00] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
