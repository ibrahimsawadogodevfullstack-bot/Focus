import { Platform } from 'react-native';

// Sur mobile, fetch parle directement à YouTube (aucune restriction CORS).
// Sur le web, l'aperçu passe par le proxy Metro déclaré dans metro.config.js,
// sinon le navigateur bloquerait les flux RSS et les pages de chaîne.
const WEB_PROXY = '/__youtube';

export function netFetch(url, options = {}) {
  if (Platform.OS !== 'web') {
    return fetch(url, options);
  }

  const { headers, ...rest } = options;
  const safeHeaders = { ...(headers ?? {}) };
  // Les cookies sont interdits côté navigateur : le proxy ajoute les siens.
  delete safeHeaders.Cookie;
  delete safeHeaders.cookie;

  return fetch(`${WEB_PROXY}?url=${encodeURIComponent(url)}`, {
    ...rest,
    headers: safeHeaders,
  });
}
