'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Handshake, Music2, Play, Star, Youtube } from 'lucide-react';
import { DEFAULT_ACCENT, MediaPreview, ProfileContent, School, toEmbed } from '@/lib/game/types';
import { SchoolBadge } from '@/components/schools/SchoolBadge';
import { cn } from '@/lib/utils';

type Embed = NonNullable<ReturnType<typeof toEmbed>>;

const KIND_LABEL = { spotify: 'Spotify', soundcloud: 'SoundCloud', youtube: 'YouTube' } as const;

function youtubeThumb(embed: Embed): string | null {
  const id = embed.src.match(/embed\/([A-Za-z0-9_-]{11})/)?.[1];
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

/** Holt fehlende Vorschauen (Titel/Bild) über /api/oembed nach. */
function usePreviews(urls: string[], initial?: Record<string, MediaPreview>) {
  const [previews, setPreviews] = useState<Record<string, MediaPreview>>(initial ?? {});
  const key = urls.join('|');
  useEffect(() => {
    const missing = urls.filter((u) => !previews[u]);
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map((u) => fetch(`/api/oembed?url=${encodeURIComponent(u)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)))
      .then((list) => {
        if (cancelled) return;
        setPreviews((p) => {
          const next = { ...p };
          list.forEach((x: MediaPreview | null, i) => { next[missing[i]] = x ?? { url: missing[i], kind: 'youtube', title: null, author: null, thumbnail: null }; });
          return next;
        });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return previews;
}

function Player({ embed, autoplay }: { embed: Embed; autoplay?: boolean }) {
  if (embed.kind === 'youtube') {
    return (
      <div className="aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black">
        <iframe src={embed.src + (autoplay ? '?autoplay=1' : '')} title="YouTube" className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
      </div>
    );
  }
  const src = autoplay ? embed.src.replace('auto_play=false', 'auto_play=true') : embed.src;
  return (
    <iframe src={src} title={embed.kind} height={embed.height} className="w-full rounded-2xl border-0 bg-black"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" />
  );
}

function MediaCard({ embed, preview, accent }: { embed: Embed; preview?: MediaPreview; accent: string }) {
  const [playing, setPlaying] = useState(false);
  const thumb = preview?.thumbnail ?? (embed.kind === 'youtube' ? youtubeThumb(embed) : null);
  const KindIcon = embed.kind === 'youtube' ? Youtube : Music2;

  if (playing) return <div className={embed.kind === 'youtube' ? 'sm:col-span-2' : ''}><Player embed={embed} autoplay /></div>;

  return (
    <button type="button" onClick={() => setPlaying(true)}
      className="group text-left rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03] hover:border-white/30 transition-colors">
      <div className={cn('relative bg-white/5 overflow-hidden', embed.kind === 'youtube' ? 'aspect-video' : 'aspect-square')}>
        {thumb
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={thumb} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center"><KindIcon className="w-10 h-10 text-white/30" /></div>}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
          <span className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg opacity-90 group-hover:scale-110 transition-transform" style={{ background: accent }}>
            <Play className="w-6 h-6 text-white fill-white ml-0.5" />
          </span>
        </span>
      </div>
      <div className="p-3 space-y-0.5">
        <p className="font-bold text-sm leading-snug line-clamp-2">{preview?.title ?? 'Abspielen'}</p>
        <p className="text-xs text-white/60 flex items-center gap-1.5">
          <KindIcon className="w-3.5 h-3.5" /> {KIND_LABEL[embed.kind]}{preview?.author ? ` · ${preview.author}` : ''}
        </p>
      </div>
    </button>
  );
}

/** Darstellung eines Profils (öffentliche Seite, Vorschau, Prüfung). */
export function ProfileShowcase({ profile, schools, previews: initialPreviews }: {
  profile: ProfileContent;
  schools?: School[];
  previews?: Record<string, MediaPreview>;
}) {
  const accent = profile.accentColor || DEFAULT_ACCENT;
  const embeds = useMemo(() => (profile.embeds ?? [])
    .map((url) => ({ url, embed: toEmbed(url) }))
    .filter((e): e is { url: string; embed: Embed } => !!e.embed), [profile.embeds]);
  const featured = embeds.find((e) => e.url === profile.featuredUrl) ?? embeds[0];
  const rest = embeds.filter((e) => e !== featured);
  const previews = usePreviews(rest.map((e) => e.url), initialPreviews);
  const initial = (profile.artistName || '?').charAt(0).toUpperCase();

  return (
    <div className="space-y-8" style={{ ['--accent' as string]: accent }}>
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black">
        <div className="relative h-36 md:h-56">
          {profile.bannerUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={profile.bannerUrl} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full" style={{ background: `radial-gradient(120% 140% at 85% 0%, ${accent}cc 0%, ${accent}33 40%, #000 75%)` }} />}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        </div>
        <div className="relative px-6 md:px-10 pb-6 md:pb-10 -mt-16 md:-mt-20 flex flex-col md:flex-row md:items-end gap-5">
          <div className="w-28 h-28 md:w-40 md:h-40 rounded-full overflow-hidden border-4 bg-neutral-900 shrink-0 flex items-center justify-center"
            style={{ borderColor: accent }}>
            {profile.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={profile.avatarUrl} referrerPolicy="no-referrer" alt={profile.artistName} className="w-full h-full object-cover" />
              : <span className="text-5xl font-black italic" style={{ color: accent }}>{initial}</span>}
          </div>
          <div className="min-w-0 space-y-3 flex-1">
            <h1 className="text-4xl md:text-6xl h-display leading-none break-words">{profile.artistName || 'Dein Künstlername'}</h1>
            <div className="flex flex-wrap gap-2">
              {profile.roles?.map((r) => (
                <span key={r} className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: `${accent}33`, color: accent }}>{r}</span>
              ))}
              {profile.genres?.map((g) => <span key={g} className="px-3 py-1 rounded-full bg-white/10 text-white/75 text-xs font-bold">{g}</span>)}
            </div>
            {profile.openForCollab && (
              <p className="flex items-center gap-1.5 text-sm text-success"><Handshake className="w-4 h-4" /> Offen für Kollabos</p>
            )}
          </div>
        </div>
        {(schools?.length || profile.links?.length) ? (
          <div className="relative px-6 md:px-10 pb-6 md:pb-8 flex flex-wrap items-center gap-2">
            {schools?.map((s) => <SchoolBadge key={s.id} school={s} />)}
            {profile.links?.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow"
                className="flex items-center gap-2 px-4 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 font-medium text-sm">
                {l.label || safeHost(l.url)} <ExternalLink className="w-3.5 h-3.5 text-white/60" />
              </a>
            ))}
          </div>
        ) : null}
      </section>

      {featured && (
        <section className="space-y-3">
          <p className="eyebrow flex items-center gap-2" style={{ color: accent }}><Star className="w-4 h-4" /> Featured</p>
          <Player embed={featured.embed} />
        </section>
      )}

      {profile.bio && (
        <section className="max-w-3xl">
          <p className="text-white/80 whitespace-pre-line leading-relaxed text-lg">{profile.bio}</p>
        </section>
      )}

      {rest.length > 0 && (
        <section className="space-y-3">
          <p className="eyebrow">Tracks & Videos</p>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
            {rest.map(({ url, embed }) => <MediaCard key={url} embed={embed} preview={previews[url]} accent={accent} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Link';
  }
}
