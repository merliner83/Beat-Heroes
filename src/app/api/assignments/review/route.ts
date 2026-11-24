import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { isStaffOf } from '@/lib/server/schools';
import { adminDb } from '@/lib/server/firebase-admin';
import { HttpError, requireUid, bookCredits } from '@/lib/server/credits';

/**
 * Lehrperson gibt eine Abgabe frei oder verlangt Änderungen. Bei der ersten
 * Freigabe werden die Credits der Aufgabe gutgeschrieben (nur einmal).
 */
export async function POST(request: NextRequest) {
  try {
    const reviewerUid = await requireUid(request);
    const body = (await request.json().catch(() => ({}))) as {
      assignmentId?: string;
      studentId?: string;
      status?: 'approved' | 'changes_requested';
      feedback?: string;
    };
    const { assignmentId, studentId, status } = body;
    if (!assignmentId || !studentId || assignmentId.includes('/') || studentId.includes('/')) {
      throw new HttpError(400, 'Invalid ids');
    }
    if (status !== 'approved' && status !== 'changes_requested') throw new HttpError(400, 'Invalid status');
    const feedback = typeof body.feedback === 'string' ? body.feedback.slice(0, 2000) : '';

    const db = adminDb();
    const result = await db.runTransaction(async (tx) => {
      const assignmentRef = db.doc(`assignments/${assignmentId}`);
      const submissionRef = assignmentRef.collection('submissions').doc(studentId);
      const studentRef = db.doc(`users/${studentId}`);
      const [assignmentSnap, submissionSnap, reviewerSnap, studentSnap] = await Promise.all([
        tx.get(assignmentRef),
        tx.get(submissionRef),
        tx.get(db.doc(`users/${reviewerUid}`)),
        tx.get(studentRef),
      ]);
      if (!assignmentSnap.exists) throw new HttpError(404, 'Assignment not found');
      if (!submissionSnap.exists) throw new HttpError(404, 'Submission not found');

      const assignment = assignmentSnap.data()!;
      const reviewer = reviewerSnap.data() ?? {};
      const allowed = isStaffOf(reviewer, [assignment.schoolId]);
      if (!allowed) throw new HttpError(403, 'Not allowed');

      const submission = submissionSnap.data()!;
      const update: Record<string, unknown> = {
        status,
        feedback,
        reviewedBy: reviewerUid,
        reviewedAt: FieldValue.serverTimestamp(),
      };

      let awarded = 0;
      if (status === 'approved' && !submission.creditedAt) {
        awarded = Math.max(0, Math.min(Number(assignment.credits) || 0, 5000));
        bookCredits(tx, studentId, studentSnap.data() ?? {}, awarded, {
          reason: 'assignment',
          refId: assignmentId,
          awardedBy: reviewerUid,
        });
        update.creditedAt = FieldValue.serverTimestamp();
        update.credits = awarded;
      }
      tx.set(submissionRef, update, { merge: true });
      return { awarded };
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('assignments/review: unexpected error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
