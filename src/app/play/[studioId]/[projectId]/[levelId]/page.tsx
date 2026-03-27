
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Dieser Pfad wurde neutralisiert, um den Slug-Konflikt (projectId vs gameId) zu lösen.
 * Alle Game-Sessions laufen nun über /session/[levelId].
 */
export default function NeutralizeConflict() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
