import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../src/shared/theme/tokens';
import { useThemeStyles } from '../src/shared/theme/ThemeProvider';
import SectionLabel from '../src/shared/ui/SectionLabel';

export default function SettingsSection({ title, children }) {
  const themedStyles = useThemeStyles(styles);
  return (
    <View style={themedStyles.section}>
      <SectionLabel style={themedStyles.title}>{title}</SectionLabel>
      <View style={themedStyles.rows}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  title: {
    paddingHorizontal: spacing.xs,
  },
  rows: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    overflow: 'hidden',
  },
});
