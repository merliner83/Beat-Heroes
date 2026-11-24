import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { schoolsOf } from '@/lib/game/types';
import { adminDb } from '@/lib/server/firebase-admin';
import { HttpError, requireUid, bookCredits } from '@/lib/server/credits';

/**
 * Prüft, ob alle Pflicht-Lektionen eines Lernpfads bestanden sind, und
 * vermerkt den Abschluss in achievements/{uid}_{pathId}. Nur der Server
 * schreibt diese Dokumente; sie gelten damit als offizieller Nachweis.
 */
export async function POST(request: NextRequest) {
  try {
    const uid = await requireUid(request);
    const body = (await request.json().catch(() => ({}))) as { pathId?: string };
    const pathId = body.pathId;
    if (!pathId || pathId.includes('/')) throw new HttpError(400, 'Invalid pathId');

    const db = adminDb();
    const pathSnap = await db.doc(`learningPaths/${pathId}`).get();
    if (!pathSnap.exists || pathSnap.get('published') === false) throw new HttpError(404, 'Lernpfad nicht gefunden');
    const path = pathSnap.data()!;
    const required: string[] = path.requiredLessonIds ?? [];
    const minScore: number = path.minScore ?? 80;
    if (required.length === 0) throw new HttpError(400, 'Lernpfad hat keine Lektionen');

    const progressRefs = required.map((id) => db.doc(`users/${uid}/articleProgress/${id}`));
    const progress = await db.getAll(...progressRefs);
    const missing = progress
      .map((p, i) => ({ id: required[i], ok: p.exists && p.get('completed') === true && (p.get('quizScore') ?? 0) >= minScore }))
      .filter((x) => !x.ok)
      .map((x) => x.id);
    if (missing.length > 0) {
      return NextResponse.json({ error: 'Noch nicht alle Lektionen bestanden', missing }, { status: 409 });
    }

    const achievementRef = db.doc(`achievements/${uid}_${pathId}`);
    const result = await db.runTransaction(async (tx) => {
      const [existing, userSnap] = await Promise.all([tx.get(achievementRef), tx.get(db.doc(`users/${uid}`))]);
      if (existing.exists) return { alreadyAchieved: true, awarded: 0 };
      const user = userSnap.data() ?? {};
      tx.create(achievementRef, {
        uid,
        pathId,
        pathTitle: path.title ?? pathId,
        official: !!path.official,
        displayName: user.displayName ?? 'Producer',
        schoolIds: schoolsOf(user),
        schoolId: user.schoolId ?? null,
        classIds: user.classIds ?? [],
        achievedAt: FieldValue.serverTimestamp(),
      });
      const awarded = Math.max(0, Math.min(Number(path.credits) || 0, 10000));
      bookCredits(tx, uid, user, awarded, { reason: 'path', refId: pathId, awardedBy: 'system' });
      return { alreadyAchieved: false, awarded };
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('paths/claim: unexpected error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
