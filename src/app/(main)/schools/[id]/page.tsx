import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, Handshake, MapPin } from 'lucide-react';
import { adminDb } from '@/lib/server/firebase-admin';
import { loadSchools } from '@/lib/server/schools';
import { DEFAULT_ACCENT } from '@/lib/game/types';
import { SchoolLogo } from '@/components/schools/SchoolBadge';

// Öffentliches Schulprofil mit allen freigegebenen Artists der Schule.
export const dynamic = 'force-dynamic';

async function load(id: string) {
  if (!/^[a-z0-9-]{1,40}$/.test(id)) return null;
  const [school] = await loadSchools([id]);
  if (!school) return null;
  const snap = await adminDb().collection('profiles').where('schoolIds', 'array-contains', id).get();
  const artists = snap.docs.map((d) => {
    const p = d.data();
    return {
      id: d.id,
      handle: String(p.handle ?? ''),
      artistName: String(p.artistName ?? ''),
      avatarUrl: (p.avatarUrl as string) ?? null,
      accentColor: (p.accentColor as string) ?? null,
      roles: (p.roles as string[]) ?? [],
      openForCollab: !!p.openForCollab,
    };
  }).filter((a) => a.handle).sort((a, b) => a.artistName.localeCompare(b.artistName, 'de'));
  return { school, artists };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);
  if (!data) return { title: 'Schule nicht gefunden – Beat Heroes' };
  const { school } = data;
  const description = school.description?.slice(0, 160) || `Artists der ${school.name} bei Beat Heroes`;
  const image = school.bannerUrl || school.logoUrl;
  return {
    title: `${school.name} – Beat Heroes`,
    description,
    openGraph: { title: school.name, description, images: image ? [{ url: image }] : undefined },
  };
}

export default async function SchoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await load(id);
  if (!data) notFound();
  const { school, artists } = data;
  const accent = school.accentColor || DEFAULT_ACCENT;

  return (
    <div className="space-y-8 max-w-5xl">
      <Link href="/artists" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"><ArrowLeft className="w-4 h-4" /> Alle Artists</Link>

      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black">
        <div className="relative h-36 md:h-56">
          {school.bannerUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={school.bannerUrl} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full" style={{ background: `radial-gradient(120% 140% at 85% 0%, ${accent}cc 0%, ${accent}33 40%, #000 75%)` }} />}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        </div>
        <div className="relative px-6 md:px-10 pb-6 md:pb-10 -mt-14 flex flex-col md:flex-row md:items-end gap-5">
          <SchoolLogo school={school} size={112} className="rounded-2xl border-4 border-black shadow-xl" />
          <div className="space-y-2 min-w-0">
            <h1 className="text-3xl md:text-5xl h-display leading-none break-words">{school.name}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-white/70">
              {school.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {school.location}</span>}
              {school.website && (
                <a href={school.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-white">
                  {school.website.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '')} <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
        {school.description && <p className="relative px-6 md:px-10 pb-8 text-white/80 whitespace-pre-line leading-relaxed max-w-3xl">{school.description}</p>}
      </section>

      <section className="space-y-4">
        <p className="eyebrow">Artists ({artists.length})</p>
        {artists.length === 0 ? (
          <p className="text-sm text-white/60 p-6 rounded-2xl border border-dashed border-white/15">Noch keine freigegebenen Profile.</p>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {artists.map((a) => {
              const c = a.accentColor || DEFAULT_ACCENT;
              return (
                <Link key={a.id} href={`/artists/${a.handle}`} className="group p-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:border-white/30 transition-colors text-center space-y-2">
                  <div className="w-20 h-20 mx-auto rounded-full overflow-hidden bg-neutral-900 border-2 flex items-center justify-center" style={{ borderColor: c }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {a.avatarUrl ? <img src={a.avatarUrl} referrerPolicy="no-referrer" alt={a.artistName} className="w-full h-full object-cover" /> : <span className="text-3xl font-black italic" style={{ color: c }}>{a.artistName.charAt(0)}</span>}
                  </div>
                  <p className="h-display truncate">{a.artistName}</p>
                  <p className="text-xs text-white/60 truncate">{a.roles.slice(0, 2).join(' · ')}</p>
                  {a.openForCollab && <p className="text-xs text-success flex items-center justify-center gap-1"><Handshake className="w-3.5 h-3.5" /> Kollabos</p>}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
