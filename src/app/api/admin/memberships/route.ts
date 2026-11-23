import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebase-admin';
import { HttpError, requireUid } from '@/lib/server/credits';
import { syncSchoolIds } from '@/lib/server/schools';

/**
 * Super-Admin setzt die Schulen einer Person (mehrere möglich). Überträgt
 * sie auf Rangliste, Profil, Entwurf und Abschlüsse.
 */
export async function POST(request: NextRequest) {
  try {
    const adminUid = await requireUid(request);
    const db = adminDb();
    const admin = (await db.doc(`users/${adminUid}`).get()).data() ?? {};
    if (admin.role !== 'superAdmin') throw new HttpError(403, 'Not allowed');

    const body = (await request.json().catch(() => ({}))) as { uid?: string; schoolIds?: unknown };
    const uid = body.uid;
    if (!uid || typeof uid !== 'string' || uid.includes('/')) throw new HttpError(400, 'Invalid uid');
    if (!Array.isArray(body.schoolIds) || body.schoolIds.length > 10) throw new HttpError(400, 'Invalid schoolIds');
    const schoolIds = [...new Set(body.schoolIds.filter((s): s is string => typeof s === 'string' && /^[a-z0-9-]{1,40}$/.test(s)))];

    const [user, ...schools] = await Promise.all([
      db.doc(`users/${uid}`).get(),
      ...schoolIds.map((s) => db.doc(`schools/${s}`).get()),
    ]);
    if (!user.exists) throw new HttpError(404, 'Person nicht gefunden');
    if (schools.some((s) => !s.exists)) throw new HttpError(400, 'Unbekannte Schule');

    await syncSchoolIds(uid, schoolIds);
    return NextResponse.json({ ok: true, schoolIds });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('admin/memberships: unexpected error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
