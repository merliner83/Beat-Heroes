
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Empty legacy route to avoid dynamic segment conflicts in Next.js.
 */
export default function LegacyRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
