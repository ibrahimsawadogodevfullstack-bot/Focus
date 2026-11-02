import { createContext, useContext, useMemo } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import { DARK_COLORS, LIGHT_COLORS } from '../constants/theme';
import { useSetting } from './SettingsProvider';

const PALETTES = { dark: DARK_COLORS, light: LIGHT_COLORS };
const DEFAULT_THEME = { mode: 'dark', resolved: 'dark', colors: DARK_COLORS };
const ThemeContext = createContext(DEFAULT_THEME);

const COLOR_REPLACEMENTS = new Map(
  Object.entries(DARK_COLORS).map(([name, value]) => [value, name]),
);

function remapStyle(style, palette) {
  if (!style || typeof style !== 'object') return style;

  if (Array.isArray(style)) return style.map((entry) => remapStyle(entry, palette));

  return Object.fromEntries(
    Object.entries(style).map(([key, value]) => {
      const tokenName = typeof value === 'string' ? COLOR_REPLACEMENTS.get(value) : null;
      return [key, tokenName ? palette[tokenName] : value];
    }),
  );
}

export function ThemeProvider({ children }) {
  const mode = useSetting('theme') ?? 'system';
  const systemScheme = useColorScheme();
  const resolved = mode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : mode;
  const colors = PALETTES[resolved];
  const value = useMemo(() => ({ mode, resolved, colors }), [mode, resolved, colors]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useThemeStyles(baseStyles) {
  const { colors } = useTheme();
  return useMemo(() => {
    const styles = Object.fromEntries(
      Object.entries(baseStyles).map(([key, value]) => [key, remapStyle(value, colors)]),
    );
    return StyleSheet.create(styles);
  }, [baseStyles, colors]);
}
