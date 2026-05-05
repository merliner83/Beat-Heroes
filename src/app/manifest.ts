
import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BeatHero | Rhythm Music Producer',
    short_name: 'BeatHero',
    description: 'A rhythm-based music learning game for kids learning music production.',
    start_url: '/',
    display: 'standalone',
    background_color: '#050505',
    theme_color: '#FF3399',
    icons: [
      {
        src: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2FGabriel%20Studio.png?alt=media&token=2f1e1b66-7f23-461b-9377-f738ea0ce79f',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2FGabriel%20Studio.png?alt=media&token=2f1e1b66-7f23-461b-9377-f738ea0ce79f',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
