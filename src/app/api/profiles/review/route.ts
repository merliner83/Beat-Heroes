import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { HttpError, requireUid, STAFF_ROLES } from '@/lib/server/credits';

const HANDLE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const CONTENT_FIELDS = ['artistName', 'handle', 'bio', 'avatarUrl', 'roles', 'genres', 'embeds', 'links', 'openForCollab'] as const;

/**
 * Lehrperson gibt einen Profil-Entwurf frei (→ profiles/{uid} öffentlich)
 * oder verlangt Änderungen. Sorgt für eindeutige Handles (handles/{handle}).
 */
export async function POST(request: NextRequest) {
  try {
    const reviewerUid = await requireUid(request);
    const body = (await request.json().catch(() => ({}))) as { uid?: string; action?: 'approve' | 'changes_requested'; note?: string };
    const { uid, action } = body;
    if (!uid || uid.includes('/')) throw new HttpError(400, 'Invalid uid');
    if (action !== 'approve' && action !== 'changes_requested') throw new HttpError(400, 'Invalid action');
    const note = typeof body.note === 'string' ? body.note.slice(0, 1500) : '';

    const db = adminDb();
    await db.runTransaction(async (tx) => {
      const draftRef = db.doc(`profileDrafts/${uid}`);
      const profileRef = db.doc(`profiles/${uid}`);
      const [draftSnap, reviewerSnap, profileSnap] = await Promise.all([
        tx.get(draftRef), tx.get(db.doc(`users/${reviewerUid}`)), tx.get(profileRef),
      ]);
      if (!draftSnap.exists) throw new HttpError(404, 'Kein Entwurf vorhanden');
      const draft = draftSnap.data()!;
      const reviewer = reviewerSnap.data() ?? {};
      const allowed = reviewer.role === 'superAdmin'
        || (STAFF_ROLES.includes(reviewer.role) && reviewer.schoolId && reviewer.schoolId === draft.schoolId);
      if (!allowed) throw new HttpError(403, 'Not allowed');

      if (action === 'changes_requested') {
        tx.update(draftRef, { status: 'changes_requested', teacherNote: note, reviewedBy: reviewerUid, reviewedAt: FieldValue.serverTimestamp() });
        return;
      }

      const handle = String(draft.handle ?? '');
      if (!HANDLE.test(handle)) throw new HttpError(400, 'Ungültiger Profil-Link');
      const handleRef = db.doc(`handles/${handle}`);
      const handleSnap = await tx.get(handleRef);
      if (handleSnap.exists && handleSnap.get('uid') !== uid) {
        throw new HttpError(409, `Der Link /artists/${handle} ist schon vergeben`);
      }
      let schoolName: string | null = null;
      if (draft.schoolId) {
        const school = await tx.get(db.doc(`schools/${draft.schoolId}`));
        schoolName = school.get('name') ?? null;
      }

      const oldHandle = profileSnap.exists ? profileSnap.get('handle') : null;
      if (oldHandle && oldHandle !== handle) tx.delete(db.doc(`handles/${oldHandle}`));

      const content: Record<string, unknown> = {};
      for (const f of CONTENT_FIELDS) content[f] = draft[f] ?? null;
      tx.set(profileRef, {
        ...content,
        uid,
        schoolId: draft.schoolId ?? null,
        schoolName,
        searchName: String(draft.artistName ?? '').toLowerCase(),
        approvedBy: reviewerUid,
        approvedAt: FieldValue.serverTimestamp(),
      });
      tx.set(handleRef, { uid });
      tx.update(draftRef, { status: 'approved', teacherNote: note, reviewedBy: reviewerUid, reviewedAt: FieldValue.serverTimestamp() });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('profiles/review: unexpected error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
