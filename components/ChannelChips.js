import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { colors, spacing } from '../constants/theme';

export default function ChannelChips({ channels, activeChannelId, onSelect }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      <Chip
        label="Tout"
        active={activeChannelId === null}
        onPress={() => onSelect(null)}
      />
      {channels.map((channel) => (
        <Chip
          key={channel.id}
          label={channel.title}
          active={activeChannelId === channel.id}
          onPress={() => onSelect(channel.id)}
        />
      ))}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: 220,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  labelActive: {
    color: '#ffffff',
  },
});
