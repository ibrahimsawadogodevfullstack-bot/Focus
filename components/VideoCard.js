import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

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
        <Text style={styles.separator}>·</Text>
        <Text style={styles.time}>{timeAgo(video.publishedAt)}</Text>

        {isNew ? (
          <View style={styles.newTag}>
            <View style={styles.newDot} />
            <Text style={styles.newText}>Nouveau</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  pressed: {
    opacity: 0.75,
  },
  thumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(233, 241, 255, 0.08)',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    letterSpacing: -0.25,
    marginTop: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.accentText,
    fontSize: 10,
    fontWeight: '800',
  },
  channel: {
    color: colors.textMuted,
    fontSize: 12.5,
    fontWeight: '600',
    flexShrink: 1,
  },
  separator: {
    color: colors.textFaint,
    fontSize: 12,
  },
  time: {
    color: colors.textFaint,
    fontSize: 12,
  },
  newTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 'auto',
  },
  newDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accent,
  },
  newText: {
    color: colors.accentText,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
