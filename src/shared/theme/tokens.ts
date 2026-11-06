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
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const type = {
  display: { fontSize: 32, fontWeight: '800', letterSpacing: -1.1, color: colors.text },
  headline: { fontSize: 22, fontWeight: '700', letterSpacing: -0.6, color: colors.text },
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, color: colors.text },
  body: { fontSize: 15, fontWeight: '500', color: colors.text },
  meta: { fontSize: 12.5, fontWeight: '500', color: colors.textMuted },
  label: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
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
