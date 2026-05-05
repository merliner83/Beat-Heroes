
/**
 * Basic Service Worker for BeatHero
 * Handles caching for offline access to key assets.
 */
const CACHE_NAME = 'beathero-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/globals.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
