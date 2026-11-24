import 'server-only';
import { FieldValue, Transaction, DocumentData } from 'firebase-admin/firestore';
import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/server/firebase-admin';
import { schoolsOf } from '@/lib/game/types';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Prüft das ID-Token aus dem Authorization-Header; anonyme Konten zählen nicht. */
export async function requireUid(request: NextRequest): Promise<string> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Missing token');
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    if (decoded.firebase?.sign_in_provider === 'anonymous') throw new Error('anonymous');
    return decoded.uid;
  } catch {
    throw new HttpError(401, 'Invalid token');
  }
}

/**
 * Bucht Credits innerhalb einer Transaktion: users.streetCred, standings und
 * ein Eintrag in creditEvents. `user` sind die bereits gelesenen Profildaten.
 */
export function bookCredits(
  tx: Transaction,
  uid: string,
  user: DocumentData,
  amount: number,
  entry: { reason: string; refId: string; score?: number; awardedBy: string },
) {
  if (amount <= 0) return;
  const db = adminDb();
  tx.set(db.doc(`users/${uid}`), { streetCred: FieldValue.increment(amount) }, { merge: true });
  tx.set(
    db.doc(`standings/${uid}`),
    {
      uid,
      displayName: user.displayName ?? 'Producer',
      schoolIds: schoolsOf(user),
      schoolId: user.schoolId ?? null,
      classIds: user.classIds ?? [],
      streetCred: FieldValue.increment(amount),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  tx.create(db.collection('creditEvents').doc(), {
    uid,
    schoolIds: schoolsOf(user),
    schoolId: user.schoolId ?? null,
    amount,
    reason: entry.reason,
    refId: entry.refId,
    score: entry.score ?? null,
    createdAt: FieldValue.serverTimestamp(),
    awardedBy: entry.awardedBy,
  });
}

export const STAFF_ROLES = ['teacher', 'schoolAdmin', 'superAdmin'];
