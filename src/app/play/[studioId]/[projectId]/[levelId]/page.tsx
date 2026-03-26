
"use client";

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

/**
 * Redirect component for legacy 'project' routes.
 * Ensures users are sent to the new 'game' structure or back to the studio.
 */
export default function ProjectRedirectPage() {
  const router = useRouter();
  const { studioId } = useParams();

  useEffect(() => {
    // Redirect to the studio page since the project structure has migrated to games
    if (studioId) {
      router.replace(`/studio/${studioId}`);
    } else {
      router.replace('/');
    }
  }, [router, studioId]);

  return null;
}
