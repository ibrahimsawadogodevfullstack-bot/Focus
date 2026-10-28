import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import YoutubePlayer from '../components/YoutubePlayer';
import { colors, spacing } from '../constants/theme';
import { formatClock, timeAgo } from '../utils/format';

export default function PlayerScreen({ queue, initialIndex = 0, onBack, onVideoChange }) {
  const [index, setIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [errorCode, setErrorCode] = useState(null);
  const playerRef = useRef(null);

  const video = queue[index];
  const nextVideo = queue[index + 1];

  useEffect(() => {
    if (video) onVideoChange?.(video);
  }, [video, onVideoChange]);

  const goToIndex = useCallback(
    (nextIndex) => {
      if (nextIndex < 0 || nextIndex >= queue.length) return;
      setErrorCode(null);
      setTime(0);
      setDuration(0);
      setIsPlaying(false);
      setIndex(nextIndex);
    },
    [queue.length],
  );

  const handleEvent = useCallback(
    (event) => {
      switch (event.type) {
        case 'state':
          setIsPlaying(event.state === 'playing');
          if (event.state === 'ended') {
            if (nextVideo) goToIndex(index + 1);
          }
          break;
        case 'progress':
          setTime(event.currentTime ?? 0);
          if (event.duration) setDuration(event.duration);
          break;
        case 'ready':
          if (event.duration) setDuration(event.duration);
          break;
        case 'error':
          setErrorCode(event.code);
          break;
        default:
          break;
      }
    },
    [goToIndex, index, nextVideo],
  );

  const confirmLeave = () => {
    Alert.alert(
      'Quitter le mode focus ?',
      'La vidéo s’ouvrira dans YouTube, avec les recommandations et l’interface complète.',
      [
        { text: 'Rester', style: 'cancel' },
        {
          text: 'Ouvrir YouTube',
          style: 'destructive',
          onPress: () => Linking.openURL(video.url),
        },
      ],
    );
  };

  if (!video) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.empty}>Vidéo introuvable.</Text>
      </SafeAreaView>
    );
  }

  const progressRatio = duration > 0 ? Math.min(1, time / duration) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Retour au flux"
          hitSlop={12}
          style={styles.backButton}
        >
          <Text style={styles.backIcon}>‹</Text>
          <Text style={styles.backLabel}>Flux</Text>
        </Pressable>
        <View style={styles.focusPill}>
          <View style={styles.focusDot} />
          <Text style={styles.focusText}>FOCUS</Text>
        </View>
      </View>

      <View style={styles.playerWrap}>
        <YoutubePlayer
          ref={playerRef}
          videoId={video.videoId}
          onEvent={handleEvent}
          style={styles.player}
        />
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { flex: progressRatio }]} />
        <View style={{ flex: 1 - progressRatio }} />
      </View>

      <View style={styles.controls}>
        <ControlButton label="−10 s" onPress={() => playerRef.current?.seekBy(-10)} />
        <Pressable
          onPress={() => playerRef.current?.toggle()}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Mettre en pause' : 'Lire'}
          style={styles.playButton}
        >
          <Text style={styles.playIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
        </Pressable>
        <ControlButton label="+10 s" onPress={() => playerRef.current?.seekBy(10)} />
        <ControlButton
          label="Suivant"
          disabled={!nextVideo}
          onPress={() => goToIndex(index + 1)}
        />
      </View>

      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatClock(time)}</Text>
        <Text style={styles.timeText}>{duration ? formatClock(duration) : '—:—'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.details} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{video.title}</Text>
        <Text style={styles.meta}>
          {video.channelTitle} · {timeAgo(video.publishedAt)}
        </Text>

        {errorCode ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Lecture intégrée indisponible</Text>
            <Text style={styles.errorText}>
              Cette vidéo refuse l’intégration. Tu peux l’ouvrir dans YouTube, mais tu
              quitteras le mode focus.
            </Text>
            <Pressable onPress={confirmLeave} style={styles.errorAction}>
              <Text style={styles.errorActionText}>Ouvrir dans YouTube</Text>
            </Pressable>
          </View>
        ) : null}

        {queue.length > 1 ? (
          <View style={styles.upNext}>
            <Text style={styles.sectionTitle}>À suivre</Text>
            <Text style={styles.sectionHint}>
              {index + 1} / {queue.length} · enchaînement automatique
            </Text>

            {queue.slice(index + 1, index + 4).map((item) => (
              <Pressable
                key={item.videoId}
                onPress={() => goToIndex(queue.findIndex((v) => v.videoId === item.videoId))}
                style={({ pressed }) => [styles.nextRow, pressed && styles.nextRowPressed]}
              >
                <Text style={styles.nextTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.nextMeta}>{item.channelTitle}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Pressable onPress={confirmLeave} style={styles.leaveButton}>
          <Text style={styles.leaveText}>Ouvrir dans YouTube (quitte le mode focus)</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ControlButton({ label, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.controlButton,
        pressed && styles.controlPressed,
        disabled && styles.controlDisabled,
      ]}
    >
      <Text style={styles.controlText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  backIcon: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 28,
  },
  backLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  focusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  focusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  focusText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  playerWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  player: {
    flex: 1,
  },
  progressTrack: {
    flexDirection: 'row',
    height: 3,
    backgroundColor: colors.surfaceAlt,
  },
  progressFill: {
    backgroundColor: colors.accent,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  controlButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  controlPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  controlDisabled: {
    opacity: 0.35,
  },
  controlText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  playButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  playIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  timeText: {
    color: colors.textFaint,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  details: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xl * 2,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 27,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  errorCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  errorAction: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorActionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  upNext: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionHint: {
    color: colors.textFaint,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  nextRow: {
    paddingVertical: spacing.md,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 3,
  },
  nextRowPressed: {
    backgroundColor: colors.surface,
  },
  nextTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  nextMeta: {
    color: colors.textFaint,
    fontSize: 12,
  },
  leaveButton: {
    marginTop: spacing.lg,
    alignSelf: 'center',
    padding: spacing.sm,
  },
  leaveText: {
    color: colors.textFaint,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  empty: {
    color: colors.textMuted,
    margin: spacing.xl,
  },
});
