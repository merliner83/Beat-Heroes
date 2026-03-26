
"use client";

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function LegacyRouteNeutralizer() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
