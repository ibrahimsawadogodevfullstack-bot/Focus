import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { colors, spacing } from '../constants/theme';

const TITLE_HEIGHT = 40;
const META_HEIGHT = 17;

/**
 * Squelette de chargement : la forme exacte du contenu qui arrive.
 * Il reçoit la largeur de carte calculée par la grille, pour que rien ne bouge
 * quand les vraies images se posent.
 */
export default function FeedSkeleton({
  rows = 2,
  columns = 1,
  cardWidth,
  count,
  withShorts = false,
}) {
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

  // `count` reste accepté pour les anciens appels : on l'interprète en cartes.
  const rowCount = count ? Math.ceil(count / columns) : rows;
  const width = cardWidth ?? 320;

  return (
    <View accessibilityLabel="Chargement du flux" accessibilityRole="progressbar">
      {withShorts ? (
        <Animated.View style={[styles.shelf, { opacity: pulse }]}>
          <View style={styles.shelfTitle} />
          <View style={styles.shelfRow}>
            {[0, 1, 2].map((key) => (
              <View key={key} style={styles.shortThumb} />
            ))}
          </View>
        </Animated.View>
      ) : null}

      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Animated.View
              key={columnIndex}
              style={[styles.card, { width, opacity: pulse }]}
            >
              <View style={styles.thumb} />
              <View style={styles.textRow}>
                <View style={styles.avatar} />
                <View style={styles.texts}>
                  <View style={styles.lineWide} />
                  <View style={styles.lineShort} />
                </View>
              </View>
            </Animated.View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  card: {
    paddingBottom: spacing.lg,
  },
  thumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
  },
  textRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.md,
    minHeight: 36 + TITLE_HEIGHT + META_HEIGHT,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
  },
  texts: {
    flex: 1,
    gap: spacing.sm,
  },
  lineWide: {
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.surfaceAlt,
    width: '92%',
  },
  lineShort: {
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.surfaceAlt,
    width: '58%',
  },
  shelf: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  shelfTitle: {
    width: 84,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.md,
  },
  shelfRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  shortThumb: {
    width: 156,
    aspectRatio: 9 / 16,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
  },
});
