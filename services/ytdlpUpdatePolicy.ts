/** Politique de fréquence des mises à jour yt-dlp (pure, testable sans RN). */

/** Une vérification réussie par jour suffit : le canal stable ne sort pas plus vite. */
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Après un échec (hors ligne, GitHub indisponible), on retente une heure plus tard. */
export const UPDATE_RETRY_INTERVAL_MS = 60 * 60 * 1000;

/** `nextCheckAt` absent → jamais vérifié, il faut le faire tout de suite. */
export function shouldCheckForUpdate(
  nextCheckAt: number | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!nextCheckAt || !Number.isFinite(nextCheckAt)) return true;
  return now >= nextCheckAt;
}

export function nextCheckAtFor(
  outcome: 'ok' | 'failed',
  now: number = Date.now(),
): number {
  return now + (outcome === 'failed' ? UPDATE_RETRY_INTERVAL_MS : UPDATE_CHECK_INTERVAL_MS);
}
