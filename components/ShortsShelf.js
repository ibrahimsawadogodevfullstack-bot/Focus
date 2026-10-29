import { FlatList, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../constants/theme';
import ShortCard from './ShortCard';
import { ShortsIcon } from './Icons';

const GUTTER = spacing.lg; // 16 px, aligné sur la grille

/**
 * Rangée « Shorts » : défilement horizontal, cartes 9:16.
 * Les Shorts n'apparaissent jamais dans la grille 16:9 — c'est cette séparation
 * qui garantit qu'aucune vignette verticale n'est dessinée dans une carte large.
 */
export default function ShortsShelf({ videos, onOpen, seen, hasHistory }) {
  if (!videos || videos.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <ShortsIcon color={colors.accentText} size={16} />
        <Text style={styles.title}>Shorts</Text>
        <Text style={styles.count}>{videos.length}</Text>
      </View>

      <FlatList
        horizontal
        data={videos}
        keyExtractor={(item) => item.videoId}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        initialNumToRender={4}
        windowSize={5}
        renderItem={({ item }) => (
          <ShortCard
            video={item}
            isNew={Boolean(hasHistory) && !(seen?.has(item.videoId) ?? false)}
            onPress={() => onOpen(item, videos)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: GUTTER,
    paddingBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  count: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  list: {
    paddingHorizontal: GUTTER,
    gap: spacing.md,
  },
});
