import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import { colors, spacing } from '../theme/tokens';
import { useThemeStyles } from '../theme/ThemeProvider';
import BrandMark from './BrandMark';

/**
 * En-tête d'onglet : la marque à gauche, le titre aligné à droite sur la même
 * ligne, puis une ligne de contexte discrète sous le titre.
 */
export default function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const themedStyles = useThemeStyles(styles);
  return (
    <View style={themedStyles.wrap}>
      <View style={themedStyles.bar}>
        <BrandMark size={16} textSize={16} />

        <View style={themedStyles.center} pointerEvents="none">
          <Text style={themedStyles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>

        {right ? <View style={themedStyles.right}>{right}</View> : null}
      </View>

      {subtitle ? (
        <Text style={themedStyles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  bar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'right',
  },
  right: {
    alignItems: 'flex-end',
  },
  subtitle: {
    color: colors.textFaint,
    fontSize: 12.5,
    fontWeight: '500',
    textAlign: 'right',
  },
});
