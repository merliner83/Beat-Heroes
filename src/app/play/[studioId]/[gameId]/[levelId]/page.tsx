
"use client";
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function OldRouteRedirect() {
  const router = useRouter();
  const { studioId, gameId, levelId } = useParams();
  
  useEffect(() => {
    router.replace(`/play-game/${studioId}/${gameId}/${levelId}`);
  }, [router, studioId, gameId, levelId]);

  return null;
}
