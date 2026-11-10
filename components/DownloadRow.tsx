import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, fontSize, radius, spacing } from '../src/shared/theme/tokens';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';
import { MoreIcon } from '../src/shared/ui/Icons';
import VideoThumbnail from '../src/shared/ui/media/VideoThumbnail';
import { formatClock } from '../src/shared/utils/format';
import { formatBytes } from '../services/localVideos';

/** Hauteur d'une ligne, marge comprise, pour `getItemLayout`. */
export const DOWNLOAD_ROW_HEIGHT = 92;

type DownloadRowProps = {
  video: any;
  sizeBytes?: number | null;
  onPress: () => void;
  onMore?: () => void;
  onLongPress?: () => void;
};

/**
 * Ligne de la bibliothèque hors ligne : miniature, titre, chaîne et poids du
 * fichier. Plus lisible qu'une grille quand on cherche un téléchargement.
 */
export default function DownloadRow({
  video,
  sizeBytes,
  onPress,
  onMore,
  onLongPress,
}: DownloadRowProps) {
  const { colors: theme } = useTheme();
  const styles = useThemeStyles(baseStyles);
  const { t } = useTranslation(['offline']);

  const duration = Number(video.duration);
  const hasDuration = Number.isFinite(duration) && duration > 0;
  const size = sizeBytes ? formatBytes(sizeBytes) : '';
  const meta = [video.channelTitle, size].filter(Boolean).join(' · ') || t('offlineTag');
  const label = t('offline:openVideo', { title: video.title });

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.thumbWrap}>
        <VideoThumbnail
          videoId={video.videoId}
          thumbnail={video.thumbnail}
          format="video"
          radius={radius.sm}
          dataSaver
          style={styles.thumb}
        />
        {hasDuration ? (
          <View pointerEvents="none" style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatClock(duration)}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {video.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>

      {onMore ? (
        <Pressable
          onPress={onMore}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('offline:removeDownload', { title: video.title })}
          style={({ pressed }) => [styles.more, pressed && styles.morePressed]}
        >
          <MoreIcon color={theme.textMuted} size={16} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const baseStyles = StyleSheet.create({
  row: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  pressed: {
    opacity: 0.75,
  },
  thumbWrap: {
    width: 120,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  thumb: {
    width: 120,
  },
  durationBadge: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: radius.xs,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: fontSize.micro,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '600',
    lineHeight: 19,
  },
  meta: {
    color: colors.textMuted,
    fontSize: fontSize.meta,
    lineHeight: 16,
  },
  more: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  morePressed: {
    backgroundColor: colors.surfaceAlt,
  },
});
