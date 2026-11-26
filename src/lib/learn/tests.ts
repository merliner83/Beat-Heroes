/**
 * Prüfungen in Lektionen: Eine Übung, die mit «| pruefung» eingebunden ist
 * (`GAME: learnAppId | Beschriftung | pruefung`), läuft direkt in der Lektion
 * und muss mit mindestens TEST_PASS_SCORE % bestanden werden – zusätzlich
 * zum Quiz. Gilt im Browser und auf dem Server (Lernpfade).
 */
export const TEST_PASS_SCORE = 70;

const TEST_LINE_LABEL = /^GAME:\s*([^|\n]+?)\s*\|([^|\n]*)\|\s*pruefung\s*$/gim;

/** Prüfungen einer Lektion (learnApp-ID und Beschriftung), ohne Doppelte. */
export function lessonTests(content: string | undefined): { appId: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const m of (content ?? '').matchAll(TEST_LINE_LABEL)) if (!seen.has(m[1].trim())) seen.set(m[1].trim(), m[2].trim());
  return [...seen].map(([appId, label]) => ({ appId, label }));
}

/** learnApp-IDs aller Prüfungen einer Lektion. */
export function lessonTestIds(content: string | undefined): string[] {
  return lessonTests(content).map((t) => t.appId);
}

/** Bestwerte (learnAppId → %) erfüllen alle Prüfungen der Lektion? */
export function testsPassed(content: string | undefined, best: (appId: string) => number | undefined): boolean {
  return lessonTestIds(content).every((id) => (best(id) ?? 0) >= TEST_PASS_SCORE);
}
