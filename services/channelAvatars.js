import AsyncStorage from '@react-native-async-storage/async-storage';

import { netFetch } from './net';

const CACHE_KEY = 'focus.channelAvatars.v1';
const TIMEOUT_MS = 15000;
const CONCURRENCY = 3;
const FAILURE_RETRY_MS = 24 * 60 * 60 * 1000;
// La page de chaîne expose l'avatar en 900 px ; on demande 176 px, largement
// suffisant pour un rond de 40 px et beaucoup plus léger à télécharger.
const AVATAR_SUFFIX = 's176-c-k-c0x00ffffff-no-rj';

const OG_IMAGE = /<meta\s+property="og:image"\s+content="(https:\/\/yt3\.googleusercontent\.com\/[^"]+)"/i;
const ANY_AVATAR = /https:\/\/yt3\.googleusercontent\.com\/[\w/-]+=s\d+[^"'\\\s]*/;

/** Extrait l'URL de l'avatar depuis le HTML d'une page de chaîne. */
export function extractAvatarUrl(html) {
  if (typeof html !== 'string') return null;
  const fromMeta = html.match(OG_IMAGE);
  const fromBody = html.match(ANY_AVATAR);
  const raw = fromMeta?.[1] ?? fromBody?.[0];
  if (!raw) return null;

  const base = raw.split('=')[0];
  return base ? `${base}=${AVATAR_SUFFIX}` : null;
}

export async function readAvatarCache() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeAvatarCache(cache) {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Un cache raté n'empêche pas l'affichage : les avatars seront rechargés.
  }
}

async function fetchAvatar(channelId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await netFetch(`https://www.youtube.com/channel/${channelId}`, {
      signal: controller.signal,
      headers: { Accept: 'text/html' },
    });
    if (!response.ok) return null;
    const html = await response.text();
    return extractAvatarUrl(html);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Renvoie { channelId: url } pour les avatars connus, et complète le cache pour
 * les chaînes jamais vues. `onResolved` est appelé dès qu'une image arrive,
 * pour un affichage progressif au lieu d'attendre les 17 pages.
 */
export async function resolveChannelAvatars(channelIds = [], { onResolved } = {}) {
  const cache = await readAvatarCache();
  const now = Date.now();

  const known = {};
  for (const id of channelIds) {
    const entry = cache[id];
    if (entry?.url) known[id] = entry.url;
  }
  onResolved?.(known);

  const missing = channelIds.filter((id) => {
    const entry = cache[id];
    if (!entry) return true;
    // Échec récent : on ne martèle pas YouTube à chaque lancement.
    if (!entry.url) return now - (entry.at ?? 0) > FAILURE_RETRY_MS;
    return false;
  });

  if (missing.length === 0) return known;

  let cursor = 0;
  const worker = async () => {
    while (cursor < missing.length) {
      const id = missing[cursor];
      cursor += 1;
      const url = await fetchAvatar(id);
      cache[id] = { url, at: Date.now() };
      if (url) {
        known[id] = url;
        onResolved?.({ [id]: url });
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, missing.length) }, worker),
  );
  await writeAvatarCache(cache);

  return known;
}
