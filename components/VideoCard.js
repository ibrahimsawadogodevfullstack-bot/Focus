import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../constants/theme';
import { timeAgo } from '../utils/format';

const THUMB_STEPS = ['maxresdefault', 'sddefault', 'hqdefault'];

/**
 * Carte vidéo façon YouTube : grande miniature, puis avatar + titre + chaîne.
 */
export default function VideoCard({ video, isNew, onPress }) {
  const [thumbStep, setThumbStep] = useState(0);
  const initial = (video.channelTitle || '?').trim().charAt(0).toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${video.title} — ${video.channelTitle}, ${timeAgo(video.publishedAt)}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.thumbWrap}>
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
      </View>

      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={styles.texts}>
          <Text style={styles.title} numberOfLines={2}>
            {video.title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {video.channelTitle} · {timeAgo(video.publishedAt)}
          </Text>
        </View>
      </View>
    </Pressable>
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
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.accentText,
    fontSize: 14,
    fontWeight: '800',
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
});
