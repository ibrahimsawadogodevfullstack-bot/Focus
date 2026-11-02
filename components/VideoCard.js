import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../constants/theme';
import { useTheme, useThemeStyles } from '../services/ThemeProvider';
import ChannelAvatar from './ChannelAvatar';
import VideoThumbnail from './VideoThumbnail';
import { formatClock, timeAgo } from '../utils/format';
import { MoreIcon } from './Icons';

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
  // Le flux RSS ne transporte pas la durée : on réutilise celle mémorisée par
  // le suivi de lecture une fois la vidéo ouverte, sinon rien n'est affiché.
  const duration = Number(durationProp ?? video.duration);
  const hasDuration = Number.isFinite(duration) && duration > 0;
  const progressRatio = Number.isFinite(progress)
    ? Math.min(1, Math.max(0, progress))
    : 0;

  const label = `${video.title} — ${video.channelTitle}, ${timeAgo(video.publishedAt)}${
    hasDuration ? `, ${formatClock(duration)}` : ''
  }${pending ? ', format en cours de détection' : ''}`;

  const initial = (video.channelTitle || '?').trim().charAt(0).toUpperCase();

  return (
    <View style={[styles.card, width ? { width } : null]}>
      <VideoThumbnail
        videoId={video.videoId}
        format="video"
        pending={pending}
        dataSaver={dataSaver}
        fallbackText={initial}
        onPress={onPress}
        accessibilityLabel={label}
        style={styles.thumbWrap}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {isNew && !pending ? (
            <View style={styles.newBadge}>
              <View style={styles.newDot} />
              <Text style={styles.badgeText}>Nouveau</Text>
            </View>
          ) : null}

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
          accessibilityLabel={`Ouvrir ${video.title}`}
          style={({ pressed }) => [styles.info, pressed && styles.pressed]}
        >
          <ChannelAvatar uri={channelAvatar} name={video.channelTitle} size={36} />

          <View style={styles.texts}>
            <Text style={styles.title} numberOfLines={2}>
              {video.title}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {`${video.channelTitle} · ${timeAgo(video.publishedAt)}`}
            </Text>
          </View>
        </Pressable>

        {onMore ? (
          <Pressable
            onPress={onMore}
            accessibilityRole="button"
            accessibilityLabel={`Options pour ${video.channelTitle}`}
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
  newBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: 'rgba(5, 7, 14, 0.82)',
  },
  durationBadge: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    height: 20,
    paddingHorizontal: 7,
    borderRadius: 6,
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 7, 14, 0.86)',
  },
  badgeText: {
    color: colors.text,
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
    color: colors.textFaint,
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: META_HEIGHT,
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
