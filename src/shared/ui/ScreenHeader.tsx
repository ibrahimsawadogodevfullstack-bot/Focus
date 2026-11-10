import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { colors, fontSize, layout, radius, spacing } from '../theme/tokens';
import { useTheme, useThemeStyles } from '../theme/ThemeProvider';
import { Chevron } from './Icons';

/**
 * Barre de titre des pages secondaires, sans marque.
 *
 * Hauteur fixe (56 px, comme l'`AppBar` de l'accueil) et titre seul : aucun
 * sous-titre ne vient décaler la ligne de base d'un onglet à l'autre. Les
 * informations secondaires sont passées au contenu via `ScreenShell`.
 */
export default function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const themedStyles = useThemeStyles(styles);
  const { colors: theme } = useTheme();
  const { t } = useTranslation('common');

  return (
    <View style={themedStyles.wrap}>
      <View style={themedStyles.bar}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('back')}
            style={({ pressed }) => [themedStyles.back, pressed && themedStyles.pressed]}
          >
            <Chevron direction="left" color={theme.text} size={11} thickness={2} />
          </Pressable>
        ) : null}

        <Text style={themedStyles.title} numberOfLines={1}>
          {title}
        </Text>

        {right ? <View style={themedStyles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: layout.tabBar,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg,
  },
  bar: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  back: {
    width: 36,
    height: 36,
    marginLeft: -spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.display,
    fontWeight: '800',
    letterSpacing: -0.8,
    textAlign: 'left',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
