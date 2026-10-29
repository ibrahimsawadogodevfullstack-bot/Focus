import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

// Lecteur web (aperçu localhost) : iframe YouTube officielle, pilotée par
// postMessage. L'iframe est volontairement « sandboxée » sans allow-popups ni
// allow-top-navigation : YouTube ne peut ni ouvrir un onglet, ni quitter la page.
// Le lecteur natif reste dans YoutubePlayer.js (WebView verrouillée).

const STATE_MAP = {
  '-1': 'paused',
  0: 'ended',
  1: 'playing',
  2: 'paused',
  3: 'buffering',
  5: 'paused',
};

function buildWebEmbedUrl(videoId, startSeconds = 0) {
  const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  const params = new URLSearchParams({
    autoplay: '1',
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    enablejsapi: '1',
    origin,
  });

  const start = Math.max(0, Math.round(startSeconds));
  if (start > 0) params.set('start', String(start));

  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}

const YoutubePlayer = forwardRef(function YoutubePlayer(
  { videoId, startSeconds = 0, onEvent, style },
  ref,
) {
  const hostRef = useRef(null);
  const frameRef = useRef(null);
  const eventRef = useRef(onEvent);
  const readyRef = useRef(false);
  const lastStateRef = useRef(null);
  const timeRef = useRef(0);
  const durationRef = useRef(0);
  const initialVideoId = useRef(videoId).current;
  eventRef.current = onEvent;

  const post = (payload) => {
    try {
      frameRef.current?.contentWindow?.postMessage(JSON.stringify(payload), '*');
    } catch {
      // Iframe pas encore prête : la commande sera réessayée par l'API.
    }
  };

  useEffect(() => {
    if (!hostRef.current) return undefined;

    const frame = document.createElement('iframe');
    frame.setAttribute('src', buildWebEmbedUrl(initialVideoId, startSeconds));
    // Pas de allow-popups (pas de nouvel onglet) ni de allow-top-navigation.
    frame.setAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-presentation allow-forms',
    );
    frame.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
    frame.setAttribute('allowfullscreen', 'true');
    frame.setAttribute('title', 'Lecteur YouTube');
    frame.style.cssText = 'width:100%;height:100%;border:0;background:#000;display:block';
    hostRef.current.appendChild(frame);
    frameRef.current = frame;

    const handleMessage = (event) => {
      if (event.source !== frame.contentWindow) return;
      if (typeof event.data !== 'string') return;

      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      const info = data.info;

      if (data.event === 'initialDelivery' || data.event === 'infoDelivery') {
        if (!info || typeof info !== 'object') return;

        if (typeof info.playerState === 'number' && info.playerState !== lastStateRef.current) {
          lastStateRef.current = info.playerState;
          eventRef.current?.({
            type: 'state',
            state: STATE_MAP[String(info.playerState)] ?? 'paused',
          });
        }

        // En lecture, YouTube n'envoie souvent que `currentTime` : la durée
        // vient de l'initialisation, on la garde en mémoire.
        if (typeof info.duration === 'number' && info.duration > 0) {
          durationRef.current = info.duration;
        }

        if (typeof info.currentTime === 'number' && durationRef.current > 0) {
          timeRef.current = info.currentTime;
          eventRef.current?.({
            type: 'progress',
            currentTime: info.currentTime,
            duration: durationRef.current,
          });
          if (!readyRef.current) {
            readyRef.current = true;
            eventRef.current?.({ type: 'ready', duration: durationRef.current });
          }
        }
        return;
      }

      if (data.event === 'onError') {
        eventRef.current?.({ type: 'error', code: info });
      }
    };

    window.addEventListener('message', handleMessage);

    // Poignée de main avec l'API interne de YouTube (elle n'accepte les
    // commandes qu'après quelques « listening »). On continue à basse
    // fréquence pour récupérer après un buffering ou une coupure réseau.
    let ticks = 0;
    let keepAlive = null;
    const timer = setInterval(() => {
      post({ event: 'listening', id: 'focus-web' });
      ticks += 1;
      if (ticks === 10) {
        clearInterval(timer);
        keepAlive = setInterval(() => post({ event: 'listening', id: 'focus-web' }), 3000);
      }
    }, 400);

    return () => {
      clearInterval(timer);
      if (keepAlive) clearInterval(keepAlive);
      window.removeEventListener('message', handleMessage);
      frame.remove();
      frameRef.current = null;
    };
    // Montage unique : le lecteur n'est créé qu'une fois.
  }, []);

  useEffect(() => {
    if (videoId && videoId !== initialVideoId) {
      readyRef.current = false;
      lastStateRef.current = null;
      post({ event: 'command', func: 'loadVideoById', args: [videoId] });
      setTimeout(() => post({ event: 'command', func: 'playVideo', args: [] }), 500);
    }
  }, [videoId, initialVideoId]);

  useImperativeHandle(
    ref,
    () => ({
      play: () => post({ event: 'command', func: 'playVideo', args: [] }),
      pause: () => post({ event: 'command', func: 'pauseVideo', args: [] }),
      toggle: () =>
        post({
          event: 'command',
          func: lastStateRef.current === 1 ? 'pauseVideo' : 'playVideo',
          args: [],
        }),
      seekTo: (seconds) => {
        const target = Math.max(0, Number(seconds) || 0);
        timeRef.current = target;
        post({ event: 'command', func: 'seekTo', args: [target, true] });
      },
      seekBy: (delta) => {
        const target = Math.max(0, timeRef.current + (Number(delta) || 0));
        timeRef.current = target;
        post({ event: 'command', func: 'seekTo', args: [target, true] });
      },
      setRate: (rate) => post({ event: 'command', func: 'setPlaybackRate', args: [Number(rate) || 1] }),
    }),
    [],
  );

  return (
    <View style={[styles.box, style]}>
      <View ref={hostRef} style={StyleSheet.absoluteFill} />
    </View>
  );
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
