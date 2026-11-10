import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import {
  Chevron,
  FullscreenIcon,
  LockIcon,
  MinimizeIcon,
  PauseIcon,
  PlayIcon,
} from '../src/shared/ui/Icons';
import ChannelAvatar from '../src/shared/ui/ChannelAvatar';
import Chip from '../src/shared/ui/Chip';
import VideoThumbnail from '../src/shared/ui/media/VideoThumbnail';
import YoutubePlayer from '../components/YoutubePlayer';
import { colors, fontSize, radius, spacing } from '../src/shared/theme/tokens';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';
import { FORMAT_SHORT, FORMAT_VIDEO, formatOf } from '../src/domain/videoFormat';
import { resolveVideoCategory } from '../src/domain/categories';
import {
  getTracking,
  markOpened,
  setRating,
  trackPlayback,
  trackReplay,
} from '../services/tracking';
import {
  viewingBegin,
  viewingEnd,
  viewingProgress,
  viewingSetPlaying,
} from '../services/viewingStats';
import { formatClock, timeAgo } from '../src/shared/utils/format';

const RATINGS = [
  { key: 'fragile', labelKey: 'ratingFragile', hintKey: 'ratingFragileHint' },
  { key: 'moyen', labelKey: 'ratingMedium', hintKey: 'ratingMediumHint' },
  { key: 'solide', labelKey: 'ratingSolid', hintKey: 'ratingSolidHint' },
];

const FLUSH_EVERY = 5;
// Assez long pour lire le titre et viser un bouton sans que l'overlay
// disparaisse sous le doigt.
const CONTROLS_HIDE_DELAY = 4000;
// Fenêtre du double-tap « ±10 s » sur la zone vidéo.
const DOUBLE_TAP_DELAY = 320;
const KEEP_AWAKE_TAG = 'focus-player';

/**
 * Position à laquelle reprendre une vidéo.
 *
 * On ignore le tout début (moins de 5 s vus) et la fin (à moins de 10 s du
 * générique), sinon « reprendre » ramènerait au même point qu'un démarrage
 * normal. `fallbackPosition` sert quand la position courante n'a pas encore été
 * écrite dans le stockage (page quittée avant le prochain flush).
 */
function readResumeAt(videoId, fallbackPosition = null, fallbackDuration = 0) {
  const entry = getTracking().videos?.[videoId];
  const position = fallbackPosition ?? entry?.position ?? 0;
  const total = entry?.duration || fallbackDuration || 0;
  if (!Number.isFinite(position) || position < 5) return 0;
  if (total > 0 && position > total - 10) return 0;
  return Math.floor(position);
}

