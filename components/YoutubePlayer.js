import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { buildPlayerHtml } from '../services/playerHtml';

// Seuls le document du lecteur et le contexte YouTube sont autorisés.
const ALLOWED_URL = /^(https:\/\/www\.youtube\.com(\/.*)?|about:blank)$/;

const YoutubePlayer = forwardRef(function YoutubePlayer(
  { videoId, startSeconds = 0, onEvent, style },
  ref,
) {
  const webViewRef = useRef(null);
  const initialVideoId = useRef(videoId).current;
  const html = useMemo(
    () => buildPlayerHtml({ videoId: initialVideoId, startSeconds }),
    [initialVideoId, startSeconds],
  );

  const run = (js) => {
    webViewRef.current?.injectJavaScript(`${js}; true;`);
  };

  // Changer de vidéo recharge le lecteur sans reconstruire la WebView.
  useEffect(() => {
    if (videoId && videoId !== initialVideoId) {
      webViewRef.current?.injectJavaScript(
        `window.__yt && window.__yt.load(${JSON.stringify(videoId)}); true;`,
      );
    }
  }, [videoId, initialVideoId]);

  useImperativeHandle(ref, () => ({
    play: () => run('window.__yt && window.__yt.play()'),
    pause: () => run('window.__yt && window.__yt.pause()'),
    toggle: () => run('window.__yt && window.__yt.toggle()'),
    seekTo: (seconds) => run(`window.__yt && window.__yt.seekTo(${Number(seconds) || 0})`),
    seekBy: (delta) => run(`window.__yt && window.__yt.seekBy(${Number(delta) || 0})`),
    setRate: (rate) => run(`window.__yt && window.__yt.setRate(${Number(rate) || 1})`),
  }));

  const handleShouldStartLoad = (request) => {
    const { url } = request;
    // Le "Watch on YouTube" et les vignettes de fin pointent vers youtube.com/watch :
    // on refuse la navigation, l'utilisateur reste dans l'application.
    if (ALLOWED_URL.test(url) && !/\/watch(\?|$)/.test(url)) {
      return true;
    }
    onEvent?.({ type: 'exitBlocked', href: url });
    return false;
  };

  return (
    <View style={style}>
      <WebView
        ref={webViewRef}
        style={styles.webview}
        source={{ html, baseUrl: 'https://www.youtube.com' }}
        originWhitelist={['https://www.youtube.com', 'about:blank']}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
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
        onMessage={(event) => {
          try {
            onEvent?.(JSON.parse(event.nativeEvent.data));
          } catch {
            // Message non JSON : sans intérêt pour l'application.
          }
        }}
        onError={() => onEvent?.({ type: 'error', code: 'webview' })}
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
