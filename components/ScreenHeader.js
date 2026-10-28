import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../constants/theme';

/** En-tête d'onglet : un titre, une ligne de contexte, une action optionnelle. */
export default function ScreenHeader({ title, subtitle, right }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.action}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
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
