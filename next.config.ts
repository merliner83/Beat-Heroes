
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  // Erlaubt parallele Dev-Server mit eigenem Build-Ordner (z.B. Claude-Vorschau).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // ESLint ist noch nicht eingerichtet (keine Konfiguration im Repo).
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
