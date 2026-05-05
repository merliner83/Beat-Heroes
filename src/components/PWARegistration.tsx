
'use client';

import { useEffect } from 'react';

/**
 * PWARegistration registers the service worker if supported by the browser.
 * This component should be included in the root layout.
 */
export function PWARegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
          (registration) => {
            // Registration was successful
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
          },
          (err) => {
            // registration failed :(
            console.log('ServiceWorker registration failed: ', err);
          }
        );
      });
    }
  }, []);

  return null;
}
