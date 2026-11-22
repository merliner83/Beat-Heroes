import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, DocumentReference } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/server/firebase-admin';
import type { CreditKind } from '@/lib/credits';

/**
 * Vergibt Credits (streetCred) für Spiel-, Lern-App- und Quiz-Resultate.
 *
 * Der Browser meldet nur das Resultat. Der Server liest maxPoints aus dem
 * Inhalt, zählt nur die Verbesserung gegenüber dem bisherigen Bestwert und
 * wertet Quizzes selbst. Pro Inhalt sind so höchstens maxPoints Credits
 * holbar, egal was der Client schickt.
 */

const DEFAULT_MAX: Record<CreditKind, number> = {
  level: 500,
  learnApp: 1000,
  pattern: 500,
  article: 250,
};

type Body = {
  kind?: CreditKind;
  refId?: string;
  accuracy?: number;
  answers?: (number | null)[];
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function resolveTarget(uid: string, body: Body) {
  const db = adminDb();
  const { kind, refId } = body;
  if (!kind || !(kind in DEFAULT_MAX)) throw new HttpError(400, 'Unknown kind');
  if (!refId || typeof refId !== 'string' || refId.includes('/')) throw new HttpError(400, 'Invalid refId');

  const userRef = db.doc(`users/${uid}`);

  if (kind === 'article') {
    const article = await db.doc(`articles/${refId}`).get();
    if (!article.exists) throw new HttpError(404, 'Article not found');
    const answers = Array.isArray(body.answers) ? body.answers : [];
    const key = await db.doc(`learnQuizKeys/${refId}`).get();
    let correctAnswers: number[] | undefined = key.exists ? key.data()?.answers : undefined;
    if (!correctAnswers) {
      const quiz = await db.doc(`learnQuizzes/${refId}`).get();
      correctAnswers = (quiz.data()?.questions ?? []).map((q: { correctOption?: number }) => q.correctOption);
    }
    if (!correctAnswers || correctAnswers.length === 0) throw new HttpError(404, 'Quiz not found');
    const correct = correctAnswers.filter((c, i) => answers[i] === c).length;
    const score = Math.round((correct / correctAnswers.length) * 100);
    return {
      score,
      maxPoints: article.data()?.maxPoints ?? DEFAULT_MAX.article,
      progressRef: userRef.collection('articleProgress').doc(refId),
      field: 'quizScore',
      progressData: { articleId: refId, completed: true },
    };
  }

  const accuracy = body.accuracy;
  if (typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) {
    throw new HttpError(400, 'Invalid accuracy');
  }
  const score = Math.round(accuracy);

  if (kind === 'level') {
    const level = await db.doc(`levels/${refId}`).get();
    if (!level.exists) throw new HttpError(404, 'Level not found');
    const gameId = level.data()?.gameId;
    const game = gameId ? await db.doc(`games/${gameId}`).get() : null;
    return {
      score,
      maxPoints: game?.data()?.maxPoints ?? DEFAULT_MAX.level,
      progressRef: userRef.collection('progress').doc(refId),
      field: 'accuracy',
      progressData: { levelId: refId },
    };
  }

  if (kind === 'learnApp') {
    const app = await db.doc(`learnApps/${refId}`).get();
    if (!app.exists) throw new HttpError(404, 'Learn app not found');
    return {
      score,
      maxPoints: app.data()?.maxPoints ?? DEFAULT_MAX.learnApp,
      progressRef: userRef.collection('progress').doc(refId),
      field: 'accuracy',
      progressData: { levelId: refId },
    };
  }

  // pattern
  const pattern = await db.doc(`patterns/${refId}`).get();
  if (!pattern.exists) throw new HttpError(404, 'Pattern not found');
  return {
    score,
    maxPoints: pattern.data()?.maxPoints ?? DEFAULT_MAX.pattern,
    progressRef: userRef.collection('patternProgress').doc(refId),
    field: 'accuracy',
    progressData: { patternId: refId },
  };
}

export async function POST(request: NextRequest) {
  try {
    const header = request.headers.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new HttpError(401, 'Missing token');

    let uid: string;
    try {
      const decoded = await adminAuth().verifyIdToken(token);
      if (decoded.firebase?.sign_in_provider === 'anonymous') throw new Error('anonymous');
      uid = decoded.uid;
    } catch {
      throw new HttpError(401, 'Invalid token');
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const target = await resolveTarget(uid, body);
    const db = adminDb();
    const userRef = db.doc(`users/${uid}`);
    const standingRef = db.doc(`standings/${uid}`);

    const result = await db.runTransaction(async (tx) => {
      const [progressSnap, userSnap] = await Promise.all([
        tx.get(target.progressRef as DocumentReference),
        tx.get(userRef),
      ]);
      const oldScore: number = progressSnap.exists ? progressSnap.get(target.field) ?? 0 : 0;
      if (target.score <= oldScore) {
        return { awarded: 0, score: target.score, best: oldScore };
      }

      const awarded = Math.round(((target.score - oldScore) / 100) * target.maxPoints);
      const user = userSnap.data() ?? {};

      tx.set(
        target.progressRef,
        { ...target.progressData, [target.field]: target.score, completedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );

      if (awarded > 0) {
        tx.set(userRef, { streetCred: FieldValue.increment(awarded) }, { merge: true });
        tx.set(
          standingRef,
          {
            uid,
            displayName: user.displayName ?? 'Producer',
            schoolId: user.schoolId ?? null,
            classIds: user.classIds ?? [],
            streetCred: FieldValue.increment(awarded),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        tx.create(db.collection('creditEvents').doc(), {
          uid,
          schoolId: user.schoolId ?? null,
          amount: awarded,
          reason: body.kind,
          refId: body.refId,
          score: target.score,
          createdAt: FieldValue.serverTimestamp(),
          awardedBy: 'system',
        });
      }
      return { awarded, score: target.score, best: target.score };
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('credits: unexpected error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
