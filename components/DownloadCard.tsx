import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { colors, radius, spacing } from '../src/shared/theme/tokens';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';
import { MoreIcon } from '../src/shared/ui/Icons';
import { formatBytes } from '../services/localVideos';
import type { DownloadRecord } from '../src/db/downloads';

export default function DownloadCard({
  download,
  onPress,
  onMenu,
}: {
  download: DownloadRecord;
  onPress: () => void;
  onMenu: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemeStyles(baseStyles);
  const thumb = download.thumbnailLocalPath || null;
  const size = formatBytes(download.sizeBytes);
  const date = new Date(download.createdAt).toLocaleDateString();
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.thumbWrap}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, { backgroundColor: colors.surfaceAlt }]} />
        )}
        {download.durationSec > 0 ? (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>
              {Math.floor(download.durationSec / 60)}:
              {String(download.durationSec % 60).padStart(2, '0')}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {download.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {download.channelName} · {size} · {date}
        </Text>
      </View>
      <Pressable onPress={onMenu} hitSlop={8} style={styles.menu}>
        <MoreIcon color={colors.textMuted} size={18} />
      </Pressable>
    </Pressable>
  );
}

const baseStyles = StyleSheet.create({
  card: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, alignItems: 'center' },
  thumbWrap: { width: 120, aspectRatio: 16 / 9, borderRadius: radius.md, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  durationBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  body: { flex: 1, gap: 4 },
  title: { color: colors.text, fontSize: 14, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 12 },
  menu: { padding: spacing.sm },
});
