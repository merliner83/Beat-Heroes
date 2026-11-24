import 'server-only';
import { toEmbed, MediaPreview } from '@/lib/game/types';

const ENDPOINTS = {
  youtube: 'https://www.youtube.com/oembed?format=json&url=',
  spotify: 'https://open.spotify.com/oembed?url=',
  soundcloud: 'https://soundcloud.com/oembed?format=json&url=',
} as const;

/**
 * Titel und Vorschaubild eines Tracks/Videos über oEmbed (nur Spotify,
 * SoundCloud, YouTube). Ergebnisse werden einen Tag gecacht.
 */
export async function fetchPreview(url: string): Promise<MediaPreview | null> {
  const embed = toEmbed(url);
  if (!embed) return null;
  try {
    const res = await fetch(ENDPOINTS[embed.kind] + encodeURIComponent(url), {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { url, kind: embed.kind, title: null, author: null, thumbnail: null };
    const d = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
    return {
      url,
      kind: embed.kind,
      title: typeof d.title === 'string' ? d.title.slice(0, 200) : null,
      author: typeof d.author_name === 'string' ? d.author_name.slice(0, 120) : null,
      thumbnail: typeof d.thumbnail_url === 'string' && d.thumbnail_url.startsWith('https://') ? d.thumbnail_url : null,
    };
  } catch {
    return { url, kind: embed.kind, title: null, author: null, thumbnail: null };
  }
}

export async function fetchPreviews(urls: string[]): Promise<Record<string, MediaPreview>> {
  const list = await Promise.all(urls.slice(0, 12).map(fetchPreview));
  return Object.fromEntries(list.filter((p): p is MediaPreview => !!p).map((p) => [p.url, p]));
}
