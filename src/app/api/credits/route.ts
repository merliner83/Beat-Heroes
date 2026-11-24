import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, DocumentReference } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { HttpError, requireUid, bookCredits } from '@/lib/server/credits';
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

/**
 * Wahlkapitel (z.B. DAWs): Die Unterthemen sind Alternativen. Im ganzen
 * Kapitel gibt es höchstens so viele Credits wie im grössten Unterthema –
 * wer das DAW wechselt, sammelt also nicht doppelt. Gibt die noch holbaren
 * Credits zurück, oder undefined für normale Kapitel.
 */
async function choiceChapterRemaining(
  userRef: DocumentReference,
  article: { courseId?: string; chapterId?: string; categoryId?: string; subCategoryId?: string },
): Promise<number | undefined> {
  const chapterId = article.chapterId ?? article.categoryId;
  if (!chapterId || !article.subCategoryId) return undefined;
  const db = adminDb();
  const course = await db.doc(`courses/${article.courseId ?? 'producing'}`).get();
  const chapter = (course.data()?.chapters ?? []).find((c: { id: string }) => c.id === chapterId);
  if (!chapter?.choice) return undefined;

  const subCats = await db.collection('learnSubCats').where('categoryId', '==', chapterId).get();
  const optionIds = new Set(subCats.docs.map((d) => d.id));
  const all = await db.collection('articles').get();
  const lessons = all.docs
    .map((d) => ({ id: d.id, ...(d.data() as { chapterId?: string; categoryId?: string; subCategoryId?: string; maxPoints?: number }) }))
    .filter((a) => (a.chapterId ?? a.categoryId) === chapterId && a.subCategoryId && optionIds.has(a.subCategoryId));

  const perOption = new Map<string, number>();
  for (const l of lessons) perOption.set(l.subCategoryId!, (perOption.get(l.subCategoryId!) ?? 0) + (l.maxPoints ?? DEFAULT_MAX.article));
  const cap = Math.max(0, ...perOption.values());

  const progress = lessons.length ? await db.getAll(...lessons.map((l) => userRef.collection('articleProgress').doc(l.id))) : [];
  const earned = progress.reduce((sum, snap, i) => {
    const score = snap.exists ? Number(snap.get('quizScore') ?? 0) : 0;
    return sum + Math.round((score / 100) * (lessons[i].maxPoints ?? DEFAULT_MAX.article));
  }, 0);
  return Math.max(0, cap - earned);
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
    if (!String(article.data()?.content ?? '').trim()) throw new HttpError(400, 'Lektion hat noch keinen Inhalt');
    const answers = Array.isArray(body.answers) ? body.answers : [];
    const key = await db.doc(`learnQuizKeys/${refId}`).get();
    let correctAnswers: number[] | undefined = key.exists ? key.data()?.answers : undefined;
    if (!correctAnswers) {
      const quiz = await db.doc(`learnQuizzes/${refId}`).get();
      correctAnswers = (quiz.data()?.questions ?? []).map((q: { correctOption?: number }) => q.correctOption);
    }
    // Lektion ohne Quiz: «gelesen» zählt als abgeschlossen (100).
    let score = 100;
    if (correctAnswers && correctAnswers.length > 0) {
      const correct = correctAnswers.filter((c, i) => answers[i] === c).length;
      score = Math.round((correct / correctAnswers.length) * 100);
    }
    return {
      score,
      maxPoints: article.data()?.maxPoints ?? DEFAULT_MAX.article,
      creditCap: await choiceChapterRemaining(userRef, article.data() ?? {}),
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
    const uid = await requireUid(request);

    const body = (await request.json().catch(() => ({}))) as Body;
    const target = await resolveTarget(uid, body);
    const db = adminDb();
    const userRef = db.doc(`users/${uid}`);

    const result = await db.runTransaction(async (tx) => {
      const [progressSnap, userSnap] = await Promise.all([
        tx.get(target.progressRef as DocumentReference),
        tx.get(userRef),
      ]);
      const oldScore: number = progressSnap.exists ? progressSnap.get(target.field) ?? 0 : 0;
      if (target.score <= oldScore) {
        return { awarded: 0, score: target.score, best: oldScore };
      }

      const cap = 'creditCap' in target && target.creditCap !== undefined ? target.creditCap : Infinity;
      const awarded = Math.min(cap, Math.round(((target.score - oldScore) / 100) * target.maxPoints));
      const user = userSnap.data() ?? {};

      tx.set(
        target.progressRef,
        { ...target.progressData, [target.field]: target.score, completedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );

      bookCredits(tx, uid, user, awarded, {
        reason: body.kind as string,
        refId: body.refId as string,
        score: target.score,
        awardedBy: 'system',
      });
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
