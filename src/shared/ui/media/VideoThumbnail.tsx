import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Animated,
  PixelRatio,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import type { ImageLoadEventData } from 'expo-image';

import { colors } from '../../theme/tokens';
import { netFetch } from '../../../../services/net';
import {
  bestThumbnail,
  cacheThumbnail,
  clearCachedThumbnail,
  getCachedThumbnail,
  imageDimensionsFromBuffer,
  isThumbnailSharpEnough,
  isValidThumbnail,
  thumbnailCandidates,
} from '../../../../services/thumbnails';
import { thumbnailRatio } from '../../media/thumbnailLayout';
import ThumbnailFallback from './ThumbnailFallback';
import { useThemeStyles } from '../../theme/ThemeProvider';
import { startPerformance } from '../../../../services/performance';

export const MAX_THUMBNAIL_LOAD_MS = 8000;
const REQUEST_TIMEOUT_MS = 1500;
const AnimatedImage = Animated.createAnimatedComponent(Image);

interface ImageDimensions {
  width: number;
  height: number;
}

interface ResolvedThumbnail extends ImageDimensions {
  url: string;
  status: number | null;
  contentType?: string;
  usefulWidth?: number;
}

interface ThumbnailState {
  key: string;
  index: number;
  phase: 'loading' | 'loaded' | 'failed';
  ready: boolean;
  status: number | null;
  contentType: string;
  resolved: ResolvedThumbnail | null;
  valid: ResolvedThumbnail[];
}

type ThumbnailLoadEvent = ImageLoadEventData & {
  nativeEvent?: {
    source?: Partial<ImageDimensions> & { naturalWidth?: number; naturalHeight?: number };
    target?: { naturalWidth?: number; naturalHeight?: number };
    width?: number;
    height?: number;
  };
};

interface VideoThumbnailProps {
  videoId?: string;
  thumbnail?: string;
  format?: 'video' | 'short';
  style?: StyleProp<ViewStyle>;
  radius?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  pending?: boolean;
  dataSaver?: boolean;
  fallbackText?: string;
  children?: ReactNode;
  testID?: string;
}

function dimensionsFromEvent(event: ThumbnailLoadEvent): ImageDimensions | null {
  const native = event?.nativeEvent ?? {};
  const source = event?.source ?? native.source ?? {};
  const target = native.target ?? {};
  const width = Number(
    source.width ?? target.naturalWidth ?? native.width,
  );
  const height = Number(
    source.height ?? target.naturalHeight ?? native.height,
  );
  return width > 0 && height > 0 ? { width, height } : null;
}

function rejectedLog(
  url: string,
  status: number | null | undefined,
  width: number | null | undefined,
  height: number | null | undefined,
  reason = '',
) {
  if (!__DEV__) return;
  const safeWidth = Number(width ?? 0);
  const safeHeight = Number(height ?? 0);
  const dimensions =
    safeWidth > 0 && safeHeight > 0 ? `${safeWidth}×${safeHeight}` : 'dimensions inconnues';
  console.warn(
    `[thumbnail] rejetée ${url} — HTTP ${status ?? 'inconnu'} — ${dimensions}${
      reason ? ` — ${reason}` : ''
    }`,
  );
}

async function inspectImageAfterError(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await netFetch(url, { signal: controller.signal });
    const contentType = response.headers.get('content-type') ?? '';
    const buffer = await response.arrayBuffer();
    return {
      status: response.status,
      contentType,
      ...imageDimensionsFromBuffer(buffer, contentType),
    } satisfies { status: number; contentType: string; width?: number; height?: number };
  } finally {
    clearTimeout(timeout);
  }
}

function initialState(
  key: string,
  candidates: string[],
  cached: ResolvedThumbnail | null,
  dataSaver: boolean,
): ThumbnailState {
  const cachedForMode = dataSaver && Number(cached?.width) > 480 ? null : cached;
  if (cachedForMode) {
    return {
      key,
      index: 0,
      phase: 'loaded',
      ready: false,
      status: cachedForMode.status ?? 200,
      contentType: cachedForMode.contentType ?? '',
      resolved: cachedForMode,
      valid: [cachedForMode],
    };
  }
  return {
    key,
    index: 0,
    phase: candidates.length > 0 ? 'loading' : 'failed',
    ready: false,
    status: null,
    contentType: '',
    resolved: null,
    valid: [],
  };
}

