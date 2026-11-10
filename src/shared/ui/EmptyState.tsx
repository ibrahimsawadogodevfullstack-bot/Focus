import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '../theme/tokens';
import { FocusMark } from './FocusMark';
import { useThemeStyles } from '../theme/ThemeProvider';

export default function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const styles = useThemeStyles(baseStyles);
  return (
    <View style={styles.wrap}>
      <FocusMark size={40} style={styles.mark} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
    gap: spacing.sm,
  },
  mark: {
    opacity: 0.5,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.title,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: spacing.xs,
  },
  message: {
    color: colors.textFaint,
    fontSize: fontSize.label,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 280,
  },
  action: {
    marginTop: spacing.md,
    height: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionText: {
    color: colors.accentText,
    fontSize: fontSize.label,
    fontWeight: '700',
  },
});
