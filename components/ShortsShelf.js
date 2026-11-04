import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '../src/shared/theme/tokens';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';
import { isShort } from '../src/domain/videoFormat';
import ShortCard, { SHORT_CARD_WIDTH } from './ShortCard';
import { ShortsIcon } from '../src/shared/ui/Icons';

const GUTTER = spacing.lg; // 16 px, aligné sur la grille
const GAP = 12;

/**
 * Rangée « Shorts » : défilement horizontal, cartes 9:16.
 *
 * Filtre défensif : même si une vidéo long a fuité dans la liste, elle ne peut
 * pas être dessinée ici. Inversement, les Shorts ne vont jamais dans la grille
 * 16:9 (voir splitByFormat dans FeedScreen).
 */
export default function ShortsShelf({
  videos,
  onOpen,
  onMore,
  seen,
  hasHistory,
  sidePadding = 0,
  dataSaver = false,
}) {
  const { colors } = useTheme();
  const styles = useThemeStyles(baseStyles);
  const { t } = useTranslation();
  const shorts = (videos ?? []).filter((video) => isShort(video));
  if (shorts.length === 0) return null;

  const padding = sidePadding + GUTTER;

  return (
    <View style={styles.wrap}>
      <View style={[styles.header, { paddingHorizontal: padding }]}>
        <ShortsIcon color={colors.accentText} size={16} />
        <Text style={styles.title}>{t('home:shorts')}</Text>
        <Text style={styles.count}>{shorts.length}</Text>
      </View>

      <FlatList
        horizontal
        data={shorts}
        keyExtractor={(item) => item.videoId}
        showsHorizontalScrollIndicator={false}
        accessibilityLabel={t('home:shortsShelf')}
        contentContainerStyle={[styles.list, { paddingHorizontal: padding }]}
        initialNumToRender={4}
        windowSize={5}
        removeClippedSubviews={false}
        renderItem={({ item }) => (
          <ShortCard
            video={item}
            width={SHORT_CARD_WIDTH}
            isNew={Boolean(hasHistory) && !(seen?.has(item.videoId) ?? false)}
            dataSaver={dataSaver}
            onPress={() => onOpen(item, shorts)}
            onMore={onMore ? () => onMore(item) : undefined}
          />
        )}
      />
    </View>
  );
}

const baseStyles = StyleSheet.create({
  wrap: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
    gap: GAP,
  },
});