// Une page = une vidéo. Le lecteur n'est monté que pour la page visible ; les
// autres affichent la miniature (une seule WebView à la fois).
//
// Deux présentations :
//   - verticale (Short) : le lecteur occupe tout l'écran dès l'ouverture,
//     contrôles en surimpression — comme Reels/Shorts ;
//   - horizontale : lecteur 16:9, puis contrôles et détails, avec un bouton
//     plein écran qui bascule dans la présentation immersive.
function VideoPage({
  video,
  height,
  active,
  isLast,
  avatars,
  categories = [],
  formats = {},
  playbackSpeed = 1,
  subtitles = false,
  dataSaver = false,
  onEnded,
  onNext,
  onSeen,
}) {
  const { colors } = useTheme();
  const styles = useThemeStyles(baseStyles);
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'fr';
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const vertical = formatOf(video, formats) === FORMAT_SHORT;
  // Plein écran par défaut pour le vertical, sur demande pour l'horizontal.
  const [immersive, setImmersive] = useState(vertical);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimerRef = useRef(null);
  const playerRef = useRef(null);
  const trackRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const [playerAreaHeight, setPlayerAreaHeight] = useState(0);
  const [controlsHeight, setControlsHeight] = useState(0);
  // Position de reprise lue au montage : elle est rafraîchie à chaque sortie
  // de page pour que revenir en arrière reprenne où on s'était arrêté.
  const [resumeAt, setResumeAt] = useState(() => readResumeAt(video.videoId));
  const [seekFeedback, setSeekFeedback] = useState(null);
  const lastTapRef = useRef({ at: 0, x: 0 });
  const feedbackTimerRef = useRef(null);
  const [errorCode, setErrorCode] = useState(null);
  const [playerKey, setPlayerKey] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [rating, setRatingState] = useState(
    () => getTracking().videos?.[video.videoId]?.rating ?? null,
  );
  const [replays, setReplays] = useState(
    () => getTracking().videos?.[video.videoId]?.replays ?? 0,
  );
  const [lastReplayAt, setLastReplayAt] = useState(
    () => getTracking().videos?.[video.videoId]?.lastReplayAt ?? null,
  );
  const lastTimeRef = useRef(null);
  const durationRef = useRef(0);
  const playingRef = useRef(false);
  const pendingRef = useRef(0);

  const clearControlsTimer = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = null;
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearControlsTimer();
    // Hors immersif, les contrôles et les détails restent affichés. En pause
    // aussi : on ne cache jamais l'interface sous le doigt de l'utilisateur.
    if (immersive && playingRef.current) {
      controlsTimerRef.current = setTimeout(
        () => setControlsVisible(false),
        CONTROLS_HIDE_DELAY,
      );
    }
  }, [clearControlsTimer, immersive]);

  const mediaActive = isPlaying || buffering;

  useEffect(() => {
    clearControlsTimer();
    setControlsVisible(true);

    if (!active || !immersive || !mediaActive) return undefined;

    controlsTimerRef.current = setTimeout(
      () => setControlsVisible(false),
      CONTROLS_HIDE_DELAY,
    );

    return clearControlsTimer;
  }, [active, clearControlsTimer, immersive, mediaActive, video.videoId]);

  const flush = useCallback(
    (completed = false) => {
      const seconds = pendingRef.current;
      if (seconds <= 0 && !completed) return;
      pendingRef.current = 0;
      trackPlayback({
        video,
        seconds,
        position: lastTimeRef.current ?? 0,
        duration: durationRef.current,
        completed,
      });
    },
    [video],
  );

  // Sauvegarde du temps vu quand on quitte la page.
  useEffect(() => () => flush(false), [flush]);

  useEffect(() => {
    // Le lecteur n'est monté que sur la page visible : on solde le temps vu
    // en quittant la page, et on repart de zéro quand on y revient.
    if (!active) {
      const lastPosition = lastTimeRef.current;
      flush(false);
      playingRef.current = false;
      setBuffering(false);
      setPlayerReady(false);
      setResumeAt(readResumeAt(video.videoId, lastPosition, durationRef.current));
    }
    lastTimeRef.current = null;
  }, [active, flush, video.videoId]);

  // L'écran ne doit pas s'éteindre pendant une vidéo : c'est le seul cas où
  // l'utilisateur reste les mains loin du téléphone. Le tag est partagé, donc
  // deux pages ne peuvent pas se désactiver mutuellement.
  useEffect(() => {
    if (!active) return undefined;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [active, video.videoId]);

  useEffect(
    () => () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!active) return;
    onSeen?.(video);
    markOpened(video);
  }, [active, onSeen, video]);

  // Statistiques de visionnage : une lecture commence quand la page devient
  // active. Le temps est mesuré par `viewingStats` avec l'horloge murale.
  useEffect(() => {
    if (!active) return undefined;
    const category = resolveVideoCategory(video, categories);
    viewingBegin({
      videoId: video.videoId,
      title: video.title,
      channelId: video.channelId,
      channelTitle: video.channelTitle,
      format: vertical ? 'short' : 'long',
      categoryId: category?.id ?? null,
      categoryName: category?.name ?? null,
      source: 'online',
    });
    return () => {
      viewingEnd();
    };
  }, [active, video, categories, vertical]);

  // Arrière-plan et écran verrouillé ne comptent pas : on met en pause dès que
  // l'application n'est plus active, et on reprend seulement si la vidéo joue.
  useEffect(() => {
    if (!active) return undefined;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (playingRef.current) viewingSetPlaying(true, playbackSpeed);
      } else {
        viewingSetPlaying(false);
        flush(false);
      }
    });
    return () => subscription.remove();
  }, [active, flush, playbackSpeed]);

  useEffect(() => {
    if (!blocked) return undefined;
    const timer = setTimeout(() => setBlocked(false), 2600);
    return () => clearTimeout(timer);
  }, [blocked]);

  const handleEvent = useCallback(
    (event) => {
      switch (event.type) {
        case 'state': {
          const playing = event.state === 'playing';
          playingRef.current = playing;
          setIsPlaying(playing);
          setBuffering(event.state === 'buffering');
          viewingSetPlaying(playing, playbackSpeed);
          if (event.state === 'paused' || event.state === 'ended') flush(false);
          if (event.state === 'ended') {
            flush(true);
            onEnded?.();
          }
          break;
        }
        case 'progress': {
          const current = event.currentTime ?? 0;
          const previous = lastTimeRef.current;
          setPlayerReady(true);

          if (previous !== null) {
            const delta = current - previous;
            if (delta <= -3) {
              // Retour en arrière volontaire : passage revu (le saut peut
              // arriver pendant un « buffering », d'où le test hors lecture).
              trackReplay(video, current);
              setReplays((value) => value + 1);
              setLastReplayAt(Math.round(current));
            } else if (playingRef.current && delta > 0 && delta < 2.5) {
              pendingRef.current += delta;
              if (pendingRef.current >= FLUSH_EVERY) flush(false);
            }
          }

          lastTimeRef.current = current;
          setTime(current);
          if (event.duration) {
            setDuration(event.duration);
            durationRef.current = event.duration;
          }
          viewingProgress({
            position: current,
            duration: event.duration || durationRef.current,
          });
          break;
        }
        case 'ready':
          setPlayerReady(true);
          playerRef.current?.setRate(playbackSpeed);
          if (event.duration) {
            durationRef.current = event.duration;
            setDuration(event.duration);
          }
          break;
        case 'error':
          setPlayerReady(false);
          setErrorCode(event.code);
          break;
        case 'exitBlocked':
          setBlocked(true);
          break;
        default:
          break;
      }
    },
    [flush, onEnded, playbackSpeed, video],
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

  const handleRate = (nextRating) => {
    setRatingState(nextRating);
    setRating(video, nextRating);
  };

  const flashSeek = (amount) => {
    setSeekFeedback(amount);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setSeekFeedback(null), 650);
  };

  // Un appui simple révèle les contrôles ; deux appuis rapprochés du même côté
  // avancent ou reculent de 10 s. Cette couche est une vue React Native
  // au-dessus de la WebView : les gestes ne dépendent donc pas du lecteur.
  const handleScreenTap = (event) => {
    if (!active) {
      showControls();
      return;
    }

    const now = Date.now();
    const { locationX } = event.nativeEvent ?? {};
    const x = typeof locationX === 'number' ? locationX : windowWidth / 2;
    const last = lastTapRef.current;
    const sameSide = (x < windowWidth / 2) === (last.x < windowWidth / 2);

    if (now - last.at < DOUBLE_TAP_DELAY && sameSide) {
      const amount = x < windowWidth / 2 ? -10 : 10;
      playerRef.current?.seekBy(amount);
      flashSeek(amount);
      lastTapRef.current = { at: 0, x };
      return;
    }

    lastTapRef.current = { at: now, x };
    showControls();
  };

  const progressRatio = duration > 0 ? Math.min(1, time / duration) : 0;
  const notice = blocked ? t('player:blockedNotice') : null;

  // Le lecteur et ses contrôles forment un seul bloc, centré verticalement
  // dans l'espace laissé libre par les détails (même principe que le lecteur
  // hors ligne). La hauteur du lecteur ne dépasse jamais cet espace : plus de
  // constante magique du type « hauteur de l'écran moins 330 ».
  const idealStageHeight = (windowWidth * 9) / 16;
  const availableStageHeight =
    playerAreaHeight > 0 ? Math.max(120, playerAreaHeight - controlsHeight) : idealStageHeight;
  const stageHeight = Math.min(idealStageHeight, availableStageHeight);
  const showResume = resumeAt > 0 && time < resumeAt + 5;

  return (
    <View style={[styles.page, { height }]}>
      <View
        style={styles.playerArea}
        onLayout={(event) => setPlayerAreaHeight(event.nativeEvent.layout.height)}
      >
        <View
          style={[
            styles.stage,
            immersive ? styles.stageImmersive : { height: stageHeight },
          ]}
        >
        {active && !errorCode ? (
          <YoutubePlayer
            key={playerKey}
            ref={playerRef}
            videoId={video.videoId}
            startSeconds={resumeAt}
            subtitles={subtitles}
            onEvent={handleEvent}
            style={styles.player}
          />
        ) : (
          <>
            <View style={styles.posterWrap}>
              <VideoThumbnail
                videoId={video.videoId}
                thumbnail={video.thumbnail}
                format={vertical ? FORMAT_SHORT : FORMAT_VIDEO}
                dataSaver={dataSaver}
                radius={0}
                style={styles.poster}
              />
            </View>
            {errorCode ? (
              <View style={styles.posterOverlay}>
                <Text style={styles.offlineText}>
                  {errorCode === 'network'
                    ? t('player:offlineVideo')
                    : t('player:embedUnavailable')}
                </Text>
                <Pressable
                  onPress={() => {
                    setErrorCode(null);
                    setPlayerReady(false);
                    setPlayerKey((value) => value + 1);
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
                >
                  <Text style={styles.retryText}>{t('player:retry')}</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        )}
        {buffering && active && !errorCode ? (
          <View style={styles.buffering} pointerEvents="none">
            <ActivityIndicator color="#fff" />
          </View>
        ) : null}

        {active && !errorCode && playerReady ? (
          <Pressable
            onPress={handleScreenTap}
            accessible={immersive && !controlsVisible}
            accessibilityRole="button"
            accessibilityLabel={t('player:showControls')}
            style={StyleSheet.absoluteFill}
          />
        ) : null}

        {seekFeedback ? (
          <View
            pointerEvents="none"
            style={[
              styles.seekFeedback,
              seekFeedback < 0 ? styles.seekFeedbackLeft : styles.seekFeedbackRight,
            ]}
          >
            <Text style={styles.seekFeedbackText}>
              {seekFeedback < 0 ? '−10' : '+10'}
            </Text>
          </View>
        ) : null}

        {immersive && controlsVisible ? (
          <View style={styles.overlayTop} pointerEvents="none">
            <Text style={styles.overlayTitle} numberOfLines={2}>
              {video.title}
            </Text>
            <Text style={styles.overlayMeta} numberOfLines={1}>
              {video.channelTitle}
            </Text>
            {notice ? (
              <Text
                style={[styles.overlayMeta, blocked && styles.overlayBlocked]}
                numberOfLines={1}
              >
                {notice}
              </Text>
            ) : null}
          </View>
        ) : null}

        {immersive && controlsVisible ? (
          <View
            style={[
              styles.overlayBottom,
              { paddingBottom: spacing.lg + insets.bottom },
            ]}
          >
            <View style={styles.overlayTrack}>
              <View style={[styles.trackFill, { width: `${progressRatio * 100}%` }]} />
            </View>

            <View style={styles.overlayTimeRow}>
              <Text style={styles.overlayTime}>{formatClock(time)}</Text>
              <Text style={styles.overlayTime}>
                {duration ? formatClock(duration) : '—:—'}
              </Text>
            </View>

            <View style={styles.overlayButtons}>
              <Pressable
                onPress={() => playerRef.current?.seekBy(-10)}
                disabled={!active}
                accessibilityRole="button"
                accessibilityLabel={t('player:back10')}
                style={({ pressed }) => [styles.overlayRound, pressed && styles.roundPressed]}
              >
                <Text style={styles.roundText}>−10</Text>
              </Pressable>

              <Pressable
                onPress={() => playerRef.current?.toggle()}
                disabled={!active}
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? t('player:pause') : t('player:play')}
                style={({ pressed }) => [styles.play, pressed && styles.playPressed]}
              >
                {isPlaying ? <PauseIcon size={17} /> : <PlayIcon size={19} />}
              </Pressable>

              <Pressable
                onPress={() => playerRef.current?.seekBy(10)}
                disabled={!active}
                accessibilityRole="button"
                accessibilityLabel={t('player:forward10')}
                style={({ pressed }) => [styles.overlayRound, pressed && styles.roundPressed]}
              >
                <Text style={styles.roundText}>+10</Text>
              </Pressable>

              <Pressable
                onPress={() => setImmersive(false)}
                accessibilityRole="button"
                accessibilityLabel={
                  vertical ? t('player:showDetails') : t('player:exitFullscreen')
                }
                style={({ pressed }) => [styles.overlayRound, pressed && styles.roundPressed]}
              >
                <MinimizeIcon color={colors.text} size={15} />
              </Pressable>
            </View>

            <View style={styles.overlayRating}>
              {RATINGS.map((option) => {
                const selected = rating === option.key;
                return (
                  <Chip
                    key={option.key}
                    size="sm"
                    tone="overlay"
                    active={selected}
                    label={t(`player:${option.labelKey}`)}
                    accessibilityLabel={`${t(`player:${option.labelKey}`)} — ${t(`player:${option.hintKey}`)}`}
                    onPress={() => handleRate(option.key)}
                    style={{ flex: 1 }}
                  />
                );
              })}
            </View>
          </View>
        ) : null}
        </View>

        {immersive ? null : (
          <View
            style={styles.controls}
            onLayout={(event) => setControlsHeight(event.nativeEvent.layout.height)}
          >
        <Pressable
          ref={trackRef}
          onPress={handleTrackPress}
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
          accessibilityRole="adjustable"
          accessibilityLabel={t('player:progress')}
          accessibilityActions={[
            { name: 'increment', label: t('player:forward10') },
            { name: 'decrement', label: t('player:back10') },
          ]}
          onAccessibilityAction={(event) => {
            const action = event.nativeEvent?.actionName;
            if (action === 'increment') playerRef.current?.seekBy(10);
            else if (action === 'decrement') playerRef.current?.seekBy(-10);
          }}
          accessibilityValue={{
            min: 0,
            max: Math.round(duration),
            now: Math.round(time),
            text: t('player:progressValue', {
              current: formatClock(time),
              duration: formatClock(duration),
            }),
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
            accessibilityLabel={t('player:back10')}
            style={({ pressed }) => [styles.round, pressed && styles.roundPressed]}
          >
            <Text style={styles.roundText}>−10</Text>
          </Pressable>

          <Pressable
            onPress={() => playerRef.current?.toggle()}
            disabled={!active}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? t('player:pause') : t('player:play')}
            style={({ pressed }) => [styles.play, pressed && styles.playPressed]}
          >
            {isPlaying ? <PauseIcon size={17} /> : <PlayIcon size={19} />}
          </Pressable>

          <Pressable
            onPress={() => playerRef.current?.seekBy(10)}
            disabled={!active}
            accessibilityRole="button"
            accessibilityLabel={t('player:forward10')}
            style={({ pressed }) => [styles.round, pressed && styles.roundPressed]}
          >
            <Text style={styles.roundText}>+10</Text>
          </Pressable>

          <Pressable
            onPress={() => setImmersive(true)}
            accessibilityRole="button"
            accessibilityLabel={t('player:fullscreen')}
            style={({ pressed }) => [styles.round, pressed && styles.roundPressed]}
          >
            <FullscreenIcon color={colors.text} size={15} />
          </Pressable>
        </View>
          </View>
        )}

      </View>

      {immersive ? null : (
      <>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {video.title}
        </Text>

        <View style={styles.metaRow}>
          <ChannelAvatar
            uri={avatars[video.channelId]}
            name={video.channelTitle}
            size={20}
          />
          <Text style={styles.channel} numberOfLines={1}>
            {video.channelTitle}
          </Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.meta}>{timeAgo(video.publishedAt, locale)}</Text>

        </View>

        {showResume ? (
          <View style={styles.resumeRow}>
            <Text style={styles.resumeText} numberOfLines={1}>
              {t('player:resumeAt', { time: formatClock(resumeAt) })}
            </Text>
            <Pressable
              onPress={() => {
                playerRef.current?.seekTo(0);
                setTime(0);
                setResumeAt(0);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('player:restart')}
              style={({ pressed }) => [styles.resumeAction, pressed && styles.ratingPressed]}
            >
              <Text style={styles.resumeActionText}>{t('player:restart')}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.ratingBlock}>
          <Text style={styles.ratingQuestion}>{t('player:ratingQuestion')}</Text>
          <View style={styles.ratingRow}>
            {RATINGS.map((option) => {
              const selected = rating === option.key;
              const tone =
                option.key === 'fragile'
                  ? styles.ratingFragile
                  : option.key === 'solide'
                    ? styles.ratingSolide
                    : styles.ratingMoyen;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => handleRate(option.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                    accessibilityLabel={`${t(`player:${option.labelKey}`)} — ${t(`player:${option.hintKey}`)}`}
                  style={({ pressed }) => [
                    styles.ratingChip,
                    selected && tone,
                    pressed && styles.ratingPressed,
                  ]}
                >
                    <Text style={[styles.ratingLabel, selected && styles.ratingLabelActive]}>
                    {t(`player:${option.labelKey}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {rating === 'solide' && replays >= 2 ? (
            <Text style={styles.ratingInsight}>
              {t('player:ratingInsight', {
                time: formatClock(lastReplayAt ?? 0),
                count: replays,
              })}
            </Text>
          ) : null}
        </View>

        {notice ? (
          <View style={[styles.notice, blocked && styles.noticeBlocked]}>
            <LockIcon color={blocked ? colors.danger : colors.accentText} size={10} />
            <Text style={[styles.noticeText, blocked && styles.noticeTextBlocked]}>
              {notice}
            </Text>
          </View>
        ) : null}

        {errorCode ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>
              {errorCode === 'network'
                ? t('player:noConnection')
                : t('player:embedError')}
            </Text>
            <Text style={styles.errorText}>
              {errorCode === 'network'
                ? t('player:noConnectionMessage')
                : t('player:embedErrorMessage')}
            </Text>
            <Text style={styles.errorHint}>
              {isLast ? t('player:endOfList') : t('player:swipeNext')}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.pageFoot, { paddingBottom: spacing.md + insets.bottom }]}>
        <View style={styles.lockNote}>
          <LockIcon color={colors.textFaint} size={10} />
          <Text style={styles.lockNoteText}>
            {t('player:lockedNote')}
          </Text>
        </View>

        {!isLast ? (
          <Pressable
            onPress={onNext}
            accessibilityRole="button"
            accessibilityLabel={t('player:swipeMore')}
            style={({ pressed }) => [styles.swipeRow, pressed && styles.ratingPressed]}
          >
            <Chevron direction="up" color={colors.accentText} size={8} thickness={2} />
            <Text style={styles.swipeText}>{t('player:swipeMore')}</Text>
          </Pressable>
        ) : (
          <View style={styles.swipeRow}>
            <Text style={styles.swipeText}>{t('player:endOfList')}</Text>
          </View>
        )}
      </View>
      </>
      )}
    </View>
  );
}

export default function PlayerScreen({
  queue,
  initialIndex = 0,
  backLabel = 'Accueil',
  avatars = {},
  formats = {},
  categories = [],
  autoplayNext = false,
  playbackSpeed = 1,
  subtitles = false,
  dataSaver = false,
  onToggleAutoplay,
  onBack,
  onVideoChange,
}) {
  const { colors } = useTheme();
  const styles = useThemeStyles(baseStyles);
  const { t } = useTranslation();
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
        <Text style={styles.empty}>{t('player:videoNotFound')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={
            t('player:backTo', { label: backLabel })
          }
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <Chevron direction="left" color={colors.text} size={9} thickness={2} />
          <Text style={styles.backLabel}>{backLabel}</Text>
        </Pressable>

        <Pressable
          onPress={onToggleAutoplay}
          accessibilityRole="switch"
          accessibilityState={{ checked: Boolean(autoplayNext) }}
          accessibilityLabel={
            autoplayNext
              ? t('player:autoplayOn')
              : t('player:autoplayOff')
          }
          style={({ pressed }) => [
            styles.autoplay,
            autoplayNext && styles.autoplayOn,
            pressed && styles.backPressed,
          ]}
        >
          <PlayIcon color={autoplayNext ? colors.accentText : colors.textFaint} size={9} />
          <Text style={[styles.autoplayText, autoplayNext && styles.autoplayTextOn]}>
            {t('player:autoplayLabel')}
          </Text>
        </Pressable>

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
                avatars={avatars}
                formats={formats}
                categories={categories}
                playbackSpeed={playbackSpeed}
                subtitles={subtitles}
                dataSaver={dataSaver}
                onEnded={() => {
                  // Lecture continue désactivée par défaut : sans ce garde-fou,
                  // la fin d'une vidéo enchaînait sur tout le flux.
                  if (autoplayNext) goToIndex(itemIndex + 1);
                }}
                onNext={() => goToIndex(itemIndex + 1)}
                onSeen={onVideoChange}
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
            // Une WebView détruite pendant la lecture fait planter Android.
            removeClippedSubviews={false}
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

const baseStyles = StyleSheet.create({
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
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  counter: {
    color: colors.textFaint,
    fontSize: fontSize.meta,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    minWidth: 64,
    textAlign: 'right',
  },
  autoplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  autoplayOn: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentLine,
  },
  autoplayText: {
    color: colors.textFaint,
    fontSize: fontSize.caption,
    fontWeight: '700',
  },
  autoplayTextOn: {
    color: colors.accentText,
  },
  listWrap: {
    flex: 1,
  },
  page: {
    width: '100%',
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  // Zone qui reçoit toute la hauteur restante : le lecteur y est centré
  // verticalement, comme dans le lecteur hors ligne.
  playerArea: {
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // Boîte du lecteur : hauteur imposée par le format (16:9 en présentation
  // normale, tout l'écran en immersif). Elle ne dépend plus de ce qui reste.
  stage: {
    width: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  stageImmersive: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  buffering: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seekFeedback: {
    position: 'absolute',
    top: '50%',
    marginTop: -26,
    width: 64,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 7, 14, 0.62)',
  },
  seekFeedbackLeft: {
    left: 28,
  },
  seekFeedbackRight: {
    right: 28,
  },
  seekFeedbackText: {
    color: '#fff',
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  player: {
    flex: 1,
  },
  overlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    backgroundColor: 'rgba(5, 7, 14, 0.55)',
  },
  overlayTitle: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '700',
    lineHeight: 20,
  },
  overlayMeta: {
    color: colors.textMuted,
    fontSize: fontSize.meta,
    fontWeight: '600',
    marginTop: 3,
  },
  overlayBlocked: {
    color: colors.danger,
  },
  overlayBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xxxl,
    gap: spacing.sm,
    backgroundColor: 'rgba(5, 7, 14, 0.62)',
  },
  overlayTrack: {
    height: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(233, 241, 255, 0.3)',
  },
  overlayTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overlayTime: {
    color: colors.text,
    fontSize: fontSize.caption,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  overlayButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  overlayRound: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(233, 241, 255, 0.14)',
  },
  overlayRating: {
    flexDirection: 'row',
    gap: spacing.sm,
    // La zone tactile fait 44 px sans déplacer les puces de 32 px.
    paddingVertical: 6,
    marginVertical: -6,
  },
  posterWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poster: {
    height: '100%',
  },
  posterOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(5, 7, 14, 0.78)',
  },
  offlineText: {
    color: colors.text,
    fontSize: fontSize.label,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'center',
  },
  retry: {
    height: 38,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  retryPressed: {
    opacity: 0.85,
  },
  retryText: {
    color: colors.onAccent,
    fontSize: fontSize.label,
    fontWeight: '700',
  },
  notice: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentLine,
  },
  noticeBlocked: {
    borderColor: colors.danger,
  },
  noticeText: {
    color: colors.accentText,
    fontSize: fontSize.caption,
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
    // Cible de 44 px, sans changer la position du trait de 3 px.
    height: 44,
    marginVertical: -7,
    justifyContent: 'center',
  },
  track: {
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'visible',
  },
  trackFill: {
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    justifyContent: 'center',
  },
  trackThumb: {
    position: 'absolute',
    right: -5,
    width: 11,
    height: 11,
    borderRadius: radius.pill,
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
    fontSize: fontSize.caption,
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
    borderRadius: radius.pill,
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
    fontSize: fontSize.meta,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  play: {
    width: 62,
    height: 62,
    borderRadius: radius.pill,
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
    fontSize: fontSize.headline,
    fontWeight: '700',
    lineHeight: 26,
    letterSpacing: -0.4,
  },
  ratingBlock: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  resumeRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 30,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentLine,
  },
  resumeText: {
    color: colors.accentText,
    fontSize: fontSize.caption,
    fontWeight: '600',
  },
  resumeAction: {
    height: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  resumeActionText: {
    color: colors.onAccent,
    fontSize: fontSize.caption,
    fontWeight: '700',
  },
  ratingQuestion: {
    color: colors.textMuted,
    fontSize: fontSize.meta,
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ratingChip: {
    flex: 1,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: 4,
  },
  ratingPressed: {
    opacity: 0.7,
  },
  ratingFragile: {
    backgroundColor: colors.warnSoft,
    borderColor: colors.warn,
  },
  ratingMoyen: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentLine,
  },
  ratingSolide: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  ratingLabel: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    fontWeight: '600',
    textAlign: 'center',
  },
  ratingLabelActive: {
    color: colors.text,
    fontWeight: '700',
  },
  ratingInsight: {
    color: colors.textFaint,
    fontSize: fontSize.caption,
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  channel: {
    color: colors.textMuted,
    fontSize: fontSize.meta,
    fontWeight: '600',
    flexShrink: 1,
  },
  dot: {
    color: colors.textFaint,
    fontSize: fontSize.meta,
  },
  meta: {
    color: colors.textFaint,
    fontSize: fontSize.meta,
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
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  errorText: {
    color: colors.textMuted,
    fontSize: fontSize.meta,
    lineHeight: 18,
  },
  errorHint: {
    color: colors.textFaint,
    fontSize: fontSize.caption,
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
    fontSize: fontSize.micro,
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
    fontSize: fontSize.caption,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  empty: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    padding: spacing.xl,
  },
});
