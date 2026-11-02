import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import { colors } from '../constants/theme';
import { useThemeStyles } from '../services/ThemeProvider';

/**
 * Barre de progression type YouTube : fine, collée en haut du contenu, qui se
 * remplit au fil des chaînes synchronisées puis s'efface une fois à jour.
 * Le pourcentage est affiché à côté de la marque (voir AppBar).
 */
export default function SyncBar({ active, percent = 0 }) {
  const styles = useThemeStyles(baseStyles);
  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: Math.max(0, Math.min(100, percent)),
      duration: 260,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [percent, progress]);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: active ? 1 : 0,
      duration: active ? 140 : 420,
      delay: active ? 0 : 600,
      useNativeDriver: true,
    }).start();
  }, [active, fade]);

  const width = progress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.track, { opacity: fade }]} pointerEvents="none">
      <Animated.View style={[styles.fill, { width }]} />
    </Animated.View>
  );
}

const baseStyles = StyleSheet.create({
  track: {
    height: 2.5,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
});
