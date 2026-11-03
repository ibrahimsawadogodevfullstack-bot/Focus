import { formatVideoUrl } from './config.js';

const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';

function findJsonEnd(text, openingBrace) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = openingBrace; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

export function extractPlayerJsUrl(html) {
  const matches = [
    /["']jsUrl["']\s*:\s*["']([^"']+?\/base\.js)["']/,
    /["']PLAYER_JS_URL["']\s*:\s*["']([^"']+?\/base\.js)["']/,
    /((?:https:)?(?:\\\/|\/){2}www\.youtube\.com(?:\\\/|\/)s(?:\\\/|\/)player(?:\\\/|\/)[^"']+?(?:\\\/|\/)base\.js)/,
  ];

  for (const pattern of matches) {
    const match = html.match(pattern);
    if (!match) continue;
    const value = match[1] ?? match[0];
    const decoded = value.replaceAll('\\/', '/');
    try {
      const url = new URL(decoded, 'https://www.youtube.com');
      if (url.protocol === 'https:' && ['www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
        return url.href;
      }
    } catch {
      // Une URL invalide ne peut pas servir au déchiffrement.
    }
  }
  return null;
}

export function extractPlayerResponse(html) {
  if (typeof html !== 'string' || html.length === 0) {
    throw new Error('YouTube HTML is empty');
  }

  const markers = [
    'ytInitialPlayerResponse',
    'playerResponse',
  ];

  for (const marker of markers) {
    let searchFrom = 0;
    while (searchFrom < html.length) {
      const markerIndex = html.indexOf(marker, searchFrom);
      if (markerIndex < 0) break;

      const openingBrace = html.indexOf('{', markerIndex + marker.length);
      if (openingBrace >= 0) {
        const closingBrace = findJsonEnd(html, openingBrace);
        if (closingBrace >= 0) {
          const candidate = html.slice(openingBrace, closingBrace + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object') return parsed;
          } catch {
            // This marker may occur in a script string; try the next one.
          }
        }
      }

      searchFrom = markerIndex + marker.length;
    }
  }

  throw new Error('ytInitialPlayerResponse not found');
}

export async function fetchPlayerResponse(
  videoId,
  { config, fetchImpl = fetch } = {},
) {
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) {
    throw new Error('Invalid YouTube video id');
  }

  const primaryUrl = formatVideoUrl(config.htmlUrl, videoId);
  const urls = [
    primaryUrl,
    primaryUrl.replace('://www.youtube.com/', '://m.youtube.com/'),
  ].filter((url, index, list) => list.indexOf(url) === index);
  let html = null;
  let url = primaryUrl;
  let lastError = null;

  for (const candidateUrl of urls) {
    try {
      const response = await fetchImpl(candidateUrl, {
        headers: {
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9',
          'User-Agent': USER_AGENT,
        },
      });
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }
      html = await response.text();
      url = candidateUrl;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (html === null) {
    throw new Error(`Connexion à YouTube impossible: ${lastError?.message ?? 'Network request failed'}`);
  }

  return {
    videoId,
    url,
    playerJsUrl: extractPlayerJsUrl(html),
    playerResponse: extractPlayerResponse(html),
  };
}
