// Règle unique d'attribution d'une chaîne à une catégorie.
//
// Une catégorie est une liste de chaînes. Une même chaîne peut appartenir à
// plusieurs catégories : pour que les parts totalisent 100 %, une vidéo est
// rattachée à **la première catégorie de la liste** qui contient sa chaîne.
// C'est la règle appliquée en direct comme lors de l'import des anciennes
// statistiques.

export const UNCATEGORIZED_KEY = 'uncategorized';

export interface CategoryLike {
  id: string;
  name: string;
  channelIds?: string[];
}

export interface ResolvedCategory {
  id: string;
  name: string;
}

export function categoryForChannel(
  channelId: string | null | undefined,
  categories: readonly CategoryLike[] = [],
): ResolvedCategory | null {
  if (!channelId) return null;
  for (const category of categories) {
    if (Array.isArray(category.channelIds) && category.channelIds.includes(channelId)) {
      return { id: category.id, name: category.name };
    }
  }
  return null;
}

export function resolveVideoCategory(
  video: { channelId?: string } | null | undefined,
  categories: readonly CategoryLike[] = [],
): ResolvedCategory | null {
  return categoryForChannel(video?.channelId, categories);
}

/** Clé de stockage d'une catégorie (ou `uncategorized`). */
export function categoryKey(categoryId: string | null | undefined): string {
  return categoryId || UNCATEGORIZED_KEY;
}

export function isUncategorized(key: string | null | undefined): boolean {
  return !key || key === UNCATEGORIZED_KEY;
}
