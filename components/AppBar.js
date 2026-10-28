import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../constants/theme';
import { FocusMark } from './FocusMark';

/** Bandeau de marque, présent en haut du flux. */
export default function AppBar({ right }) {
  return (
    <View style={styles.bar}>
      <View style={styles.brand}>
        <FocusMark size={20} />
        <Text style={styles.wordmark}>focus</Text>
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    height: 52,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  wordmark: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
});
