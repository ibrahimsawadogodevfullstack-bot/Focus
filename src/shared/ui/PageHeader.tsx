import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import { colors, fontSize, spacing } from '../theme/tokens';
import { useTheme, useThemeStyles } from '../theme/ThemeProvider';
import { Chevron } from './Icons';

/** En-tête de page secondaire : retour explicite + titre. */
export default function PageHeader({
  title,
  subtitle,
  backLabel,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  backLabel?: string;
  onBack: () => void;
  right?: ReactNode;
}) {
  const themedStyles = useThemeStyles(styles);
  const { colors: theme } = useTheme();
  const { t } = useTranslation('common');

  return (
    <View style={themedStyles.wrap}>
      <View style={themedStyles.bar}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={backLabel ? t('backTo', { label: backLabel }) : t('back')}
          hitSlop={6}
          style={({ pressed }) => [themedStyles.back, pressed && themedStyles.pressed]}
        >
          <Chevron direction="left" color={theme.text} size={9} thickness={2} />
          {backLabel ? <Text style={themedStyles.backLabel} numberOfLines={1}>{backLabel}</Text> : null}
        </Pressable>
        <Text style={themedStyles.title} numberOfLines={1}>{title}</Text>
        {right ? <View style={themedStyles.right}>{right}</View> : <View style={themedStyles.rightSpacer} />}
      </View>
      {subtitle ? <Text style={themedStyles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
    backgroundColor: colors.bg,
    gap: spacing.xs,
  },
  bar: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 44,
    paddingRight: spacing.sm,
    maxWidth: '45%',
  },
  backLabel: {
    flexShrink: 1,
    color: colors.text,
    fontSize: fontSize.label,
    fontWeight: '600',
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.headline,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'left',
  },
  right: {
    alignItems: 'flex-end',
  },
  rightSpacer: {
    width: 0,
  },
  subtitle: {
    color: colors.textFaint,
    fontSize: fontSize.meta,
    fontWeight: '500',
    textAlign: 'left',
  },
  pressed: {
    opacity: 0.6,
  },
});
