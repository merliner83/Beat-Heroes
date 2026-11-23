import type { FirebaseApp } from 'firebase/app';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';

/** Lädt ein Bild hoch und gibt die öffentliche URL zurück. */
export async function uploadImage(app: FirebaseApp, path: string, file: File, maxMb = 5): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Nur Bilder');
  if (file.size > maxMb * 1024 * 1024) throw new Error(`Maximal ${maxMb} MB`);
  const r = ref(getStorage(app), path);
  await uploadBytes(r, file, { contentType: file.type });
  return getDownloadURL(r);
}
