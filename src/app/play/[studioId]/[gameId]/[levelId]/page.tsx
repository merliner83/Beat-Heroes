
"use client";
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function RedirectPage() {
  const router = useRouter();
  const { levelId } = useParams();
  useEffect(() => {
    if (levelId) router.replace(`/session/${levelId}`);
    else router.replace('/');
  }, [router, levelId]);
  return null;
}
