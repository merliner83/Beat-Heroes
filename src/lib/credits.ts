import type { User } from 'firebase/auth';

export type CreditKind = 'level' | 'learnApp' | 'pattern' | 'article';

export type CreditResult = { awarded: number; score: number; best: number };

/**
 * Meldet ein Resultat an den Server, der Fortschritt speichert und Credits
 * vergibt (siehe src/app/api/credits/route.ts).
 */
export async function submitResult(
  user: User,
  payload: { kind: CreditKind; refId: string; accuracy?: number; answers?: (number | null)[] },
): Promise<CreditResult | null> {
  try {
    const token = await user.getIdToken();
    const res = await fetch('/api/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn('submitResult failed', res.status, await res.text());
      return null;
    }
    return (await res.json()) as CreditResult;
  } catch (err) {
    console.warn('submitResult failed', err);
    return null;
  }
}
