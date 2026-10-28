import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../constants/theme';

/** Squelette de chargement : la forme du contenu, sans spinner bloquant. */
export default function FeedSkeleton({ count = 3 }) {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.8,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View accessibilityLabel="Chargement du flux" accessibilityRole="progressbar">
      {Array.from({ length: count }).map((_, index) => (
        <Animated.View key={index} style={[styles.card, { opacity: pulse }]}>
          <View style={styles.thumb} />
          <View style={styles.lineWide} />
          <View style={styles.lineShort} />
          <View style={styles.metaRow}>
            <View style={styles.avatar} />
            <View style={styles.metaLine} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  thumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  lineWide: {
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.surfaceAlt,
    marginTop: spacing.md,
    width: '88%',
  },
  lineShort: {
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.surfaceAlt,
    marginTop: spacing.sm,
    width: '54%',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
  },
  metaLine: {
    width: 120,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceAlt,
  },
});
