import 'server-only';
import { DocumentData } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { schoolsOf, School } from '@/lib/game/types';

export { schoolsOf };

/** Darf `reviewer` (Personendaten) für die Schule `schoolId` handeln? */
export function isStaffOf(reviewer: DocumentData, schoolIds: string[]): boolean {
  if (reviewer.role === 'superAdmin') return true;
  if (!['teacher', 'schoolAdmin'].includes(reviewer.role)) return false;
  const mine = schoolsOf(reviewer);
  return schoolIds.some((s) => mine.includes(s));
}

/**
 * Überträgt die Schulen einer Person auf alle Dokumente, die danach filtern
 * (Rangliste, Profil, Entwurf, Abschlüsse). Nur ausserhalb von Transaktionen.
 */
export async function syncSchoolIds(uid: string, schoolIds: string[]) {
  const db = adminDb();
  const batch = db.batch();
  const primary = schoolIds[0] ?? null;
  batch.set(db.doc(`users/${uid}`), { schoolIds, schoolId: primary }, { merge: true });
  const [standing, profile, draft, achievements] = await Promise.all([
    db.doc(`standings/${uid}`).get(),
    db.doc(`profiles/${uid}`).get(),
    db.doc(`profileDrafts/${uid}`).get(),
    db.collection('achievements').where('uid', '==', uid).get(),
  ]);
  if (standing.exists) batch.update(standing.ref, { schoolIds, schoolId: primary });
  if (profile.exists) batch.update(profile.ref, { schoolIds, schoolId: primary });
  if (draft.exists) batch.update(draft.ref, { schoolIds, schoolId: primary });
  achievements.docs.forEach((a) => batch.update(a.ref, { schoolIds, schoolId: primary }));
  await batch.commit();
}

/** Lädt Schulen (öffentliche Felder) als serialisierbare Objekte. */
export async function loadSchools(ids?: string[]): Promise<School[]> {
  const db = adminDb();
  const snaps = ids
    ? (ids.length ? await db.getAll(...ids.map((id) => db.doc(`schools/${id}`))) : [])
    : (await db.collection('schools').get()).docs;
  return snaps.filter((s) => s.exists).map((s) => {
    const d = s.data()!;
    return {
      id: s.id,
      name: d.name ?? s.id,
      slug: d.slug ?? s.id,
      logoUrl: d.logoUrl ?? null,
      bannerUrl: d.bannerUrl ?? null,
      description: d.description ?? '',
      website: d.website ?? '',
      location: d.location ?? '',
      accentColor: d.accentColor ?? null,
    };
  });
}
