import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '../src/shared/theme/tokens';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';
import ChannelAvatar from '../src/shared/ui/ChannelAvatar';
import VideoThumbnail from '../src/shared/ui/media/VideoThumbnail';
import { formatClock, timeAgo } from '../src/shared/utils/format';
import { MoreIcon } from '../src/shared/ui/Icons';

/** Hauteur du bloc texte : 2 lignes de titre + 1 ligne secondaire. */
const TITLE_HEIGHT = 40;
const META_HEIGHT = 17;

/**
 * Carte vidéo longue (16:9) : miniature, puis avatar + titre + chaîne.
 *
 * Deux règles qui garantissent une grille alignée :
 *   - la carte ne porte aucun padding horizontal (c'est la grille qui l'impose) ;
 *   - le bloc texte a une hauteur minimale, donc un titre d'une ligne donne la
 *     même hauteur de carte qu'un titre de deux lignes.
 *
 * La carte ne dessine qu'une seule image : jamais de fond zoomé derrière une
 * seconde image. Les Shorts ne doivent jamais arriver ici (ils ont leur carte).
 */
export default function VideoCard({
  video,
  isNew,
  channelAvatar,
  onPress,
  onMore,
  width,
  pending = false,
  progress = 0,
  duration: durationProp,
  dataSaver = false,
}) {
  const { colors } = useTheme();
  const styles = useThemeStyles(baseStyles);
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'fr';
  // Le flux RSS ne transporte pas la durée : on réutilise celle mémorisée par
  // le suivi de lecture une fois la vidéo ouverte, sinon rien n'est affiché.
  const duration = Number(durationProp ?? video.duration);
  const hasDuration = Number.isFinite(duration) && duration > 0;
  const progressRatio = Number.isFinite(progress)
    ? Math.min(1, Math.max(0, progress))
    : 0;

  const details = [
    video.viewCount != null
      ? t('home:views', { count: video.viewCount })
      : '',
    timeAgo(video.publishedAt, locale),
    hasDuration ? formatClock(duration) : '',
    pending ? t('home:formatDetection') : '',
  ].filter(Boolean).join(', ');
  const label = t('home:videoAccessibility', {
    title: video.title,
    channel: video.channelTitle,
    details: details ? `, ${details}` : '',
  });

  const initial = (video.channelTitle || '?').trim().charAt(0).toUpperCase();

  return (
    <View style={[styles.card, width ? { width } : null]}>
      <VideoThumbnail
        videoId={video.videoId}
        thumbnail={video.thumbnail}
        format="video"
        pending={pending}
        dataSaver={dataSaver}
        fallbackText={initial}
        onPress={onPress}
        accessibilityLabel={label}
        radius={0}
        style={styles.thumbWrap}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {hasDuration && !pending ? (
            <View style={styles.durationBadge}>
              <Text style={styles.badgeText}>{formatClock(duration)}</Text>
            </View>
          ) : null}

          {progressRatio > 0 && !pending ? (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
            </View>
          ) : null}
        </View>
      </VideoThumbnail>

      <View style={styles.row}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={t('home:openVideo', { title: video.title })}
          style={({ pressed }) => [styles.info, pressed && styles.pressed]}
        >
          <ChannelAvatar uri={channelAvatar} name={video.channelTitle} size={36} />

          <View style={styles.texts}>
            <Text style={styles.title} numberOfLines={2}>
              {video.title}
            </Text>
            <View style={styles.metaRow}>
              {isNew && !pending ? <View style={styles.newDot} /> : null}
              <Text style={styles.meta} numberOfLines={1}>
                {[video.channelTitle, video.viewCount != null ? t('home:views', { count: video.viewCount }) : null, timeAgo(video.publishedAt, locale)]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          </View>
        </Pressable>

        {onMore ? (
          <Pressable
            onPress={onMore}
            accessibilityRole="button"
            accessibilityLabel={t('home:videoOptions', { channel: video.channelTitle })}
            hitSlop={4}
            style={({ pressed }) => [styles.more, pressed && styles.morePressed]}
          >
            <MoreIcon color={colors.textMuted} size={15} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  card: {
    paddingBottom: spacing.lg,
  },
  pressed: {
    opacity: 0.8,
  },
  thumbWrap: {
    width: '100%',
  },
  durationBadge: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    height: 20,
    paddingHorizontal: 7,
    borderRadius: 6,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.1,
    fontVariant: ['tabular-nums'],
  },
  newDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accent,
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(5, 7, 14, 0.55)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  info: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  texts: {
    flex: 1,
    gap: 3,
    paddingTop: 1,
    minHeight: TITLE_HEIGHT + META_HEIGHT + 3,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: -0.2,
    minHeight: TITLE_HEIGHT,
  },
  meta: {
    flex: 1,
    color: colors.textFaint,
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: META_HEIGHT,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  more: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  morePressed: {
    backgroundColor: colors.surface,
  },
});
