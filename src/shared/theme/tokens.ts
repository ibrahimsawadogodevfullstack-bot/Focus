import { DARK_COLORS, LIGHT_COLORS, colors } from './colors';
export { DARK_COLORS, LIGHT_COLORS, colors };
export type { ThemeColors } from './colors';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

/**
 * Échelle typographique unique.
 * Tout `fontSize` de l'app doit venir d'ici : plus de valeurs en `.5`.
 */
export const fontSize = {
  /** Badges, durées, compteurs. */
  micro: 10,
  /** Légendes et aides. */
  caption: 11,
  /** Métadonnées. */
  meta: 12,
  /** Libellés et boutons secondaires. */
  label: 13,
  /** Texte courant. */
  body: 15,
  /** Titres de carte et d'entrée. */
  title: 17,
  /** Titres de pages de détail. */
  headline: 20,
  /** Titres d'onglets. */
  display: 26,
};

/** Styles prêts à l'emploi, sans couleur pour rester composables. */
export const type = {
  display: { fontSize: fontSize.display, lineHeight: 32, fontWeight: '800', letterSpacing: -0.8 },
  headline: { fontSize: fontSize.headline, lineHeight: 26, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: fontSize.title, lineHeight: 23, fontWeight: '700', letterSpacing: -0.3 },
  body: { fontSize: fontSize.body, lineHeight: 21, fontWeight: '500', letterSpacing: 0 },
  label: { fontSize: fontSize.label, lineHeight: 18, fontWeight: '600', letterSpacing: 0 },
  meta: { fontSize: fontSize.meta, lineHeight: 16, fontWeight: '500', letterSpacing: 0 },
  caption: { fontSize: fontSize.caption, lineHeight: 15, fontWeight: '600', letterSpacing: 0.1 },
  micro: { fontSize: fontSize.micro, lineHeight: 13, fontWeight: '600', letterSpacing: 0.1 },
} as const;

/** Échelle des icônes : une taille par rôle, pas une par dessin. */
export const icon = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export const layout = {
  gutter: 16,
  hit: 44,
  tabBar: 56,
  gridGutter: 12,
  gridGap: 12,
  twoColumnMinWidth: 720,
  threeColumnMinWidth: 1100,
  maxContentWidth: 1280,
};
