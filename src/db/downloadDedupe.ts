// Déduplication des téléchargements d'une même vidéo pour une même catégorie.
//
// Avant l'index unique ajouté en version 2 de la base, un double tap pouvait
// créer deux lignes pour la même vidéo. Elles partageaient le même nom de
// fichier et se supprimaient mutuellement leurs fichiers `.part` (erreur
// « Unable to rename file »). Cette fonction pure choisit la ligne à conserver ;
// la migration supprime les autres.

export type DownloadDedupeRow = {
  id: string;
  videoId: string;
  categoryId: string;
  status: string;
  progress?: number | null;
  createdAt: number;
  filePath?: string | null;
};

const STATUS_RANK: Record<string, number> = {
  completed: 0,
  downloading: 1,
  queued: 2,
  failed: 3,
  canceled: 4,
};

function rank(status: string): number {
  return STATUS_RANK[status] ?? 5;
}

/**
 * On garde, dans l'ordre :
 *  1. le statut le plus avancé (terminé > en cours > en attente > échec) ;
 *  2. à statut égal, la ligne qui possède un fichier final ;
 *  3. la progression la plus élevée ;
 *  4. la plus récente.
 */
function isBetter(candidate: DownloadDedupeRow, current: DownloadDedupeRow): boolean {
  const candidateRank = rank(candidate.status);
  const currentRank = rank(current.status);
  if (candidateRank !== currentRank) return candidateRank < currentRank;

  const candidateHasFile = Boolean(candidate.filePath);
  const currentHasFile = Boolean(current.filePath);
  if (candidateHasFile !== currentHasFile) return candidateHasFile;

  const candidateProgress = Number(candidate.progress) || 0;
  const currentProgress = Number(current.progress) || 0;
  if (candidateProgress !== currentProgress) return candidateProgress > currentProgress;

  if (candidate.createdAt !== current.createdAt) {
    return candidate.createdAt > current.createdAt;
  }
  return candidate.id > current.id;
}

/** Identifiants des lignes en trop ; une seule est conservée par vidéo + catégorie. */
export function duplicateDownloadIds(rows: DownloadDedupeRow[]): string[] {
  const best = new Map<string, DownloadDedupeRow>();

  for (const row of rows) {
    const key = `${row.videoId}\u0000${row.categoryId}`;
    const current = best.get(key);
    if (!current || isBetter(row, current)) best.set(key, row);
  }

  const keep = new Set([...best.values()].map((row) => row.id));
  return rows.filter((row) => !keep.has(row.id)).map((row) => row.id);
}
