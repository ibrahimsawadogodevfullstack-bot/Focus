import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../constants/theme';

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
        accessibilityLabel="Gérer les chaînes et les catégories"
        style={({ pressed }) => [styles.manage, pressed && styles.managePressed]}
      >
        <Text style={styles.managePlus}>＋</Text>
        <Text style={styles.manageText}>Gérer</Text>
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
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    height: 36,
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
    borderRadius: 9,
    paddingHorizontal: 5,
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
  manage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
  },
  managePressed: {
    backgroundColor: colors.surface,
  },
  managePlus: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    marginTop: -1,
  },
  manageText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
