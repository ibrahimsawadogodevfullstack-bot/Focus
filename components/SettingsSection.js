import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../constants/theme';
import { useThemeStyles } from '../services/ThemeProvider';

export default function SettingsSection({ title, children }) {
  const themedStyles = useThemeStyles(styles);
  return (
    <View style={themedStyles.section}>
      <Text style={themedStyles.title}>{title}</Text>
      <View style={themedStyles.rows}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  title: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    paddingHorizontal: spacing.xs,
  },
  rows: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    overflow: 'hidden',
  },
});
