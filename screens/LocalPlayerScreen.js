import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chevron, DownloadIcon, PauseIcon, PlayIcon } from '../src/shared/ui/Icons';
import { colors, radius, spacing } from '../src/shared/theme/tokens';
import { formatBytes } from '../services/localVideos';
import { formatClock } from '../src/shared/utils/format';

const SPEEDS = [1, 1.25, 1.5, 2];

/** Lecteur local : un fichier vidéo de l'appareil, sans réseau. */
export default function LocalPlayerScreen({ entry, onBack, onDuration }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [trackX, setTrackX] = useState(0);
  const trackRef = useRef(null);
  const [duration, setDuration] = useState(entry?.duration ?? 0);
  const [rate, setRate] = useState(1);
  const reported = useRef(false);

  const player = useVideoPlayer(entry?.uri ?? '', (instance) => {
    instance.timeUpdateEventInterval = 0.5;
    instance.play();
  });

  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });
  const { currentTime } = useEvent(player, 'timeUpdate', { currentTime: 0 });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  useEffect(() => {
    if (status !== 'readyToPlay') return;
    const total = player.duration;
    if (!Number.isFinite(total) || total <= 0) return;
    setDuration(total);
    if (!reported.current) {
      reported.current = true;
      onDuration?.(entry?.id, total);
    }
  }, [status, player, entry?.id, onDuration]);

  useEffect(
    () => () => {
      try {
        player.pause();
      } catch {
        // Le lecteur est déjà libéré.
      }
    },
    [player],
  );

  useEventListener(player, 'playToEnd', () => {
    player.pause();
  });

  if (!entry) {
    return (
      <SafeAreaView edges={['top']} style={styles.screen}>
        <Text style={styles.errorText}>Vidéo introuvable.</Text>
      </SafeAreaView>
    );
  }

  const ratio = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const ready = status === 'readyToPlay';
  const failed = status === 'error';

  const seekTo = (seconds) => {
    if (!Number.isFinite(seconds)) return;
    player.currentTime = Math.max(0, Math.min(duration || seconds, seconds));
  };

  // `locationX` n'est pas fourni par react-native-web : on retombe sur `pageX`
  // relatif à la position mesurée de la piste.
  const seekFromPress = (event) => {
    const { locationX, pageX } = event.nativeEvent;
    const width = trackWidth;
    if (!width || !duration) return;
    const x = typeof locationX === 'number' ? locationX : pageX - trackX;
    seekTo((x / width) * duration);
  };

  const measureTrack = () => {
    trackRef.current?.measureInWindow?.((x, y, width) => {
      setTrackX(x);
      if (width) setTrackWidth(width);
    });
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length];
    setRate(next);
    player.playbackRate = next;
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Retour à l’onglet Hors ligne"
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Chevron direction="left" color={colors.text} size={9} thickness={2} />
          <Text style={styles.backLabel}>Hors ligne</Text>
        </Pressable>

        <View style={styles.pill}>
          <DownloadIcon color={colors.accentText} size={11} thickness={2} />
          <Text style={styles.pillText}>Lecture locale</Text>
        </View>
      </View>

      <View style={styles.videoWrap}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls={false}
          fullscreenOptions={{ enable: true }}
        />

        {!ready && !failed ? (
          <View pointerEvents="none" style={styles.loading}>
            <ActivityIndicator color={colors.accentText} />
          </View>
        ) : null}

        {failed ? (
          <View style={styles.loading}>
            <Text style={styles.errorText}>Fichier illisible sur cet appareil.</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.controls}>
        <Pressable
          ref={trackRef}
          onPress={seekFromPress}
          accessibilityRole="adjustable"
          accessibilityLabel="Progression de la vidéo"
          accessibilityValue={{ min: 0, max: Math.round(duration), now: Math.round(currentTime) }}
          style={styles.trackTouch}
          onLayout={(event) => {
            setTrackWidth(event.nativeEvent.layout.width);
            measureTrack();
          }}
        >
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${ratio * 100}%` }]} />
            <View style={[styles.knob, { left: `${ratio * 100}%` }]} />
          </View>
        </Pressable>

        <View style={styles.times}>
          <Text style={styles.time}>{formatClock(currentTime)}</Text>
          <Text style={styles.time}>{duration > 0 ? formatClock(duration) : '—:—'}</Text>
        </View>

        <View style={styles.transport}>
          <Pressable
            onPress={() => player.seekBy(-10)}
            accessibilityRole="button"
            accessibilityLabel="Reculer de dix secondes"
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
          >
            <Text style={styles.skipText}>−10</Text>
          </Pressable>

          <Pressable
            onPress={() => (isPlaying ? player.pause() : player.play())}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Mettre en pause' : 'Lire'}
            style={({ pressed }) => [styles.play, pressed && styles.pressed]}
          >
            {isPlaying ? (
              <PauseIcon color={colors.onAccent} size={20} />
            ) : (
              <PlayIcon color={colors.onAccent} size={21} />
            )}
          </Pressable>

          <Pressable
            onPress={() => player.seekBy(10)}
            accessibilityRole="button"
            accessibilityLabel="Avancer de dix secondes"
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
          >
            <Text style={styles.skipText}>+10</Text>
          </Pressable>

          <Pressable
            onPress={cycleSpeed}
            accessibilityRole="button"
            accessibilityLabel={`Vitesse de lecture ${rate} fois`}
            style={({ pressed }) => [styles.speed, pressed && styles.pressed]}
          >
            <Text style={styles.speedText}>{rate}×</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={3}>
          {entry.title}
        </Text>
        <Text style={styles.meta}>
          Vidéo de l’appareil · {formatBytes(entry.size)} · lisible sans réseau
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 44,
  },
  backLabel: {
    color: colors.text,
    fontSize: 14.5,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: colors.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentLine,
  },
  pillText: {
    color: colors.accentText,
    fontSize: 11,
    fontWeight: '700',
  },
  videoWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  errorText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  controls: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    paddingBottom: spacing.md,
  },
  trackTouch: {
    height: 28,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
  },
  trackFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  knob: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
    backgroundColor: colors.accentText,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  time: {
    color: colors.textFaint,
    fontSize: 11.5,
    fontWeight: '600',
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  skip: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  skipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  play: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  speed: {
    position: 'absolute',
    right: 0,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  speedText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 25,
  },
  meta: {
    color: colors.textFaint,
    fontSize: 12.5,
    fontWeight: '500',
  },
});
