
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { Toaster } from '@/components/ui/toaster';
import { PWARegistration } from '@/components/PWARegistration';

export const metadata: Metadata = {
  title: 'BeatHero | Rhythm Music Producer',
  description: 'A rhythm-based music learning game for kids learning music production.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BeatHero',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#FF3399',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body className="font-body antialiased bg-background text-foreground overflow-x-hidden">
        <FirebaseClientProvider>
          <PWARegistration />
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
