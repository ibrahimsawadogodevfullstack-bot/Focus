import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/theme';
import { FocusMark } from './FocusMark';

/** Marque de l'application, présente en haut de chaque onglet. */
export default function BrandMark({ size = 18, textSize = 18, style }) {
  return (
    <View style={[styles.row, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <FocusMark size={size} />
      <Text style={[styles.word, { fontSize: textSize }]}>focus</Text>
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
