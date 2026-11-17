// Ordre alphabétique des chaînes suivies.
//
// Les titres viennent de sources différentes (import d'URL, flux RSS, chaînes
// fournies au premier lancement) : accents, majuscules et espaces varient.
// On compare donc sur une forme normalisée, comme le fait déjà la recherche du
// flux, pour que « Élise » et « Elise » voisinent au lieu de se retrouver aux
// deux extrémités de la liste.
//
// Les chaînes sans titre connu passent en fin de liste : leur titre provisoire
// est remplacé dès que le flux répond, et les intercaler au hasard ferait
// sauter des lignes à chaque rafraîchissement.

export type SortableChannel = { id: string; title?: string | null };

/** Minuscules, sans accents ni espaces superflus. */
export function normalizeChannelTitle(value: string | null | undefined): string {
  return (value ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Comparateur : titre alphabétique (insensible à la casse et aux accents),
 * puis identifiant pour garder un ordre stable entre deux titres identiques.
 */
export function compareChannels(a: SortableChannel, b: SortableChannel): number {
  const titleA = normalizeChannelTitle(a.title);
  const titleB = normalizeChannelTitle(b.title);
  if (!titleA && !titleB) return a.id.localeCompare(b.id);
  if (!titleA) return 1;
  if (!titleB) return -1;
  return (
    titleA.localeCompare(titleB, 'fr', { numeric: true, sensitivity: 'base' }) ||
    a.id.localeCompare(b.id)
  );
}

/** Copie triée : l'ordre de la liste d'origine n'est jamais modifié. */
export function sortChannelsByTitle<T extends SortableChannel>(
  channels: readonly T[],
): T[] {
  return [...channels].sort(compareChannels);
}
