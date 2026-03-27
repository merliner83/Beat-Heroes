
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Dieser Pfad wurde neutralisiert, um den Slug-Konflikt zu lösen.
 */
export default function NeutralizeConflict() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
