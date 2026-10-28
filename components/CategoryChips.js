import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../constants/theme';
import { PlusIcon } from './Icons';

/** Filtres de catégories, dans l'esprit des puces de la page d'accueil YouTube. */
export default function CategoryChips({ categories, activeId, onSelect, onManage }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      <Chip label="Tous" active={activeId === null} onPress={() => onSelect(null)} />

      {categories.map((category) => (
        <Chip
          key={category.id}
          label={category.name}
          active={activeId === category.id}
          onPress={() => onSelect(category.id)}
        />
      ))}

      <Pressable
        onPress={onManage}
        accessibilityRole="button"
        accessibilityLabel="Gérer les catégories"
        style={({ pressed }) => [styles.add, pressed && styles.addPressed]}
      >
        <PlusIcon color={colors.textMuted} size={13} />
      </Pressable>
    </ScrollView>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && !active && styles.chipPressed,
      ]}
    >
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  chip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    maxWidth: 220,
  },
  chipPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: {
    backgroundColor: colors.text,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  labelActive: {
    color: colors.bg,
  },
  add: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  addPressed: {
    backgroundColor: colors.surfaceAlt,
  },
});
