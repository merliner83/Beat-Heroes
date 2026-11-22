import 'server-only';
import { getApps, initializeApp, applicationDefault, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';

/**
 * Admin SDK für API-Routen. Auf App Hosting kommen die Zugangsdaten
 * automatisch vom Dienstkonto, lokal über `gcloud auth application-default login`.
 */
function adminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.GOOGLE_CLOUD_PROJECT || firebaseConfig.projectId,
  });
}

export const adminAuth = () => getAuth(adminApp());
export const adminDb = () => getFirestore(adminApp());
