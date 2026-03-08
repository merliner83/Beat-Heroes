
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect page to handle old route leftovers and prevent slug conflicts.
 * This route is now neutral.
 */
export default function RedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
