import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors } from '../theme/tokens';
import { useThemeStyles } from '../theme/ThemeProvider';
import { FocusMark } from './FocusMark';

interface BrandMarkProps {
  size?: number;
  textSize?: number;
  style?: StyleProp<ViewStyle>;
}

/** Marque de l'application, présente en haut de chaque onglet. */
export default function BrandMark({ size = 18, textSize = 18, style }: BrandMarkProps) {
  const themedStyles = useThemeStyles(styles);
  return (
    <View style={[themedStyles.row, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <FocusMark size={size} />
      <Text style={[themedStyles.word, { fontSize: textSize }]}>focus</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  word: {
    color: colors.text,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
});
