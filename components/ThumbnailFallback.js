import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/theme';
import { thumbnailRatio } from '../services/thumbnailLayout';
import { PlayIcon } from './Icons';
import { useTheme, useThemeStyles } from '../services/ThemeProvider';

export default function ThumbnailFallback({ format = 'video', label, style }) {
  const { colors } = useTheme();
  const themedStyles = useThemeStyles(styles);
  return (
    <View
      style={[themedStyles.container, { aspectRatio: thumbnailRatio(format) }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={themedStyles.playCircle}>
        <PlayIcon color={colors.text} size={16} />
      </View>
      {label ? <Text style={themedStyles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.surface,
  },
  playCircle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.raised,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
});
