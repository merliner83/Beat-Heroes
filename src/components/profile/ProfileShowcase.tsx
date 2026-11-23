import React from 'react';
import { ExternalLink, Handshake } from 'lucide-react';
import { ProfileContent, toEmbed } from '@/lib/game/types';

/** Darstellung eines Profils (öffentliche Seite, Vorschau, Prüfung). */
export function ProfileShowcase({ profile, schoolName }: { profile: ProfileContent; schoolName?: string | null }) {
  const embeds = (profile.embeds ?? []).map((url) => ({ url, embed: toEmbed(url) })).filter((e) => e.embed);
  const initial = (profile.artistName || '?').charAt(0).toUpperCase();

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black p-6 md:p-10">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-primary/30 blur-[120px]" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-violet/25 blur-[120px]" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border-4 border-white/10 bg-white/5 shrink-0 flex items-center justify-center">
            {profile.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={profile.avatarUrl} alt={profile.artistName} className="w-full h-full object-cover" />
              : <span className="text-5xl font-black italic text-gradient">{initial}</span>}
          </div>
          <div className="min-w-0 space-y-3">
            <h1 className="text-4xl md:text-6xl h-display leading-none break-words">{profile.artistName || 'Dein Künstlername'}</h1>
            <div className="flex flex-wrap gap-2">
              {profile.roles?.map((r) => <span key={r} className="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold">{r}</span>)}
              {profile.genres?.map((g) => <span key={g} className="px-3 py-1 rounded-full bg-white/10 text-white/70 text-xs font-bold">{g}</span>)}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/50">
              {schoolName && <span>{schoolName}</span>}
              {profile.openForCollab && <span className="flex items-center gap-1 text-success"><Handshake className="w-4 h-4" /> Offen für Kollabos</span>}
            </div>
          </div>
        </div>
        {profile.bio && <p className="relative mt-6 text-white/75 whitespace-pre-line max-w-3xl leading-relaxed">{profile.bio}</p>}
      </section>

      {embeds.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2">
          {embeds.map(({ url, embed }) => embed!.kind === 'youtube' ? (
            <div key={url} className="aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black md:col-span-2">
              <iframe src={embed!.src} title="YouTube" className="w-full h-full" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
            </div>
          ) : (
            <iframe key={url} src={embed!.src} title={embed!.kind} height={embed!.height} className="w-full rounded-2xl border-0 bg-black" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" />
          ))}
        </section>
      )}

      {profile.links?.length > 0 && (
        <section className="flex flex-wrap gap-3">
          {profile.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow"
              className="flex items-center gap-2 px-5 h-11 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 font-bold text-sm">
              {l.label || new URL(l.url).hostname} <ExternalLink className="w-4 h-4 text-white/60" />
            </a>
          ))}
        </section>
      )}
    </div>
  );
}
