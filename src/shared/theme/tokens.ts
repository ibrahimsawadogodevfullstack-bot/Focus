// Système visuel « focus » — bleu optique sur scène nuit.
//
// Une seule couleur d'accent (azure), des surfaces bleu-nuit, et des filets
// fins pour structurer l'information. Aucune couleur littérale dans les écrans.

export const DARK_COLORS = {
  // Scène
  bg: '#05070E',
  surface: '#0A1120',
  surfaceAlt: '#0F1829',
  raised: '#142034',

  // Filets
  line: '#1A2740',
  lineStrong: '#26375A',

  // Texte
  text: '#E9F1FF',
  textMuted: '#9AAECF',
  textFaint: '#7186A8',

  // Accent
  accent: '#2F7BFF',
  accentText: '#7FAFFF',
  accentSoft: 'rgba(47, 123, 255, 0.14)',
  accentLine: 'rgba(47, 123, 255, 0.32)',
  onAccent: '#FFFFFF',

  // Sémantique
  danger: '#FF7A8F',
  dangerSoft: 'rgba(255, 122, 143, 0.12)',
  success: '#5BD99B',
  successSoft: 'rgba(91, 217, 155, 0.13)',
  warn: '#FFC46B',
  warnSoft: 'rgba(255, 196, 107, 0.13)',
};

export const LIGHT_COLORS = {
  bg: '#F5F7FB',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2F7',
  raised: '#E3E9F2',

  line: '#CFD8E6',
  lineStrong: '#AEBBD0',

  text: '#182230',
  textMuted: '#435066',
  textFaint: '#56647A',

  accent: '#175CD3',
  accentText: '#164A9C',
  accentSoft: '#E8F0FE',
  accentLine: '#B6CCF7',
  onAccent: '#FFFFFF',

  danger: '#B4233C',
  dangerSoft: '#FCE8EB',
  success: '#067647',
  successSoft: '#D1FADF',
  warn: '#875300',
  warnSoft: '#FEF0C7',
};

// Alias conservé pour les composants non interactifs avec le thème.
export const colors = DARK_COLORS;

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
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

// Échelle typographique : 11 / 12 / 13 / 15 / 17 / 22 / 32.
export const type = {
  display: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1.1,
    color: colors.text,
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: colors.text,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: colors.text,
  },
  body: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  meta: {
    fontSize: 12.5,
    fontWeight: '500',
    color: colors.textMuted,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
};

export const layout = {
  gutter: 16,
  hit: 44,
  tabBar: 56,

  // Grille mobile-first : un écran portrait reste une colonne, le desktop garde
  // la marge de contenu centrée seulement au-delà des plus grands écrans.
  gridGutter: 12,
  gridGap: 12,
  twoColumnMinWidth: 720,
  threeColumnMinWidth: 1100,
  maxContentWidth: 1280,
};

export type ThemeColors = typeof DARK_COLORS;
