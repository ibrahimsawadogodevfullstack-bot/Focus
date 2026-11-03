import { Image, StyleSheet } from 'react-native';
import type { ImageStyle, StyleProp } from 'react-native';

/** Reticule « focus » : identité de l'application. */
export function FocusMark({
  size = 24,
  style,
}: {
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={require('../../../assets/focus-mark.png')}
      style={[styles.mark, { width: size, height: size }, style]}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  mark: {
    opacity: 0.98,
  },
});
