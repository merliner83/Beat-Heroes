
"use client";
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function RedirectToSession() {
  const router = useRouter();
  const { levelId } = useParams();
  
  useEffect(() => {
    if (levelId) router.replace(`/session/${levelId}`);
  }, [router, levelId]);

  return null;
}
