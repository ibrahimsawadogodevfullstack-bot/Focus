import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../constants/theme';
import ChannelAvatar from './ChannelAvatar';
import { timeAgo } from '../utils/format';
import { DownloadIcon, MoreIcon } from './Icons';

const THUMB_STEPS = ['maxresdefault', 'sddefault', 'hqdefault'];

/**
 * Carte vidéo façon YouTube : grande miniature, puis avatar + titre + chaîne.
 * Le bouton « … » est un frère du bouton principal pour éviter un bouton
 * imbriqué dans un autre sur le web.
 */
export default function VideoCard({ video, isNew, downloaded, channelAvatar, onPress, onMore }) {
  const [thumbStep, setThumbStep] = useState(0);
  const label = `${video.title} — ${video.channelTitle}, ${timeAgo(video.publishedAt)}`;

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.thumbWrap, pressed && styles.pressed]}
      >
        <Image
          source={{
            uri: `https://i.ytimg.com/vi/${video.videoId}/${THUMB_STEPS[thumbStep]}.jpg`,
          }}
          style={styles.thumb}
          resizeMode="cover"
          onError={() => setThumbStep((step) => Math.min(step + 1, THUMB_STEPS.length - 1))}
        />

        {isNew ? (
          <View style={styles.newBadge}>
            <View style={styles.newDot} />
            <Text style={styles.newText}>Nouveau</Text>
          </View>
        ) : null}

        {downloaded ? (
          <View style={styles.downloadedBadge}>
            <DownloadIcon color={colors.text} size={11} thickness={2} />
            <Text style={styles.newText}>Téléchargée</Text>
          </View>
        ) : null}
      </Pressable>

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
              {video.channelTitle} · {timeAgo(video.publishedAt)}
            </Text>
          </View>
        </Pressable>

        {onMore ? (
          <Pressable
            onPress={onMore}
            accessibilityRole="button"
            accessibilityLabel={`Options pour ${video.channelTitle}`}
            hitSlop={8}
            style={({ pressed }) => [styles.more, pressed && styles.morePressed]}
          >
            <MoreIcon color={colors.textMuted} size={15} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  pressed: {
    opacity: 0.8,
  },
  thumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  newBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: 'rgba(5, 7, 14, 0.82)',
  },
  downloadedBadge: {
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
  newDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accent,
  },
  newText: {
    color: colors.text,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.1,
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
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  meta: {
    color: colors.textFaint,
    fontSize: 12.5,
    fontWeight: '500',
  },
  more: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  morePressed: {
    backgroundColor: colors.surface,
  },
});
