// Estimation de la place nécessaire avant un téléchargement.
//
// Le flux RSS de YouTube ne fournit pas la durée : `durationSec` vaut donc
// souvent 0 et la taille annoncée par yt-dlp (`filesize_approx`) n'est connue
// qu'une fois l'extraction faite. On estime à partir de la durée quand elle est
// disponible, sinon on impose un plancher raisonnable.
//
// La fusion ffmpeg (`--merge-output-format mp4`) écrit le fichier final en plus
// des deux flux DASH déjà téléchargés : le pic d'occupation vaut donc environ
// deux fois la taille finale. D'où le facteur de marge.

/** Débits moyens observés sur YouTube, en bits par seconde. */
const BITS_PER_SECOND: Record<string, number> = {
  '360p': 700_000,
  '480p': 1_200_000,
  '720p': 2_500_000,
  '1080p': 4_500_000,
};

/** Marge de conteneur (en-têtes MP4, pistes séparées). */
const CONTAINER_OVERHEAD = 1.08;

/** Même sans durée connue, il faut de quoi écrire un fichier. */
export const MIN_FREE_BYTES = 500 * 1024 * 1024;

/** Flux DASH + fichier fusionné : pic ≈ 2× la taille finale. */
export const MERGE_HEADROOM = 2.2;

/** Taille estimée du fichier final, ou `null` si la durée est inconnue. */
export function estimateDownloadBytes(
  durationSec: number | null | undefined,
  quality: string | null | undefined,
): number | null {
  const duration = Number(durationSec);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const bits = BITS_PER_SECOND[quality ?? ''] ?? BITS_PER_SECOND['720p'];
  return Math.round(((duration * bits) / 8) * CONTAINER_OVERHEAD);
}

/** Espace libre minimal pour lancer le téléchargement. */
export function requiredFreeBytes(
  durationSec: number | null | undefined,
  quality: string | null | undefined,
): number {
  const estimate = estimateDownloadBytes(durationSec, quality);
  if (estimate == null) return MIN_FREE_BYTES;
  return Math.max(MIN_FREE_BYTES, Math.round(estimate * MERGE_HEADROOM));
}

/** `1,2 Go` / `820 Mo` : message technique lisible dans « Détails ». */
export function formatBytes(bytes: number): string {
  const value = Math.max(0, Number(bytes) || 0);
  const gigabytes = value / (1024 * 1024 * 1024);
  if (gigabytes >= 1) return `${gigabytes.toFixed(1).replace('.', ',')} Go`;
  const megabytes = Math.round(value / (1024 * 1024));
  return `${megabytes} Mo`;
}
