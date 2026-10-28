import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../constants/theme';
import { timeAgo } from '../utils/format';

export default function VideoRow({ video, isNew, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${video.title} — ${video.channelTitle}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.thumbnailWrap}>
        <Image
          source={{ uri: `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg` }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
        {isNew ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>NOUVEAU</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={2}>
          {video.title}
        </Text>
        <Text style={styles.channel} numberOfLines={1}>
          {video.channelTitle}
        </Text>
        <Text style={styles.time}>{timeAgo(video.publishedAt)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 14,
  },
  pressed: {
    backgroundColor: colors.surface,
  },
  thumbnailWrap: {
    width: 132,
    aspectRatio: 16 / 9,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: colors.newBadge,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#06281c',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  meta: {
    flex: 1,
    gap: 3,
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  channel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  time: {
    color: colors.textFaint,
    fontSize: 12,
  },
});
