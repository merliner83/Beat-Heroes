
"use client";
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function PlayGameRedirect() {
  const router = useRouter();
  const { studioId, gameId, levelId } = useParams();
  
  useEffect(() => {
    router.replace(`/game-session/${studioId}/${gameId}/${levelId}`);
  }, [router, studioId, gameId, levelId]);

  return null;
}
