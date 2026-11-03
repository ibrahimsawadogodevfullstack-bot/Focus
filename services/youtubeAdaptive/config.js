import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'youtube-adaptive-config.v1';
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

export const DEFAULT_ADAPTIVE_CONFIG = Object.freeze({
  version: 1,
  htmlUrl: 'https://www.youtube.com/watch?v=%s',
  jsonUrl: 'https://www.youtube.com/watch?v=%s&pbj=1&has_verified=1',
  jsUrl: null,
  signFunc: null,
  ttlMs: DEFAULT_TTL_MS,
});

function validTemplate(value) {
  return typeof value === 'string' && value.includes('%s');
}

export function normalizeAdaptiveConfig(value = {}) {
  const source = value && typeof value === 'object' ? value : {};

  return {
    ...DEFAULT_ADAPTIVE_CONFIG,
    ...source,
    htmlUrl: validTemplate(source.htmlUrl)
      ? source.htmlUrl
      : DEFAULT_ADAPTIVE_CONFIG.htmlUrl,
    jsonUrl: validTemplate(source.jsonUrl)
      ? source.jsonUrl
      : DEFAULT_ADAPTIVE_CONFIG.jsonUrl,
    ttlMs: Number.isFinite(Number(source.ttlMs))
      ? Math.max(60_000, Number(source.ttlMs))
      : DEFAULT_TTL_MS,
  };
}

function isFresh(entry, now = Date.now()) {
  return (
    entry &&
    entry.config &&
    Number.isFinite(entry.savedAt) &&
    now - entry.savedAt < Number(entry.config.ttlMs || DEFAULT_TTL_MS)
  );
}

export async function readCachedAdaptiveConfig({ storage = AsyncStorage, now = Date.now() } = {}) {
  try {
    const raw = await storage.getItem(CACHE_KEY);
    if (!raw) return null;

    const entry = JSON.parse(raw);
    return isFresh(entry, now) ? normalizeAdaptiveConfig(entry.config) : null;
  } catch {
    return null;
  }
}

export async function saveAdaptiveConfig(
  config,
  { storage = AsyncStorage, now = Date.now() } = {},
) {
  const normalized = normalizeAdaptiveConfig(config);
  await storage.setItem(
    CACHE_KEY,
    JSON.stringify({ savedAt: now, config: normalized }),
  );
  return normalized;
}

/**
 * Loads a remote configuration when an endpoint is supplied, otherwise uses
 * the cached/default configuration. The endpoint must return JSON matching
 * normalizeAdaptiveConfig; it is intentionally optional so the app remains
 * usable when the configuration service is unavailable.
 */
export async function loadAdaptiveConfig({
  endpoint = null,
  fetchImpl = fetch,
  storage = AsyncStorage,
  now = Date.now(),
} = {}) {
  const cached = await readCachedAdaptiveConfig({ storage, now });
  if (cached) return { config: cached, source: 'cache' };

  if (endpoint) {
    try {
      const response = await fetchImpl(endpoint, {
        headers: { Accept: 'application/json' },
      });
      if (response.ok) {
        const remote = normalizeAdaptiveConfig(await response.json());
        await saveAdaptiveConfig(remote, { storage, now });
        return { config: remote, source: 'remote' };
      }
    } catch {
      // Fall back to the built-in configuration below.
    }
  }

  return { config: DEFAULT_ADAPTIVE_CONFIG, source: 'default' };
}

export function formatVideoUrl(template, videoId) {
  return template.replace('%s', encodeURIComponent(videoId));
}

export { CACHE_KEY };
