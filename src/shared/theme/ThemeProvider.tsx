import { createContext, useContext, useMemo } from 'react';
import type { PropsWithChildren } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';

import type { ThemePreference } from '../../domain/settings';
import { DARK_COLORS, LIGHT_COLORS } from './tokens';

const PALETTES = { dark: DARK_COLORS, light: LIGHT_COLORS };
type ResolvedTheme = keyof typeof PALETTES;
type ThemeColors = (typeof PALETTES)[ResolvedTheme];
type ThemeContextValue = {
  mode: ThemePreference;
  resolved: ResolvedTheme;
  colors: ThemeColors;
};

const DEFAULT_THEME: ThemeContextValue = {
  mode: 'dark',
  resolved: 'dark',
  colors: DARK_COLORS,
};
const ThemeContext = createContext(DEFAULT_THEME);

const COLOR_REPLACEMENTS = new Map(
  Object.entries(DARK_COLORS).map(([name, value]) => [value, name]),
);

function remapStyle(style: unknown, palette: ThemeColors): unknown {
  if (!style || typeof style !== 'object') return style;

  if (Array.isArray(style)) return style.map((entry) => remapStyle(entry, palette));

  return Object.fromEntries(
    Object.entries(style as Record<string, unknown>).map(([key, value]) => {
      const tokenName = typeof value === 'string' ? COLOR_REPLACEMENTS.get(value) : null;
      return [key, tokenName ? palette[tokenName as keyof ThemeColors] : value];
    }),
  );
}

export function ThemeProvider({
  children,
  mode = 'system',
}: PropsWithChildren<{ mode?: ThemePreference }>) {
  const systemScheme = useColorScheme();
  const resolved: ResolvedTheme =
    mode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : mode;
  const colors = PALETTES[resolved];
  const value = useMemo(() => ({ mode, resolved, colors }), [mode, resolved, colors]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useThemeStyles<T extends StyleSheet.NamedStyles<T>>(baseStyles: T): T {
  const { colors } = useTheme();
  return useMemo(() => {
    const styles = Object.fromEntries(
      Object.entries(baseStyles).map(([key, value]) => [key, remapStyle(value, colors)]),
    ) as StyleSheet.NamedStyles<T>;
    return StyleSheet.create(styles) as T;
  }, [baseStyles, colors]);
}
