import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { adminDb } from '@/lib/server/firebase-admin';
import { PublicProfile } from '@/lib/game/types';
import { ProfileShowcase } from '@/components/profile/ProfileShowcase';

// Öffentliches Profil, serverseitig gerendert (Link-Vorschauen, Suchmaschinen).
export const dynamic = 'force-dynamic';

async function loadProfile(handle: string): Promise<PublicProfile | null> {
  if (!/^[a-z0-9-]{3,30}$/.test(handle)) return null;
  const db = adminDb();
  const handleDoc = await db.doc(`handles/${handle}`).get();
  const uid = handleDoc.get('uid') as string | undefined;
  if (!uid) return null;
  const snap = await db.doc(`profiles/${uid}`).get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  // Nur serialisierbare Felder an die Darstellung geben.
  return {
    id: snap.id,
    uid,
    artistName: data.artistName ?? '',
    handle: data.handle ?? handle,
    bio: data.bio ?? '',
    avatarUrl: data.avatarUrl ?? null,
    roles: data.roles ?? [],
    genres: data.genres ?? [],
    embeds: data.embeds ?? [],
    links: data.links ?? [],
    openForCollab: !!data.openForCollab,
    schoolId: data.schoolId ?? null,
    schoolName: data.schoolName ?? null,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const profile = await loadProfile(handle);
  if (!profile) return { title: 'Artist nicht gefunden – Beat Heroes' };
  const description = profile.bio?.slice(0, 160) || [...profile.roles, ...profile.genres].join(' · ') || 'Artist bei Beat Heroes';
  return {
    title: `${profile.artistName} – Beat Heroes`,
    description,
    openGraph: {
      title: profile.artistName,
      description,
      type: 'profile',
      images: profile.avatarUrl ? [{ url: profile.avatarUrl }] : undefined,
    },
  };
}

export default async function ArtistPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await loadProfile(handle);
  if (!profile) notFound();

  return (
    <div className="space-y-6 max-w-5xl">
      <Link href="/artists" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white"><ArrowLeft className="w-4 h-4" /> Alle Artists</Link>
      <ProfileShowcase profile={profile} schoolName={profile.schoolName} />
    </div>
  );
}
