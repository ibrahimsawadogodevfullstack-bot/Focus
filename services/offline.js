import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'react-native';

const OFFLINE_KEY = 'focus.offline.v1';

/**
 * Le lecteur YouTube officiel ne permet pas d'enregistrer la vidéo : on met de
 * côté les métadonnées et les miniatures. Elles restent consultables hors
 * réseau, la lecture demande une connexion.
 */
export function thumbnailUri(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export async function readOffline() {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.videos)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearOffline() {
  try {
    await AsyncStorage.removeItem(OFFLINE_KEY);
  } catch {
    // Rien à faire : l'écran affichera simplement l'état vide.
  }
}

export async function writeOffline(payload) {
  await AsyncStorage.setItem(OFFLINE_KEY, JSON.stringify(payload));
}

/**
 * Préchauffe les miniatures : cache disque de Fresco sur Android, cache HTTP
 * du navigateur sur le web. Aucune dépendance supplémentaire.
 */
export async function prefetchThumbnails(videos, onProgress, { concurrency = 5 } = {}) {
  const total = videos.length;
  let done = 0;
  let failed = 0;
  const queue = [...videos];

  const worker = async () => {
    while (queue.length > 0) {
      const video = queue.shift();
      try {
        await Image.prefetch(thumbnailUri(video.videoId));
      } catch {
        failed += 1;
      }
      done += 1;
      if (onProgress) onProgress({ done, total, failed });
    }
  };

  const workers = Math.min(Math.max(concurrency, 1), Math.max(total, 1));
  await Promise.all(Array.from({ length: workers }, worker));
  return { done, failed };
}

export async function downloadOffline(videos, onProgress) {
  const snapshot = { savedAt: Date.now(), videos };

  // Les métadonnées d'abord : même si les miniatures échouent, la liste tient.
  await writeOffline({ ...snapshot, thumbs: 0, failed: 0 });

  const { failed } = await prefetchThumbnails(videos, onProgress);
  const next = { ...snapshot, thumbs: videos.length - failed, failed };
  await writeOffline(next);
  return next;
}
