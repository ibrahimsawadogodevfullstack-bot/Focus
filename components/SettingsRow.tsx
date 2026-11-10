import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import { colors, fontSize, spacing } from '../src/shared/theme/tokens';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';

export type SettingsRowKind = 'information' | 'choice' | 'action' | 'switch';

interface SettingsRowProps {
  label: string;
  description?: string;
  value?: ReactNode;
  kind?: SettingsRowKind;
  onPress?: () => void;
  onValueChange?: (value: boolean) => void;
  last?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export default function SettingsRow({
  label,
  description,
  value,
  kind = 'information',
  onPress,
  onValueChange,
  last = false,
  disabled = false,
  accessibilityLabel,
}: SettingsRowProps) {
  const { colors: themeColors } = useTheme();
  const themedStyles = useThemeStyles(styles);
  const content = (
    <>
      <View style={themedStyles.copy}>
        <Text style={[themedStyles.label, disabled && themedStyles.disabled]} numberOfLines={2}>
          {label}
        </Text>
        {description ? (
          <Text style={themedStyles.description} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
      {kind === 'switch' ? (
        <Switch
          value={Boolean(value)}
          onValueChange={onValueChange}
          disabled={disabled}
          accessibilityRole="switch"
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ checked: Boolean(value), disabled }}
          trackColor={{ false: themeColors.lineStrong, true: themeColors.accent }}
          thumbColor={themeColors.onAccent}
        />
      ) : (
        <Text style={themedStyles.value} numberOfLines={1}>
          {value ?? ''}
        </Text>
      )}
    </>
  );

  const rowStyle = [
    themedStyles.row,
    !last && themedStyles.divider,
    disabled && themedStyles.rowDisabled,
  ];

  if (kind === 'switch') {
    return <View style={rowStyle}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || disabled}
      accessibilityRole={kind === 'choice' || kind === 'action' ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [rowStyle, pressed && onPress && themedStyles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  pressed: {
    backgroundColor: colors.surfaceAlt,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  label: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  disabled: {
    color: colors.textFaint,
  },
  description: {
    color: colors.textMuted,
    fontSize: fontSize.meta,
    lineHeight: 16,
  },
  value: {
    maxWidth: '46%',
    color: colors.textMuted,
    fontSize: fontSize.label,
    fontWeight: '600',
    textAlign: 'right',
  },
});
