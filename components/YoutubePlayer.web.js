import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

// Lecteur web (aperçu localhost uniquement) : vraie iframe YouTube pilotée par
// l'IFrame API. Le lecteur natif est dans YoutubePlayer.js (WebView).
const STATE_MAP = {
  '-1': 'paused',
  0: 'ended',
  1: 'playing',
  2: 'paused',
  3: 'buffering',
  5: 'paused',
};

function loadIframeApi() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }

    if (!document.getElementById('yt-iframe-api')) {
      const script = document.createElement('script');
      script.id = 'yt-iframe-api';
      script.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(script);
    }

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
  });
}

const YoutubePlayer = forwardRef(function YoutubePlayer(
  { videoId, startSeconds = 0, onEvent, style },
  ref,
) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const eventRef = useRef(onEvent);
  const initialVideoId = useRef(videoId).current;
  eventRef.current = onEvent;

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    loadIframeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;

      const node = document.createElement('div');
      node.style.width = '100%';
      node.style.height = '100%';
      hostRef.current.appendChild(node);

      playerRef.current = new YT.Player(node, {
        videoId: initialVideoId,
        width: '100%',
        height: '100%',
        playerVars: {
          rel: 0,
          playsinline: 1,
          modestbranding: 1,
          start: Math.max(0, Math.round(startSeconds)),
        },
        events: {
          onReady: (event) => {
            eventRef.current?.({
              type: 'ready',
              duration: event.target.getDuration(),
            });
            timer = setInterval(() => {
              const player = playerRef.current;
              if (!player?.getCurrentTime) return;
              eventRef.current?.({
                type: 'progress',
                currentTime: player.getCurrentTime(),
                duration: player.getDuration(),
              });
            }, 500);
          },
          onStateChange: (event) => {
            eventRef.current?.({
              type: 'state',
              state: STATE_MAP[event.data] ?? 'paused',
            });
          },
          onError: (event) => {
            eventRef.current?.({ type: 'error', code: event.data });
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      try {
        playerRef.current?.destroy?.();
      } catch {
        // ignore
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (videoId && videoId !== initialVideoId) {
      playerRef.current?.loadVideoById?.(videoId);
    }
  }, [videoId, initialVideoId]);

  useImperativeHandle(
    ref,
    () => ({
      play: () => playerRef.current?.playVideo?.(),
      pause: () => playerRef.current?.pauseVideo?.(),
      toggle: () => {
        const player = playerRef.current;
        if (!player) return;
        if (player.getPlayerState?.() === 1) player.pauseVideo?.();
        else player.playVideo?.();
      },
      seekTo: (seconds) => playerRef.current?.seekTo?.(Number(seconds) || 0, true),
      seekBy: (delta) => {
        const player = playerRef.current;
        if (!player) return;
        const next = Math.max(0, (player.getCurrentTime?.() ?? 0) + (Number(delta) || 0));
        player.seekTo?.(next, true);
      },
      setRate: (rate) => playerRef.current?.setPlaybackRate?.(Number(rate) || 1),
    }),
    [],
  );

  return <View ref={hostRef} style={[styles.box, style]} />;
});

const styles = StyleSheet.create({
  box: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
});

export default YoutubePlayer;
