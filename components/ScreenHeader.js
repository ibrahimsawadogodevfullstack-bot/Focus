import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../constants/theme';
import BrandMark from './BrandMark';

/**
 * En-tête d'onglet façon YouTube : la marque à gauche, le titre centré sur la
 * même ligne, puis une ligne de contexte discrète en dessous.
 */
export default function ScreenHeader({ title, subtitle, right }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <BrandMark size={16} textSize={16} />

        <View style={styles.center} pointerEvents="none">
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View style={styles.right}>{right}</View>
      </View>

      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={2}>
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
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  right: {
    minWidth: 24,
    alignItems: 'flex-end',
  },
  subtitle: {
    color: colors.textFaint,
    fontSize: 12.5,
    fontWeight: '500',
    textAlign: 'center',
  },
});
