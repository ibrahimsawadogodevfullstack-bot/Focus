// Système visuel « focus » : scène sombre, texte ivoire, un seul accent rouge.
// Tout écran doit passer par ces jetons, jamais par une couleur littérale.

export const colors = {
  background: '#07080A',
  surface: '#101217',
  surfaceAlt: '#171A21',
  elevated: '#1C2028',
  border: '#232830',
  borderStrong: '#333A46',

  text: '#F4F1EA',
  textMuted: '#99A1AD',
  textFaint: '#646C78',

  accent: '#FF4438',
  accentSoft: 'rgba(255, 68, 56, 0.14)',
  onAccent: '#FFFFFF',

  new: '#3DDC97',
  newInk: '#052A1C',

  overlay: 'rgba(7, 8, 10, 0.72)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
};

export const type = {
  display: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.9,
    color: colors.text,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: colors.text,
  },
  body: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: colors.accent,
  },
};
