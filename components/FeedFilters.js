import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, fontSize, layout, radius, spacing } from '../src/shared/theme/tokens';
import Chip from '../src/shared/ui/Chip';
import { Chevron } from '../src/shared/ui/Icons';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';

/**
 * Filtres du flux, sur une seule ligne compacte pour ne pas agrandir le
 * chrome de l'accueil : nouveautés, sans Shorts, tri et réinitialisation.
 *
 * Les puces ne s'affichent que lorsqu'elles ont un sens (pas d'historique =
 * pas de « Nouveautés » ; pas de Shorts = pas de « Sans Shorts »).
 */
export default function FeedFilters({
  unseenOnly = false,
  unseenCount = 0,
  hasHistory = false,
  onToggleUnseen,
  hideShorts = false,
  shortsCount = 0,
  onToggleShorts,
  sort = 'recent',
  sortLabel,
  onOpenSort,
  onReset,
}) {
  const { colors } = useTheme();
  const styles = useThemeStyles(baseStyles);
  const { t } = useTranslation('home');

  const showUnseen = hasHistory && (unseenCount > 0 || unseenOnly);
  const showShorts = shortsCount > 0 || hideShorts;
  const activeCount = (unseenOnly ? 1 : 0) + (hideShorts ? 1 : 0) + (sort !== 'recent' ? 1 : 0);

  return (
    <View style={styles.bar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        {showUnseen ? (
          <Chip
            size="sm"
            active={unseenOnly}
            label={t('filterUnseen')}
            count={unseenCount}
            accessibilityLabel={t('filterUnseenHint')}
            onPress={onToggleUnseen}
          />
        ) : null}

        {showShorts ? (
          <Chip
            size="sm"
            active={hideShorts}
            label={t('filterHideShorts')}
            accessibilityLabel={t('filterHideShortsHint')}
            onPress={onToggleShorts}
          />
        ) : null}

        <Chip
          size="sm"
          active={sort !== 'recent'}
          label={t('sort')}
          value={sortLabel}
          accessibilityLabel={`${t('sort')} : ${sortLabel}`}
          onPress={onOpenSort}
          trailing={
            <Chevron
              direction="down"
              color={sort !== 'recent' ? colors.bg : colors.textFaint}
              size={7}
              thickness={2}
            />
          }
        />

        {activeCount > 0 ? (
          <Pressable
            onPress={onReset}
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole="button"
            accessibilityLabel={t('filterReset')}
            style={({ pressed }) => [styles.reset, pressed && styles.resetPressed]}
          >
            <Text style={styles.resetText}>{t('filterReset')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  bar: {
    flexGrow: 0,
    flexShrink: 0,
    height: layout.hit,
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  content: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    height: layout.hit,
  },
  reset: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  resetText: {
    color: colors.accentText,
    fontSize: fontSize.meta,
    fontWeight: '700',
  },
});
