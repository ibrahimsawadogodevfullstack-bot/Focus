import { StyleSheet, Text } from 'react-native';
import type { ReactNode } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

import { colors, fontSize } from '../theme/tokens';
import { useThemeStyles } from '../theme/ThemeProvider';

/**
 * Libellé de section unique de l'app.
 *
 * Même taille, même graisse, même casse et même interlettrage partout :
 * Catégories, Chaînes et Réglages ne doivent plus diverger.
 */
export default function SectionLabel({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const themedStyles = useThemeStyles(baseStyles);
  return <Text style={[themedStyles.label, style]}>{children}</Text>;
}

const baseStyles = StyleSheet.create({
  label: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
