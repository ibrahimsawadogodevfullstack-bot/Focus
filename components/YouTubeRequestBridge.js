import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const YouTubeRequestBridge = forwardRef(function YouTubeRequestBridge(_, ref) {
  const webViewRef = useRef(null);
  const pending = useRef(null);
  const pageReady = useRef(false);
  const [pageUrl, setPageUrl] = useState('about:blank');

  const rejectPending = useCallback((message) => {
    pending.current?.reject(new Error(message));
    pending.current = null;
  }, []);

  useImperativeHandle(ref, () => ({
    fetch(url) {
      return new Promise((resolve, reject) => {
        pending.current = { url, resolve, reject, mode: 'load' };
        pageReady.current = false;
        setPageUrl(url);
      });
    },
  }), []);

  const handleLoadEnd = () => {
    const request = pending.current;
    if (!request || pageReady.current) return;
    pageReady.current = true;
    const isScript = /\/base\.js(?:[?#]|$)/.test(request.url);
    webViewRef.current?.injectJavaScript(`
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'youtube-bridge-response',
        ok: true,
        status: 200,
        url: location.href,
        text: ${isScript ? 'document.body ? document.body.innerText : document.documentElement.innerText' : 'document.documentElement.outerHTML'}
      })); true;
    `);
  };

  const handleMessage = (event) => {
    let message;
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    const request = pending.current;
    if (!request) return;

    if (message.type === 'youtube-bridge-error') {
      rejectPending(`Connexion YouTube impossible: ${message.message}`);
      return;
    }
    if (message.type !== 'youtube-bridge-response') return;

    // Après le HTML YouTube, les appels suivants (base.js) sont effectués
    // dans la même origine WebView pour éviter l'échec du fetch natif Android.
    if (request.mode === 'load') {
      request.mode = 'text';
      request.resolve({
        ok: message.ok,
        status: message.status,
        text: async () => message.text,
      });
      pending.current = null;
    }
  };

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: pageUrl }}
      style={styles.bridge}
      originWhitelist={['https://www.youtube.com', 'https://m.youtube.com', 'about:blank']}
      javaScriptEnabled
      domStorageEnabled
      onLoadEnd={handleLoadEnd}
      onMessage={handleMessage}
      onError={() => rejectPending('Connexion YouTube impossible: WebView réseau.')}
    />
  );
});

const styles = StyleSheet.create({
  bridge: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0.01,
    left: -10,
    top: -10,
  },
});

export default YouTubeRequestBridge;
