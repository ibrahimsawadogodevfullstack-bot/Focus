import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '../src/shared/theme/tokens';
import { useThemeStyles } from '../src/shared/theme/ThemeProvider';
import VideoThumbnail from '../src/shared/ui/media/VideoThumbnail';
import { MoreIcon } from '../src/shared/ui/Icons';

/** Largeur d'une carte Short : 150 à 180 px sur mobile. */
export const SHORT_CARD_WIDTH = 156;

/**
 * Carte Short (9:16), destinée uniquement à la rangée horizontale.
 *
 * Une seule image, en `cover` : si la source est un 16:9 avec le Short au
 * centre, le cadre 9:16 recadre automatiquement la vraie vidéo. Aucun fond
 * zoomé superposé, aucun étirement.
 */
export default function ShortCard({
  video,
  width = SHORT_CARD_WIDTH,
  onPress,
  onMore,
  isNew,
  dataSaver = false,
}) {
  const styles = useThemeStyles(baseStyles);
  const { t } = useTranslation();
  return (
    <View style={[styles.card, { width }]}>
      <VideoThumbnail
        videoId={video.videoId}
        format="short"
        dataSaver={dataSaver}
        onPress={onPress}
        accessibilityLabel={t('home:shortAccessibility', {
          title: video.title,
          channel: video.channelTitle,
        })}
        style={styles.thumbWrap}
      >
        {isNew ? <View pointerEvents="none" style={styles.newDot} /> : null}

        {onMore ? (
          <Pressable
            onPress={onMore}
            accessibilityRole="button"
            accessibilityLabel={t('home:videoOptions', { channel: video.channelTitle })}
            hitSlop={4}
            style={({ pressed }) => [styles.more, pressed && styles.morePressed]}
          >
            <MoreIcon color={colors.text} size={15} />
          </Pressable>
        ) : null}
      </VideoThumbnail>

      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('home:openVideo', { title: video.title })}
        style={({ pressed }) => [styles.titlePress, pressed && styles.pressed]}
      >
        <Text style={styles.title} numberOfLines={2}>
          {video.title}
        </Text>
      </Pressable>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  card: {
    paddingBottom: spacing.sm,
  },
  pressed: {
    opacity: 0.8,
  },
  thumbWrap: {
    width: '100%',
  },
  newDot: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  more: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 7, 14, 0.52)',
  },
  morePressed: {
    backgroundColor: 'rgba(5, 7, 14, 0.78)',
  },
  titlePress: {
    marginTop: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17,
    minHeight: 34,
  },
});
