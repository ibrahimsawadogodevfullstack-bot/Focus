import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chevron, LockIcon, PauseIcon, PlayIcon } from '../components/Icons';
import YoutubePlayer from '../components/YoutubePlayer';
import { colors, radius, spacing } from '../constants/theme';
import { formatClock, timeAgo } from '../utils/format';

export default function PlayerScreen({
  queue,
  initialIndex = 0,
  onBack,
  onVideoChange,
  onShortDetected,
}) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [errorCode, setErrorCode] = useState(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [shortNotice, setShortNotice] = useState(false);
  const playerRef = useRef(null);
  const trackRef = useRef(null);
  const flaggedShorts = useRef(new Set());

  const video = queue[index];
  const nextVideo = queue[index + 1];

  useEffect(() => {
    if (video) onVideoChange?.(video);
  }, [video, onVideoChange]);

  // Signal visuel bref quand une sortie vers YouTube est interceptée.
  useEffect(() => {
    if (!blocked) return undefined;
    const timer = setTimeout(() => setBlocked(false), 2600);
    return () => clearTimeout(timer);
  }, [blocked]);

  useEffect(() => {
    if (!shortNotice) return undefined;
    const timer = setTimeout(() => setShortNotice(false), 3200);
    return () => clearTimeout(timer);
  }, [shortNotice]);

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
          if (event.duration) {
            setDuration(event.duration);
            const id = video?.videoId;
            // Un format très court est presque toujours un Short : on le
            // signale et il disparaîtra du flux aux prochains chargements.
            if (
              event.duration > 0 &&
              event.duration <= 65 &&
              id &&
              !flaggedShorts.current.has(id)
            ) {
              flaggedShorts.current.add(id);
              onShortDetected?.(id);
              setShortNotice(true);
            }
          }
          break;
        case 'ready':
          if (event.duration) setDuration(event.duration);
          break;
        case 'error':
          setErrorCode(event.code);
          break;
        case 'exitBlocked':
          setBlocked(true);
          break;
        default:
          break;
      }
    },
    [goToIndex, index, nextVideo, onShortDetected, video],
  );

  const seekToRatio = (ratio) => {
    if (!duration) return;
    const target = Math.min(duration, Math.max(0, ratio * duration));
    setTime(target);
    playerRef.current?.seekTo(target);
  };

  // Clic sur la barre de progression. Sur mobile la position est relative au
  // doigt (locationX) ; sur le web elle est relative à la page (pageX), donc on
  // mesure la piste dans le DOM.
  const handleTrackPress = (event) => {
    const { locationX, pageX } = event.nativeEvent ?? {};
    const node = trackRef.current;

    if (typeof locationX === 'number' && Number.isFinite(locationX) && trackWidth > 0) {
      seekToRatio(locationX / trackWidth);
      return;
    }

    if (typeof pageX !== 'number') return;

    if (node && typeof node.getBoundingClientRect === 'function') {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0) seekToRatio((pageX - rect.left) / rect.width);
      return;
    }

    if (node && typeof node.measure === 'function') {
      node.measure((x, y, width, height, originX) => {
        if (width > 0) seekToRatio((pageX - originX) / width);
      });
    }
  };

  if (!video) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.empty}>Vidéo introuvable.</Text>
      </SafeAreaView>
    );
  }

  const progressRatio = duration > 0 ? Math.min(1, time / duration) : 0;
  const initial = (video.channelTitle || '?').trim().charAt(0).toUpperCase();
  const upNext = queue.slice(index + 1, index + 4);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Retour au flux"
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <Chevron direction="left" color={colors.text} size={9} thickness={2} />
          <Text style={styles.backLabel}>Flux</Text>
        </Pressable>

        <View style={[styles.focusPill, blocked && styles.focusPillBlocked]}>
          <LockIcon color={blocked ? colors.danger : colors.accentText} size={10} />
          <Text style={[styles.focusText, blocked && styles.focusTextBlocked]} numberOfLines={1}>
            {blocked ? 'Sortie bloquée' : shortNotice ? 'Short masqué' : 'Mode focus'}
          </Text>
        </View>

        <Pressable
          onPress={() => goToIndex(index + 1)}
          disabled={!nextVideo}
          accessibilityRole="button"
          accessibilityLabel="Vidéo suivante"
          style={({ pressed }) => [
            styles.next,
            !nextVideo && styles.nextDisabled,
            pressed && styles.nextPressed,
          ]}
        >
          <Text style={styles.nextLabel}>Suivant</Text>
          <Chevron direction="right" color={colors.textMuted} size={8} thickness={2} />
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

      <View style={styles.controls}>
        <Pressable
          ref={trackRef}
          onPress={handleTrackPress}
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
          accessibilityRole="adjustable"
          accessibilityLabel="Progression de la vidéo"
          accessibilityValue={{
            min: 0,
            max: Math.round(duration),
            now: Math.round(time),
            text: `${formatClock(time)} sur ${formatClock(duration)}`,
          }}
          style={styles.trackHit}
        >
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${progressRatio * 100}%` }]}>
              <View style={styles.trackThumb} />
            </View>
          </View>
        </Pressable>

        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatClock(time)}</Text>
          <Text style={styles.timeText}>{duration ? formatClock(duration) : '—:—'}</Text>
        </View>

        <View style={styles.buttons}>
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
            style={({ pressed }) => [styles.play, pressed && styles.playPressed]}
          >
            {isPlaying ? <PauseIcon size={17} /> : <PlayIcon size={19} />}
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
      </View>

      <ScrollView
        contentContainerStyle={[styles.details, { paddingBottom: spacing.xxl + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{video.title}</Text>

        <View style={styles.metaRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.channel} numberOfLines={1}>
            {video.channelTitle}
          </Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.meta}>{timeAgo(video.publishedAt)}</Text>
        </View>

        {errorCode ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Lecture intégrée indisponible</Text>
            <Text style={styles.errorText}>
              Le propriétaire refuse l’intégration, ou la vidéo n’est plus disponible. Aucun lien
              de sortie n’est proposé : le mode focus reste actif.
            </Text>
            <Pressable
              onPress={() => (nextVideo ? goToIndex(index + 1) : onBack())}
              accessibilityRole="button"
              style={({ pressed }) => [styles.errorAction, pressed && styles.errorActionPressed]}
            >
              <Text style={styles.errorActionText}>
                {nextVideo ? 'Passer à la vidéo suivante' : 'Retour au flux'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {upNext.length > 0 ? (
          <View style={styles.upNext}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>À suivre</Text>
              <Text style={styles.sectionCount}>
                {index + 1} / {queue.length}
              </Text>
            </View>

            {upNext.map((item, offset) => (
              <Pressable
                key={item.videoId}
                onPress={() => goToIndex(index + 1 + offset)}
                accessibilityRole="button"
                accessibilityLabel={`Lire ${item.title}`}
                style={({ pressed }) => [styles.nextRow, pressed && styles.nextRowPressed]}
              >
                <Image
                  source={{ uri: `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` }}
                  style={styles.nextThumb}
                  resizeMode="cover"
                />
                <View style={styles.nextTexts}>
                  <Text style={styles.nextTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.nextChannel} numberOfLines={1}>
                    {item.channelTitle}
                  </Text>
                </View>
              </Pressable>
            ))}

            <Text style={styles.hint}>Enchaînement automatique en fin de vidéo.</Text>
          </View>
        ) : null}

        <View style={styles.lockNote}>
          <LockIcon color={colors.textFaint} size={10} />
          <Text style={styles.lockNoteText}>
            Lecteur YouTube officiel. Les sorties vers YouTube sont bloquées.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    height: 54,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 44,
    paddingRight: spacing.md,
  },
  backPressed: {
    opacity: 0.6,
  },
  backLabel: {
    color: colors.text,
    fontSize: 14.5,
    fontWeight: '600',
  },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 44,
    paddingLeft: spacing.md,
  },
  nextPressed: {
    opacity: 0.6,
  },
  nextDisabled: {
    opacity: 0.28,
  },
  nextLabel: {
    color: colors.text,
    fontSize: 14.5,
    fontWeight: '600',
  },
  focusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentLine,
    maxWidth: 150,
  },
  focusPillBlocked: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  focusText: {
    color: colors.accentText,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  focusTextBlocked: {
    color: colors.danger,
  },
  playerWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  player: {
    flex: 1,
  },
  controls: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  trackHit: {
    height: 30,
    justifyContent: 'center',
  },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.surfaceAlt,
    overflow: 'visible',
  },
  trackFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
    justifyContent: 'center',
  },
  trackThumb: {
    position: 'absolute',
    right: -5,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    color: colors.textFaint,
    fontSize: 11.5,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  round: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  roundPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  roundText: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  play: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  playPressed: {
    opacity: 0.85,
  },
  details: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 27,
    letterSpacing: -0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
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
  dot: {
    color: colors.textFaint,
    fontSize: 12,
  },
  meta: {
    color: colors.textFaint,
    fontSize: 12,
  },
  errorCard: {
    marginTop: spacing.md,
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
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
    marginTop: 2,
    paddingHorizontal: spacing.lg,
    height: 40,
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
  },
  errorActionPressed: {
    opacity: 0.7,
  },
  errorActionText: {
    color: colors.accentText,
    fontSize: 12.5,
    fontWeight: '700',
  },
  upNext: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sectionCount: {
    color: colors.textFaint,
    fontSize: 11.5,
    fontVariant: ['tabular-nums'],
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  nextRowPressed: {
    backgroundColor: colors.surface,
  },
  nextThumb: {
    width: 96,
    height: 54,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  nextTexts: {
    flex: 1,
    gap: 4,
  },
  nextTitle: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 18,
  },
  nextChannel: {
    color: colors.textFaint,
    fontSize: 11.5,
  },
  hint: {
    color: colors.textFaint,
    fontSize: 11.5,
    marginTop: spacing.xs,
  },
  lockNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xl,
  },
  lockNoteText: {
    flex: 1,
    color: colors.textFaint,
    fontSize: 11.5,
    lineHeight: 16,
  },
  empty: {
    color: colors.textMuted,
    margin: spacing.xl,
  },
});
