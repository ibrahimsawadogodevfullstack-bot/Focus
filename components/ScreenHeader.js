import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../constants/theme';
import BrandMark from './BrandMark';

/** En-tête d'onglet : la marque, puis un titre, un contexte, une action. */
export default function ScreenHeader({ title, subtitle, right }) {
  return (
    <View style={styles.wrap}>
      <BrandMark style={styles.brand} />

      <View style={styles.head}>
        <View style={styles.texts}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.action}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  brand: {
    marginBottom: spacing.xs,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  texts: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1.1,
    lineHeight: 37,
  },
  subtitle: {
    color: colors.textFaint,
    fontSize: 13,
    fontWeight: '500',
  },
  action: {
    paddingTop: 6,
  },
});
