import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { colors, radius, spacing } from '../constants/theme';
import { timeAgo } from '../utils/format';

const THUMB_STEPS = ['maxresdefault', 'sddefault', 'hqdefault'];

export default function VideoCard({ video, isNew, onPress }) {
  const [thumbStep, setThumbStep] = useState(0);
  const initial = (video.channelTitle || '?').trim().charAt(0).toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${video.title} — ${video.channelTitle}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.thumbWrap}>
        <Image
          source={{
            uri: `https://i.ytimg.com/vi/${video.videoId}/${THUMB_STEPS[thumbStep]}.jpg`,
          }}
          style={styles.thumb}
          resizeMode="cover"
          onError={() =>
            setThumbStep((step) => Math.min(step + 1, THUMB_STEPS.length - 1))
          }
        />
        {isNew ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>NOUVEAU</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {video.title}
      </Text>

      <View style={styles.metaRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.channel} numberOfLines={1}>
          {video.channelTitle}
        </Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.time}>{timeAgo(video.publishedAt)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  pressed: {
    opacity: 0.72,
  },
  thumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(244, 241, 234, 0.08)',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: colors.onAccent,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    letterSpacing: -0.2,
    marginTop: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  avatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
  },
  channel: {
    color: colors.textMuted,
    fontSize: 12.5,
    fontWeight: '600',
    flexShrink: 1,
  },
  dot: {
    color: colors.textFaint,
    fontSize: 12,
  },
  time: {
    color: colors.textFaint,
    fontSize: 12,
  },
});
