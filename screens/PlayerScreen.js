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

import { FocusMark } from '../components/FocusMark';
import { PauseIcon, PlayIcon } from '../components/Icons';
import YoutubePlayer from '../components/YoutubePlayer';
import { colors, radius, spacing } from '../constants/theme';
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
          if (event.state === 'ended' && nextVideo) {
            goToIndex(index + 1);
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
      'Ouvrir dans YouTube ?',
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
  const initial = (video.channelTitle || '?').trim().charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Retour au flux"
          hitSlop={12}
          style={styles.back}
        >
          <Text style={styles.backIcon}>‹</Text>
          <Text style={styles.backLabel}>Flux</Text>
        </Pressable>

        <View style={styles.focusPill}>
          <FocusMark size={14} />
          <Text style={styles.focusText}>FOCUS</Text>
        </View>

        <Pressable
          onPress={() => goToIndex(index + 1)}
          disabled={!nextVideo}
          accessibilityRole="button"
          accessibilityLabel="Vidéo suivante"
          hitSlop={12}
          style={[styles.next, !nextVideo && styles.nextDisabled]}
        >
          <Text style={styles.nextText}>Suivant</Text>
          <Text style={styles.nextIcon}>›</Text>
        </Pressable>
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

      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatClock(time)}</Text>
        <Text style={styles.timeText}>{duration ? formatClock(duration) : '—:—'}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable
          onPress={() => playerRef.current?.seekBy(-10)}
          accessibilityRole="button"
          accessibilityLabel="Reculer de dix secondes"
          style={({ pressed }) => [styles.round, pressed && styles.roundPressed]}
        >
          <Text style={styles.roundText}>−10</Text>
        </Pressable>

        <Pressable
          onPress={() => playerRef.current?.toggle()}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Mettre en pause' : 'Lire'}
          style={({ pressed }) => [styles.playButton, pressed && styles.playPressed]}
        >
          {isPlaying ? <PauseIcon size={15} /> : <PlayIcon size={18} />}
        </Pressable>

        <Pressable
          onPress={() => playerRef.current?.seekBy(10)}
          accessibilityRole="button"
          accessibilityLabel="Avancer de dix secondes"
          style={({ pressed }) => [styles.round, pressed && styles.roundPressed]}
        >
          <Text style={styles.roundText}>+10</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.details} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{video.title}</Text>

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

        {errorCode ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Lecture intégrée indisponible</Text>
            <Text style={styles.errorText}>
              Le propriétaire refuse l’intégration, ou la vidéo n’est plus
              disponible. Tu peux l’ouvrir dans YouTube — tu quitteras le mode
              focus.
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

            {queue.slice(index + 1, index + 4).map((item, offset) => (
              <Pressable
                key={item.videoId}
                onPress={() => goToIndex(index + 1 + offset)}
                style={({ pressed }) => [styles.nextRow, pressed && styles.nextRowPressed]}
              >
                <Text style={styles.nextIndex}>{String(index + 2 + offset).padStart(2, '0')}</Text>
                <View style={styles.nextMeta}>
                  <Text style={styles.nextTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.nextChannel}>{item.channelTitle}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Pressable onPress={confirmLeave} style={styles.leaveButton}>
          <Text style={styles.leaveText}>Ouvrir dans YouTube</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
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
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 68,
    paddingVertical: 6,
  },
  backIcon: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 28,
    marginTop: -2,
  },
  backLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  focusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  focusText: {
    color: colors.textMuted,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 68,
    justifyContent: 'flex-end',
    paddingVertical: 6,
  },
  nextDisabled: {
    opacity: 0.25,
  },
  nextText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  nextIcon: {
    color: colors.textMuted,
    fontSize: 20,
    lineHeight: 22,
    marginTop: -1,
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
    height: 2,
    backgroundColor: colors.surfaceAlt,
  },
  progressFill: {
    backgroundColor: colors.accent,
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
    letterSpacing: 0.3,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  roundPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  roundText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  playButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  playPressed: {
    opacity: 0.85,
  },
  details: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 27,
    letterSpacing: -0.4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
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
  errorCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 18,
  },
  errorAction: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 2,
  },
  errorActionText: {
    color: colors.accent,
    fontSize: 12.5,
    fontWeight: '700',
  },
  upNext: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sectionHint: {
    color: colors.textFaint,
    fontSize: 11.5,
    marginBottom: spacing.xs,
  },
  nextRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  nextRowPressed: {
    opacity: 0.7,
  },
  nextIndex: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingTop: 2,
    fontVariant: ['tabular-nums'],
  },
  nextMeta: {
    flex: 1,
    gap: 3,
  },
  nextTitle: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 19,
  },
  nextChannel: {
    color: colors.textFaint,
    fontSize: 11.5,
  },
  leaveButton: {
    marginTop: spacing.lg,
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
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
