import { useEffect, useState } from 'react';

import { Ytdlp, isYtdlpAvailable } from '../modules/ytdlp';
import { Platform } from 'react-native';

export function useYtdlpSetup() {
  const [version, setVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!isYtdlpAvailable() || !Ytdlp) {
      setLoading(false);
      if (Platform.OS !== 'android') {
        setError('Téléchargement indisponible sur cette plateforme');
      }
      return;
    }
    const sub = Ytdlp.addListener('onVersion', (e) => {
      if (active) setVersion(e.version);
    });
    Ytdlp.getVersion()
      .then((v) => {
        if (active) setVersion(v);
      })
      .catch((e) => {
        if (active) setError(e?.message ?? String(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return { version, error, loading, available: isYtdlpAvailable() };
}

export function useDownload() {
  // Thin wrapper kept for API compatibility with the supplied hook file.
  return { available: isYtdlpAvailable() };
}
