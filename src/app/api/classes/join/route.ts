import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { HttpError, requireUid } from '@/lib/server/credits';

/**
 * Tritt mit einem Beitrittscode einer Klasse bei. Setzt schoolId und
 * classIds serverseitig, weil Schüler:innen diese Felder nicht selbst
 * schreiben dürfen.
 */
export async function POST(request: NextRequest) {
  try {
    const uid = await requireUid(request);
    const body = (await request.json().catch(() => ({}))) as { code?: string };
    const code = (body.code ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4,10}$/.test(code)) throw new HttpError(400, 'Ungültiger Code');

    const db = adminDb();
    const match = await db.collection('classes').where('joinCode', '==', code).limit(1).get();
    if (match.empty) throw new HttpError(404, 'Code nicht gefunden');
    const classDoc = match.docs[0];
    const schoolId: string = classDoc.get('schoolId');

    const result = await db.runTransaction(async (tx) => {
      const userRef = db.doc(`users/${uid}`);
      const user = (await tx.get(userRef)).data() ?? {};
      if (user.schoolId && user.schoolId !== schoolId) {
        throw new HttpError(409, 'Du gehörst bereits zu einer anderen Schule');
      }
      const classIds: string[] = user.classIds ?? [];
      if (classIds.includes(classDoc.id)) return { alreadyMember: true };

      tx.set(userRef, { schoolId, classIds: FieldValue.arrayUnion(classDoc.id) }, { merge: true });
      tx.set(
        db.doc(`standings/${uid}`),
        {
          uid,
          displayName: user.displayName ?? 'Producer',
          schoolId,
          classIds: FieldValue.arrayUnion(classDoc.id),
          streetCred: user.streetCred ?? 0,
        },
        { merge: true },
      );
      return { alreadyMember: false };
    });

    return NextResponse.json({ ...result, classId: classDoc.id, className: classDoc.get('name'), schoolId });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('classes/join: unexpected error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