export default function VideoThumbnail({
  videoId,
  thumbnail,
  format = 'video',
  style,
  radius = 12,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  pending = false,
  dataSaver = false,
  fallbackText,
  children,
  testID,
}: VideoThumbnailProps) {
  const styles = useThemeStyles(baseStyles);
  const key = `${videoId ?? ''}|${format}|${thumbnail ?? ''}|${dataSaver ? 'lite' : 'full'}`;
  const candidates = useMemo(
    () => thumbnailCandidates(videoId, thumbnail, { dataSaver }),
    [dataSaver, thumbnail, videoId],
  );
  const [state, setState] = useState<ThumbnailState>(() =>
    initialState(key, candidates, getCachedThumbnail(videoId), dataSaver),
  );
  const [displayWidth, setDisplayWidth] = useState(0);
  const imageOpacity = useRef(new Animated.Value(0)).current;
  const shimmerOpacity = useRef(new Animated.Value(0.35)).current;
  const imageLoadFinishRef = useRef<((result: Record<string, unknown>) => void) | null>(null);
  const requiredWidth = (displayWidth || 156) * PixelRatio.get();
  const isLocalThumbnail = /^(?:file|content):\/\//i.test(thumbnail ?? '');
  const activeSource = candidates[state.index];
  const isCurrentState = state.key === key;
  const showingLoadedImage =
    isLocalThumbnail || (isCurrentState && state.phase === 'loaded' && !pending);
  const showingFallback = !isLocalThumbnail && isCurrentState && state.phase === 'failed';
  const showingSkeleton =
    !isLocalThumbnail && !showingFallback && (!showingLoadedImage || Boolean(state.resolved));

  useEffect(() => {
    setState(initialState(key, candidates, getCachedThumbnail(videoId), dataSaver));
    imageOpacity.setValue(0);
  }, [candidates, dataSaver, imageOpacity, key, videoId]);

  useEffect(() => {
    if (!isCurrentState || state.phase !== 'loading') return undefined;

    const timer = setTimeout(() => {
      setState((current) => {
        if (current.key !== key || current.phase !== 'loading') return current;
        const best = bestThumbnail(current.valid, requiredWidth);
        return best
          ? { ...current, phase: 'loaded', resolved: best }
          : { ...current, phase: 'failed' };
      });
    }, MAX_THUMBNAIL_LOAD_MS);

    return () => clearTimeout(timer);
  }, [isCurrentState, key, requiredWidth, state.phase]);

  useEffect(() => {
    if (
      !isCurrentState ||
      isLocalThumbnail ||
      state.phase !== 'loading' ||
      state.ready ||
      !activeSource
    ) {
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const finish = startPerformance('thumbnail.probe', {
      videoId,
      variant: activeSource.split('/').pop(),
    });
    let outcome: { result: string; status?: number } = { result: 'error' };

    netFetch(activeSource, {
      method: 'HEAD',
      signal: controller.signal,
    })
      .then((response) => {
        if (cancelled) return;
        const contentType = response.headers.get('content-type') ?? '';
        outcome = {
          result: contentType.toLowerCase().startsWith('image/') ? 'ok' : 'invalid',
          status: response.status,
        };
        // Certains serveurs refusent HEAD alors que le chargement de l'image
        // fonctionne. La réponse GET de l'image tranchera avec ses dimensions.
        if (!response.ok || !contentType.toLowerCase().startsWith('image/')) {
          rejectedLog(activeSource, response.status, null, null, contentType);
        }

        setState((current) =>
          current.key === key && current.index === state.index
            ? {
                ...current,
                ready: true,
                status: response.status,
                contentType,
              }
            : current,
        );
      })
      .catch(() => {
        if (cancelled) return;
        outcome = { result: 'error' };
        rejectedLog(activeSource, null, null, null, 'requête HEAD échouée');
        setState((current) =>
          current.key === key && current.index === state.index
            ? { ...current, ready: true, status: null, contentType: '' }
            : current,
        );
      })
      .finally(() => {
        clearTimeout(timer);
        finish(outcome);
      });

    return () => {
      cancelled = true;
      outcome = { result: 'cancelled' };
      controller.abort();
      clearTimeout(timer);
    };
  }, [
    activeSource,
    candidates,
    isLocalThumbnail,
    isCurrentState,
    key,
    requiredWidth,
    state.index,
    state.phase,
    state.ready,
    videoId,
  ]);

  useEffect(() => {
    if (
      !isCurrentState ||
      isLocalThumbnail ||
      state.phase !== 'loading' ||
      !state.ready ||
      !activeSource
    ) {
      return undefined;
    }

    imageLoadFinishRef.current = startPerformance('thumbnail.image', {
      videoId,
      variant: activeSource.split('/').pop(),
    });
    return () => {
      imageLoadFinishRef.current?.({ result: 'cancelled' });
      imageLoadFinishRef.current = null;
    };
  }, [activeSource, isLocalThumbnail, isCurrentState, state.phase, state.ready, videoId]);

  useEffect(() => {
    if (!isCurrentState || state.phase !== 'loaded' || !state.resolved) return;
    cacheThumbnail(videoId, state.resolved);
    const sharp = isThumbnailSharpEnough({
      format,
      width: state.resolved.width,
      height: state.resolved.height,
      displayWidth: displayWidth || 156,
      pixelRatio: PixelRatio.get(),
    });
    if (!sharp && __DEV__) {
      console.warn(
        `[thumbnail] résolution limitée ${state.resolved.url} — bande utile ${
          state.resolved.usefulWidth
        }px, cible ${Math.round(requiredWidth)}px`,
      );
    }
  }, [
    displayWidth,
    format,
    isCurrentState,
    requiredWidth,
    state.phase,
    state.resolved,
    videoId,
  ]);

  useEffect(() => {
    if (showingLoadedImage) {
      imageOpacity.setValue(0);
      Animated.timing(imageOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
        isInteraction: false,
      }).start();
      return undefined;
    }
    imageOpacity.setValue(0);
    return undefined;
  }, [imageOpacity, showingLoadedImage, state.resolved?.url]);

  useEffect(() => {
    if (!showingSkeleton) return undefined;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerOpacity, {
          toValue: 0.75,
          duration: 700,
          useNativeDriver: true,
          // Boucle décorative : ne jamais bloquer `InteractionManager`, sinon
          // les listes virtualisées (grille et rangée Shorts) cessent de rendre
          // de nouvelles cellules pendant le chargement des vignettes.
          isInteraction: false,
        }),
        Animated.timing(shimmerOpacity, {
          toValue: 0.3,
          duration: 700,
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [showingSkeleton, shimmerOpacity]);

  const advanceAfterRejection = (index: number) => {
    setState((current) => {
      if (current.key !== key || current.index !== index) return current;
      const nextIndex = current.index + 1;
      if (nextIndex < candidates.length) {
        return {
          ...current,
          index: nextIndex,
          ready: false,
          status: null,
          contentType: '',
        };
      }
      const best = bestThumbnail(current.valid, requiredWidth);
      return best
        ? { ...current, phase: 'loaded', resolved: best }
        : { ...current, phase: 'failed' };
    });
  };

  const handleCandidateLoad = (event: ThumbnailLoadEvent) => {
    const dimensions = dimensionsFromEvent(event);
    const index = state.index;
    const status = state.status;
    const candidate: ResolvedThumbnail = {
      url: activeSource,
      // onLoad confirme que le GET a réussi, même si la sonde HEAD a échoué.
      status: 200,
      contentType: state.contentType,
      width: dimensions?.width ?? 0,
      height: dimensions?.height ?? 0,
      usefulWidth: dimensions
        ? dimensions.width *
          Math.min(
            1,
            thumbnailRatio(format) / (dimensions.width / dimensions.height),
          )
        : 0,
    };

    if (!dimensions || !isValidThumbnail(candidate)) {
      imageLoadFinishRef.current?.({ result: 'invalid' });
      imageLoadFinishRef.current = null;
      rejectedLog(
        activeSource,
        status,
        dimensions?.width,
        dimensions?.height,
        !dimensions ? 'dimensions source absentes' : 'image invalide',
      );
      advanceAfterRejection(index);
      return;
    }

    imageLoadFinishRef.current?.({ result: 'loaded', width: candidate.width });
    imageLoadFinishRef.current = null;
    const valid = [...state.valid, candidate];
    if (
      isThumbnailSharpEnough({
        format,
        width: candidate.width,
        height: candidate.height,
        displayWidth: displayWidth || 156,
        pixelRatio: PixelRatio.get(),
      })
    ) {
      setState((current) =>
        current.key === key && current.index === index
          ? { ...current, phase: 'loaded', resolved: candidate, valid }
          : current,
      );
      return;
    }

    setState((current) => {
      if (current.key !== key || current.index !== index) return current;
      const next = { ...current, valid };
      const nextIndex = current.index + 1;
      if (nextIndex < candidates.length) {
        return {
          ...next,
          index: nextIndex,
          ready: false,
          status: null,
          contentType: '',
        };
      }
      const best = bestThumbnail(valid, requiredWidth);
      return best
        ? { ...next, phase: 'loaded', resolved: best }
        : { ...next, phase: 'failed' };
    });
  };

  const handleCandidateError = () => {
    imageLoadFinishRef.current?.({ result: 'error' });
    imageLoadFinishRef.current = null;
    const index = state.index;
    const url = activeSource;
    const status = state.status;
    if (__DEV__) {
      inspectImageAfterError(url)
        .then((metadata) => {
          rejectedLog(
            url,
            metadata.status ?? status,
            metadata.width,
            metadata.height,
            metadata.contentType,
          );
        })
        .catch(() => rejectedLog(url, status, null, null, 'chargement échoué'));
    }
    advanceAfterRejection(index);
  };

  const handleResolvedError = () => {
    const resolved = state.resolved;
    if (!resolved) return;
    rejectedLog(resolved.url, resolved.status, resolved.width, resolved.height, 'cache invalide');
    if (videoId) clearCachedThumbnail(videoId);
    const index = candidates.indexOf(resolved.url);
    setState({
      key,
      index: Math.max(0, index + 1),
      phase: 'loading',
      ready: false,
      status: null,
      contentType: '',
      resolved: null,
      valid: [],
    });
  };

  return (
    <View
      testID={testID ?? (videoId ? `thumbnail-${videoId}` : undefined)}
      onLayout={(event: LayoutChangeEvent) => setDisplayWidth(event.nativeEvent.layout.width)}
      style={[
        styles.frame,
        { aspectRatio: thumbnailRatio(format), borderRadius: radius },
        style,
      ]}
    >
      {isLocalThumbnail && !pending ? (
        <Image
          source={{ uri: thumbnail }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          accessibilityIgnoresInvertColors
        />
      ) : null}

      {!isLocalThumbnail && showingLoadedImage && state.resolved ? (
        <AnimatedImage
          source={{ uri: state.resolved.url }}
          style={[styles.image, { opacity: imageOpacity }]}
          contentFit="cover"
          cachePolicy="memory-disk"
          accessibilityIgnoresInvertColors
          onError={handleResolvedError}
        />
      ) : null}

      {isCurrentState && state.phase === 'loading' && state.ready && activeSource ? (
        <Image
          key={`${key}:${state.index}`}
          source={{ uri: activeSource }}
          style={[styles.image, styles.validationImage]}
          contentFit="cover"
          cachePolicy="memory-disk"
          accessibilityIgnoresInvertColors
          onError={handleCandidateError}
          onLoad={handleCandidateLoad}
        />
      ) : null}

      {showingSkeleton ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.skeleton,
            showingLoadedImage
              ? { opacity: imageOpacity.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }
              : null,
          ]}
          accessibilityElementsHidden
        >
          <Animated.View style={[styles.skeletonBlock, { opacity: shimmerOpacity }]} />
          <Animated.View style={[styles.skeletonLine, { opacity: shimmerOpacity }]} />
        </Animated.View>
      ) : null}

      {showingFallback ? (
        <ThumbnailFallback
          format={format}
          label={fallbackText}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          style={({ pressed }) => [styles.press, pressed && styles.pressed]}
        />
      ) : null}

      {children}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  validationImage: {
    opacity: 0,
  },
  skeleton: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.surfaceAlt,
  },
  skeletonBlock: {
    width: '46%',
    height: '18%',
    borderRadius: 8,
    backgroundColor: colors.raised,
  },
  skeletonLine: {
    width: '28%',
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.lineStrong,
  },
  press: {
    ...StyleSheet.absoluteFillObject,
  },
  pressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
});
