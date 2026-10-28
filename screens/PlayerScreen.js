import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chevron, LockIcon, PauseIcon, PlayIcon } from '../components/Icons';
import YoutubePlayer from '../components/YoutubePlayer';
import { colors, radius, spacing } from '../constants/theme';
import { formatClock, timeAgo } from '../utils/format';

const thumbnail = (videoId) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

// Une page = une vidéo plein écran. Le lecteur n'est monté que pour la page
// visible ; les autres affichent la miniature (une seule WebView à la fois).
function VideoPage({
  video,
  height,
  active,
  isLast,
  onEnded,
  onSeen,
  onShortDetected,
}) {
  const insets = useSafeAreaInsets();
  const playerRef = useRef(null);
  const trackRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const [errorCode, setErrorCode] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const [shortNotice, setShortNotice] = useState(false);
  const flaggedShort = useRef(false);

  useEffect(() => {
    if (active) onSeen?.(video);
  }, [active, onSeen, video]);

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

  const handleEvent = useCallback(
    (event) => {
      switch (event.type) {
        case 'state':
          setIsPlaying(event.state === 'playing');
          if (event.state === 'ended') onEnded?.();
          break;
        case 'progress':
          setTime(event.currentTime ?? 0);
          if (event.duration) {
            setDuration(event.duration);
            // Un format très court est presque toujours un Short : on le
            // signale et il disparaîtra du flux aux prochains chargements.
            if (
              event.duration > 0 &&
              event.duration <= 65 &&
              !flaggedShort.current
            ) {
              flaggedShort.current = true;
              onShortDetected?.(video.videoId);
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
    [onEnded, onShortDetected, video.videoId],
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
      node.measure((x, y, width, heightValue, originX) => {
        if (width > 0) seekToRatio((pageX - originX) / width);
      });
    }
  };

  const progressRatio = duration > 0 ? Math.min(1, time / duration) : 0;
  const initial = (video.channelTitle || '?').trim().charAt(0).toUpperCase();
  const notice = blocked ? 'Sortie bloquée — tu restes dans Focus' : null;
  const shortPill = shortNotice ? 'Short masqué' : null;

  return (
    <View style={[styles.page, { height }]}>
      <View style={styles.playerWrap}>
        {active ? (
          <YoutubePlayer
            ref={playerRef}
            videoId={video.videoId}
            onEvent={handleEvent}
            style={styles.player}
          />
        ) : (
          <Image
            source={{ uri: thumbnail(video.videoId) }}
            style={styles.poster}
            resizeMode="cover"
          />
        )}
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
            disabled={!active}
            accessibilityRole="button"
            accessibilityLabel="Reculer de dix secondes"
            style={({ pressed }) => [styles.round, pressed && styles.roundPressed]}
          >
            <Text style={styles.roundText}>−10</Text>
          </Pressable>

          <Pressable
            onPress={() => playerRef.current?.toggle()}
            disabled={!active}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Mettre en pause' : 'Lire'}
            style={({ pressed }) => [styles.play, pressed && styles.playPressed]}
          >
            {isPlaying ? <PauseIcon size={17} /> : <PlayIcon size={19} />}
          </Pressable>

          <Pressable
            onPress={() => playerRef.current?.seekBy(10)}
            disabled={!active}
            accessibilityRole="button"
            accessibilityLabel="Avancer de dix secondes"
            style={({ pressed }) => [styles.round, pressed && styles.roundPressed]}
          >
            <Text style={styles.roundText}>+10</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.info}>
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
          <Text style={styles.meta}>{timeAgo(video.publishedAt)}</Text>
        </View>

        {notice || shortPill ? (
          <View style={[styles.notice, blocked && styles.noticeBlocked]}>
            <LockIcon color={blocked ? colors.danger : colors.accentText} size={10} />
            <Text style={[styles.noticeText, blocked && styles.noticeTextBlocked]}>
              {notice || shortPill}
            </Text>
          </View>
        ) : null}

        {errorCode ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Lecture intégrée indisponible</Text>
            <Text style={styles.errorText}>
              Le propriétaire refuse l’intégration, ou la vidéo n’est plus disponible. Aucun lien
              de sortie n’est proposé : le mode focus reste actif.
            </Text>
            <Text style={styles.errorHint}>
              {isLast ? 'Fin de la liste.' : 'Glisse vers le haut pour la vidéo suivante.'}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.pageFoot, { paddingBottom: spacing.md + insets.bottom }]}>
        <View style={styles.lockNote}>
          <LockIcon color={colors.textFaint} size={10} />
          <Text style={styles.lockNoteText}>
            Lecteur YouTube officiel. Les sorties vers YouTube sont bloquées.
          </Text>
        </View>

        <View style={styles.swipeRow}>
          {!isLast ? (
            <>
              <Chevron direction="up" color={colors.accentText} size={8} thickness={2} />
              <Text style={styles.swipeText}>Glisse vers le haut pour la suite</Text>
            </>
          ) : (
            <Text style={styles.swipeText}>Fin de la liste</Text>
          )}
        </View>
      </View>
    </View>
  );
}

export default function PlayerScreen({ queue, initialIndex = 0, onBack, onVideoChange, onShortDetected }) {
  const [index, setIndex] = useState(initialIndex);
  const [pageHeight, setPageHeight] = useState(0);
  const listRef = useRef(null);
  const snapTimer = useRef(null);

  const goToIndex = useCallback(
    (target) => {
      if (target < 0 || target >= queue.length || !pageHeight) return;
      setIndex(target);
      listRef.current?.scrollToOffset({ offset: target * pageHeight, animated: true });
    },
    [pageHeight, queue.length],
  );

  const handleScroll = useCallback(
    (event) => {
      if (!pageHeight) return;
      const offset = event.nativeEvent.contentOffset.y;
      const next = Math.min(
        queue.length - 1,
        Math.max(0, Math.round(offset / pageHeight)),
      );

      setIndex((current) => (current === next ? current : next));

      // Le web ne gère pas l'aimantation des pages : on recale après le geste.
      if (Platform.OS !== 'web') return;
      if (snapTimer.current) clearTimeout(snapTimer.current);
      snapTimer.current = setTimeout(() => {
        const target = Math.round(offset / pageHeight) * pageHeight;
        if (Math.abs(offset - target) > 2) {
          listRef.current?.scrollToOffset({ offset: target, animated: true });
        }
      }, 160);
    },
    [pageHeight, queue.length],
  );

  useEffect(
    () => () => {
      if (snapTimer.current) clearTimeout(snapTimer.current);
    },
    [],
  );

  if (!queue || queue.length === 0) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.empty}>Vidéo introuvable.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Retour à l’accueil"
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <Chevron direction="left" color={colors.text} size={9} thickness={2} />
          <Text style={styles.backLabel}>Accueil</Text>
        </Pressable>

        <View style={styles.focusPill}>
          <LockIcon color={colors.accentText} size={10} />
          <Text style={styles.focusText} numberOfLines={1}>
            Mode focus
          </Text>
        </View>

        <Text style={styles.counter}>
          {index + 1} / {queue.length}
        </Text>
      </View>

      <View
        style={styles.listWrap}
        onLayout={(event) => setPageHeight(event.nativeEvent.layout.height)}
      >
        {pageHeight > 0 ? (
          <FlatList
            ref={listRef}
            data={queue}
            keyExtractor={(item) => item.videoId}
            renderItem={({ item, index: itemIndex }) => (
              <VideoPage
                video={item}
                height={pageHeight}
                active={itemIndex === index}
                isLast={itemIndex === queue.length - 1}
                onEnded={() => goToIndex(itemIndex + 1)}
                onSeen={onVideoChange}
                onShortDetected={onShortDetected}
              />
            )}
            getItemLayout={(_, itemIndex) => ({
              length: pageHeight,
              offset: pageHeight * itemIndex,
              index: itemIndex,
            })}
            initialScrollIndex={Math.min(initialIndex, queue.length - 1)}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            windowSize={3}
            pagingEnabled
            snapToInterval={pageHeight}
            decelerationRate="fast"
            disableIntervalMomentum
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          />
        ) : null}
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
  counter: {
    color: colors.textFaint,
    fontSize: 12.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    minWidth: 64,
    textAlign: 'right',
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
  focusText: {
    color: colors.accentText,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  listWrap: {
    flex: 1,
  },
  page: {
    width: '100%',
    backgroundColor: colors.bg,
  },
  playerWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  player: {
    flex: 1,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  notice: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentLine,
  },
  noticeBlocked: {
    borderColor: colors.danger,
  },
  noticeText: {
    color: colors.accentText,
    fontSize: 11,
    fontWeight: '700',
  },
  noticeTextBlocked: {
    color: colors.danger,
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
  info: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 26,
    letterSpacing: -0.4,
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
  errorHint: {
    color: colors.textFaint,
    fontSize: 11.5,
  },
  pageFoot: {
    marginTop: 'auto',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  lockNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lockNoteText: {
    flex: 1,
    color: colors.textFaint,
    fontSize: 10.5,
    lineHeight: 15,
  },
  swipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 26,
  },
  swipeText: {
    color: colors.accentText,
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    padding: spacing.xl,
  },
});
