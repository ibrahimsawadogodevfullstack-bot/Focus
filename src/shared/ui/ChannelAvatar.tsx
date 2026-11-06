import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/tokens';
import { useThemeStyles } from '../theme/ThemeProvider';

/** Avatar de chaîne : la vraie photo YouTube, sinon l'initiale en secours. */
export default function ChannelAvatar({
  uri,
  name = '',
  size = 40,
}: {
  uri?: string | null;
  name?: string;
  size?: number;
}) {
  const styles = useThemeStyles(baseStyles);
  const [failed, setFailed] = useState(false);
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const circle = { width: size, height: size, borderRadius: size / 2 };

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, circle]}
        resizeMode="cover"
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View style={[styles.fallback, circle]}>
      <Text style={[styles.text, { fontSize: Math.round(size * 0.4) }]}>{initial}</Text>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  image: {
    overflow: "hidden",
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  text: {
    color: colors.accentText,
    fontWeight: '800',
  },
});
