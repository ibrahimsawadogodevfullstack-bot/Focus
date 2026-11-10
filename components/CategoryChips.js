import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, icon, radius, spacing } from '../src/shared/theme/tokens';
import Chip from '../src/shared/ui/Chip';
import { PlusIcon } from '../src/shared/ui/Icons';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';

/** Filtres de catégories, dans l'esprit des puces de la page d'accueil YouTube. */
export default function CategoryChips({ categories, activeId, onSelect, onCreate }) {
  const { colors } = useTheme();
  const styles = useThemeStyles(baseStyles);
  const { t } = useTranslation();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      <Chip label={t('home:allCategories')} active={activeId === null} onPress={() => onSelect(null)} />

      {categories.map((category) => (
        <Chip
          key={category.id}
          label={category.name}
          active={activeId === category.id}
          onPress={() => onSelect(category.id)}
        />
      ))}

      {onCreate ? (
        <Pressable
          onPress={onCreate}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={t('home:manageCategories')}
          style={({ pressed }) => [styles.add, pressed && styles.addPressed]}
        >
          <PlusIcon color={colors.textMuted} size={icon.sm} />
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const baseStyles = StyleSheet.create({
  // Hauteur fixe : une ScrollView horizontale dans une colonne flex se
  // comprime sinon (surtout sur le web).
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
    height: 56,
  },
  content: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 56,
  },
  add: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  addPressed: {
    backgroundColor: colors.surfaceAlt,
  },
});
