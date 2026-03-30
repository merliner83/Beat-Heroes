
import { NextRequest, NextResponse } from 'next/server';

/**
 * Ein verbesserter Proxy, um CORS-Sperren bei Audio-Dateien zu umgehen.
 * Er lädt die Datei serverseitig mit neutralen Headern und gibt sie an den Client weiter.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing URL parameter', { status: 400 });
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      referrerPolicy: 'no-referrer',
    });

    if (!response.ok) {
      throw new Error(`External source returned ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('Content-Type') || 'audio/mpeg';
    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('Audio Proxy Error:', error.message);
    return new NextResponse(`Audio Proxy Error: ${error.message}`, { status: 500 });
  }
}
