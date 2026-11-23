import { NextRequest, NextResponse } from 'next/server';
import { fetchPreview } from '@/lib/server/oembed';

/** Vorschau (Titel, Bild) für Spotify-/SoundCloud-/YouTube-Links. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url') ?? '';
  if (url.length > 500) return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  const preview = await fetchPreview(url);
  if (!preview) return NextResponse.json({ error: 'Nicht unterstützt' }, { status: 400 });
  return NextResponse.json(preview, { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } });
}
