import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '../src/shared/theme/tokens';
import { SHORT_ASPECT } from '../src/shared/media/thumbnailLayout';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';
import { isShort } from '../src/domain/videoFormat';
import ShortCard, { SHORT_CARD_WIDTH } from './ShortCard';
import { ShortsIcon } from '../src/shared/ui/Icons';

const GUTTER = spacing.lg; // 16 px, aligné sur la grille
const GAP = 12;
/** Hauteur de ligne du titre, fixée pour rendre la hauteur de la rangée calculable. */
const TITLE_LINE_HEIGHT = 20;
/** Marges et en-tête autour du carrousel : paddingTop + titre + paddingBottom. */
const SHELF_CHROME_HEIGHT =
  spacing.lg + TITLE_LINE_HEIGHT + spacing.md + spacing.sm;

/** Hauteur d'une carte Short (vignette 9:16 + bloc texte). */
export function shortCardHeight(fontScale = 1) {
  return Math.ceil(SHORT_CARD_WIDTH / SHORT_ASPECT + spacing.sm * 2 + 34 * fontScale);
}

/**
 * Hauteur totale de la rangée Shorts, en-tête compris.
 *
 * Exportée pour que `FeedScreen` puisse fournir `getItemLayout` à sa liste
 * verticale : la rangée Shorts y occupe une seule cellule dont la hauteur doit
 * être connue sans attendre la mesure.
 */
export function shortsShelfHeight(fontScale = 1) {
  return SHELF_CHROME_HEIGHT + shortCardHeight(fontScale);
}

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
  const { fontScale } = useWindowDimensions();
  const styles = useThemeStyles(baseStyles);
  const { t } = useTranslation();
  const shorts = (videos ?? []).filter((video) => isShort(video));
  if (shorts.length === 0) return null;

  const padding = sidePadding + GUTTER;
  const cardHeight = shortCardHeight(fontScale);

  return (
    <View style={styles.wrap}>
      <View style={[styles.header, { paddingHorizontal: padding }]}>
        <ShortsIcon color={colors.accentText} size={16} />
        <Text style={styles.title}>{t('home:shorts')}</Text>
        <Text style={styles.count}>{shorts.length}</Text>
      </View>

      <FlatList
        horizontal
        style={[styles.carousel, { height: cardHeight }]}
        data={shorts}
        keyExtractor={(item) => item.videoId}
        getItemLayout={(_data, index) => ({
          index,
          length: SHORT_CARD_WIDTH + GAP,
          offset: (SHORT_CARD_WIDTH + GAP) * index,
        })}
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
    lineHeight: TITLE_LINE_HEIGHT,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  count: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  carousel: {
    flexGrow: 0,
    flexShrink: 0,
  },
  list: {
    gap: GAP,
  },
});
