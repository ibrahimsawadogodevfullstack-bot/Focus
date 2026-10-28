import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../constants/theme';
import { PlusIcon } from './Icons';

export default function CategoryChips({ categories, activeId, onSelect, onManage }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      <Chip label="Tout" active={activeId === null} onPress={() => onSelect(null)} />

      {categories.map((category) => (
        <Chip
          key={category.id}
          label={category.name}
          count={category.channelIds.length}
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
        <PlusIcon color={colors.accentText} size={14} />
      </Pressable>
    </ScrollView>
  );
}

function Chip({ label, count, active, onPress }) {
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
      {typeof count === 'number' ? (
        <View style={[styles.countPill, active && styles.countPillActive]}>
          <Text style={[styles.countText, active && styles.countTextActive]}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 15,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    maxWidth: 220,
  },
  chipPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  labelActive: {
    color: colors.onAccent,
  },
  countPill: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  countText: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '700',
  },
  countTextActive: {
    color: colors.onAccent,
  },
  add: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  addPressed: {
    backgroundColor: colors.surfaceAlt,
  },
});
