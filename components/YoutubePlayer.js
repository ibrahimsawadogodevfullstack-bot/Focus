import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import {
  APP_ORIGIN,
  buildEmbedUrl,
  PLAYER_BRIDGE_SCRIPT,
} from '../services/playerEmbed';

// Seule la page de lecture YouTube (et l'écran de consentement éventuel)
// peut être chargée : toute autre navigation est refusée.
const ALLOWED_URL =
  /^(https:\/\/www\.youtube\.com\/embed\/.*|https:\/\/consent\.youtube\.com\/.*|https:\/\/www\.youtube-nocookie\.com\/.*|about:blank)$/;

const YoutubePlayer = forwardRef(function YoutubePlayer(
  { videoId, startSeconds = 0, onEvent, style },
  ref,
) {
  const webViewRef = useRef(null);
  const initialVideoId = useRef(videoId).current;

  // La page n'est chargée qu'une fois : changer de vidéo passe par l'API du
  // lecteur (loadVideoById), sans recharger la WebView.
  const embedUrl = useRef(
    // Lecture immédiate : on évite l'écran d'attente YouTube et ses suggestions.
    buildEmbedUrl({ videoId: initialVideoId, startSeconds, autoplay: true }),
  ).current;

  const run = useCallback((js) => {
    webViewRef.current?.injectJavaScript(`${js}; true;`);
  }, []);

  const installBridge = useCallback(() => {
    run(PLAYER_BRIDGE_SCRIPT);
  }, [run]);

  useEffect(() => {
    if (videoId && videoId !== initialVideoId) {
      run(`window.__yt && window.__yt.load(${JSON.stringify(videoId)})`);
    }
  }, [videoId, initialVideoId, run]);

  useImperativeHandle(
    ref,
    () => ({
      play: () => run('window.__yt && window.__yt.play()'),
      pause: () => run('window.__yt && window.__yt.pause()'),
      toggle: () => run('window.__yt && window.__yt.toggle()'),
      seekTo: (seconds) =>
        run(`window.__yt && window.__yt.seekTo(${Number(seconds) || 0})`),
      seekBy: (delta) =>
        run(`window.__yt && window.__yt.seekBy(${Number(delta) || 0})`),
      setRate: (rate) =>
        run(`window.__yt && window.__yt.setRate(${Number(rate) || 1})`),
    }),
    [run],
  );

  const handleShouldStartLoad = (request) => {
    const { url } = request;

    if (ALLOWED_URL.test(url)) {
      return true;
    }

    // « Regarder sur YouTube » et les liens de fin essaient de sortir du
    // lecteur : on refuse, l'utilisateur reste dans l'application.
    onEvent?.({ type: 'exitBlocked', href: url });
    return false;
  };

  // Filet de sécurité : si une navigation a malgré tout abouti hors du lecteur
  // (iframe, redirection), on recharge la page d'intégration.
  const handleNavigationChange = (state) => {
    const { url } = state;
    if (!url || url === 'about:blank' || ALLOWED_URL.test(url)) return;

    onEvent?.({ type: 'exitBlocked', href: url });
    webViewRef.current?.stopLoading();
    webViewRef.current?.injectJavaScript(
      `window.location.replace(${JSON.stringify(embedUrl)}); true;`,
    );
  };

  return (
    <View style={style}>
      <WebView
        ref={webViewRef}
        style={styles.webview}
        source={{
          uri: embedUrl,
          // YouTube exige un référent : sans lui, erreur 152/153.
          headers: { Referer: `${APP_ORIGIN}/` },
        }}
        originWhitelist={[
          'https://www.youtube.com',
          'https://consent.youtube.com',
          'https://www.youtube-nocookie.com',
          'about:blank',
        ]}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onNavigationStateChange={handleNavigationChange}
        injectedJavaScriptBeforeContentLoaded={PLAYER_BRIDGE_SCRIPT}
        onLoadEnd={installBridge}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        bounces={false}
        scrollEnabled={false}
        overScrollMode="never"
        // Laisse le geste vertical remonter au flux quand le lecteur ne
        // consomme pas le défilement (navigation de vidéo en vidéo).
        nestedScrollEnabled
        onMessage={(event) => {
          try {
            onEvent?.(JSON.parse(event.nativeEvent.data));
          } catch {
            // Message non JSON : sans intérêt pour l'application.
          }
        }}
        onError={() => onEvent?.({ type: 'error', code: 'webview' })}
        onHttpError={(event) =>
          onEvent?.({
            type: 'error',
            code: event.nativeEvent.statusCode || 'http',
          })
        }
      />
    </View>
  );
});

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
});

export default YoutubePlayer;
