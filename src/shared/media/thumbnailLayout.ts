// Logique pure du cadre de vignette, séparée du composant pour être testable
// sans React Native.
//
// Un Short est une vidéo verticale : son cadre fait 9:16. Si la source est un
// 16:9 généré par YouTube (Short au centre, côtés agrandis et flous), `cover`
// dans un cadre 9:16 ne garde que (9/16) / (16/9) ≈ 31,6 % de la largeur : la
// vraie vidéo. Les sources déjà verticales (`oardefault`, 1080×1920) restent
// entières. Aucun zoom additionnel n'est appliqué : il agrandirait inutilement
// la bande visible et accentuerait le flou des sources de résolution limitée.

export const VIDEO_ASPECT = 16 / 9;
export const SHORT_ASPECT = 9 / 16;

/** Tolérance autour de 9:16 : 0,5625 est le ratio exact d'un Short. */
export const VERTICAL_RATIO_TOLERANCE = 0.62;

export function thumbnailRatio(format: string) {
  return format === 'short' ? SHORT_ASPECT : VIDEO_ASPECT;
}

/**
 * Fraction de la largeur source réellement visible dans le cadre, avec
 * `resizeMode="cover"`. Pour un Short 16:9 dans un cadre 9:16 : ≈ 0,3164.
 */
export function visibleSourceWidthFraction(
  format: string,
  sourceRatio: number | null | undefined,
) {
  const target = thumbnailRatio(format);
  const ratio = Number(sourceRatio);
  if (!Number.isFinite(ratio) || ratio <= 0) return 1;
  return Math.min(1, target / ratio);
}

/** Vrai si la source est déjà verticale (ou presque). */
export function isVerticalSource(sourceRatio: number | null | undefined) {
  const ratio = Number(sourceRatio);
  return Number.isFinite(ratio) && ratio > 0 && ratio <= VERTICAL_RATIO_TOLERANCE;
}

/** Pas de zoom logiciel : `cover` suffit au recadrage et évite un flou ajouté. */
export function cropZoomFor(format: string, sourceRatio: number | null | undefined) {
  return 1;
}
