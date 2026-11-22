import { NextRequest, NextResponse } from 'next/server';

/**
 * Audio-Proxy, um CORS-Sperren bei Audio-Dateien zu umgehen.
 *
 * Sicherheit: Es werden nur HTTPS-URLs von erlaubten Hosts weitergereicht,
 * damit der Endpunkt nicht als offener Proxy missbraucht werden kann.
 * Zusätzliche Hosts können über die Umgebungsvariable
 * AUDIO_PROXY_ALLOWED_HOSTS (kommagetrennt) freigegeben werden.
 */

const FIREBASE_BUCKET = 'studio-7081808686-cc62f.firebasestorage.app';

const DEFAULT_ALLOWED_HOSTS = [
  'firebasestorage.googleapis.com', // Firebase Storage (nur eigener Bucket, siehe unten)
  'actions.google.com',             // Metronom- und Demo-Sounds
];

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

function allowedHosts(): Set<string> {
  const extra = (process.env.AUDIO_PROXY_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_HOSTS, ...extra]);
}

function isAllowed(target: URL): boolean {
  if (target.protocol !== 'https:') return false;
  const host = target.hostname.toLowerCase();
  if (!allowedHosts().has(host)) return false;

  // Bei Firebase Storage nur Dateien aus dem eigenen Bucket zulassen.
  if (host === 'firebasestorage.googleapis.com') {
    return target.pathname.startsWith(`/v0/b/${FIREBASE_BUCKET}/`);
  }
  return true;
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url');
  if (!raw) {
    return new NextResponse('Missing URL parameter', { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new NextResponse('Invalid URL', { status: 400 });
  }

  if (!isAllowed(target)) {
    return new NextResponse('URL not allowed', { status: 403 });
  }

  try {
    const response = await fetch(target, {
      method: 'GET',
      redirect: 'error', // keine Weiterleitungen auf fremde Hosts
      headers: { 'User-Agent': 'BeatHeroes-AudioProxy/1.0' },
      referrerPolicy: 'no-referrer',
    });

    if (!response.ok) {
      return new NextResponse(`Upstream error ${response.status}`, { status: 502 });
    }

    const contentType = response.headers.get('Content-Type') || 'audio/mpeg';
    if (!/^(audio\/|application\/octet-stream|video\/ogg)/i.test(contentType)) {
      return new NextResponse('Unsupported content type', { status: 415 });
    }

    const declaredLength = Number(response.headers.get('Content-Length') || 0);
    if (declaredLength > MAX_BYTES) {
      return new NextResponse('File too large', { status: 413 });
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) {
      return new NextResponse('File too large', { status: 413 });
    }

    // Browser-Caching: 1 Stunde, danach im Hintergrund aktualisieren
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
        'Vary': 'Origin',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Audio Proxy Error:', message);
    return new NextResponse('Audio Proxy Error', { status: 500 });
  }
}
