
import { NextRequest, NextResponse } from 'next/server';

/**
 * Ein einfacher Proxy, um CORS-Sperren bei Audio-Dateien zu umgehen.
 * Er lädt die Datei serverseitig und gibt sie mit den richtigen Headern an den Client zurück.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing URL parameter', { status: 400 });
  }

  try {
    // Die Datei vom externen Server laden (ohne Browser-CORS-Beschränkung)
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('Content-Type') || 'audio/mpeg';
    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*', // Erlaubt den Zugriff innerhalb der App
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('Audio Proxy Error:', error);
    return new NextResponse(`Audio Proxy Error: ${error.message}`, { status: 500 });
  }
}
