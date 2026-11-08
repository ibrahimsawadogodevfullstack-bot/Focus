import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '../src/shared/theme/tokens';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';
import * as DM from '../services/downloadManager';
import type { DownloadRecord } from '../src/db/downloads';

export default function OfflinePlayerScreen({
  download,
  onBack,
}: {
  download: DownloadRecord;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemeStyles(baseStyles);
  const { t } = useTranslation(['downloads', 'common']);
  const player = useVideoPlayer(download.filePath ?? '', (p) => {
    p.loop = false;
  });
  const [rate, setRate] = useState(1);
  const viewRef = useRef<any>(null);

  useEffect(() => {
    if (download.lastPositionSec && download.lastPositionSec > 0) {
      const t = setTimeout(() => {
        try { player.seekBy(download.lastPositionSec); } catch {}
      }, 300);
      return () => clearTimeout(t);
    }
  }, [player, download.lastPositionSec]);

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        DM.updateLastPosition(download.id, player.currentTime ?? 0);
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [player, download.id]);

  const speeds = [1, 1.25, 1.5, 2];

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.playerWrap}>
        <VideoView ref={viewRef} player={player} style={styles.video} nativeControls />
      </View>
      <View style={styles.controls}>
        <Pressable onPress={onBack} style={styles.btn}>
          <Text style={styles.btnText}>{t('common:close')}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            const next = speeds[(speeds.indexOf(rate) + 1) % speeds.length];
            setRate(next);
            player.playbackRate = next;
          }}
          style={styles.btn}
        >
          <Text style={styles.btnText}>{rate}x</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            try { viewRef.current?.enterFullscreen?.(); } catch {}
          }}
          style={styles.btn}
        >
          <Text style={styles.btnText}>Fullscreen</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  playerWrap: { flex: 1, backgroundColor: '#000' },
  video: { width: '100%', height: '100%' },
  controls: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    justifyContent: 'center',
  },
  btn: {
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: colors.text, fontWeight: '600' },
});
