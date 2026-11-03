import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { Image, Platform } from 'react-native';

import { thumbnailUri } from './offline';
import { loadAdaptiveConfig } from './youtubeAdaptive/config';
import { fetchPlayerResponse } from './youtubeAdaptive/playerResponse';
import { resolveStreamUrl } from './youtubeAdaptive/decipher';
import { listStreams } from './youtubeAdaptive/streams';

const KEY = 'focus.downloads.v1';
const VIDEO_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';

/**
 * Entrées de téléchargement locales. Une entrée peut contenir `localUri` si
 * un flux direct autorisé a été fourni par l'appelant.
 */
export async function readDownloads() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((video) => video?.videoId);
  } catch {
    return [];
  }
}

export async function writeDownloads(downloads) {
  await AsyncStorage.setItem(KEY, JSON.stringify(downloads));
}

export function isDownloaded(downloads, videoId) {
  return (downloads ?? []).some((video) => video.videoId === videoId);
}

function categorySnapshot(video, categories = []) {
  return categories
    .filter((category) => category?.channelIds?.includes(video.channelId))
    .map((category) => ({ id: category.id, name: category.name }));
}

export async function saveDownload(video, { categories = [], localUri = null } = {}) {
  const entry = {
    videoId: video.videoId,
    title: video.title,
    channelId: video.channelId,
    channelTitle: video.channelTitle,
    publishedAt: video.publishedAt ?? null,
    savedAt: Date.now(),
    thumb: false,
    localUri,
    categories: categorySnapshot(video, categories),
  };

  try {
    await Image.prefetch(thumbnailUri(video.videoId));
    entry.thumb = true;
  } catch {
    // La fiche reste utile même sans miniature.
  }

  const current = await readDownloads();
  const next = [entry, ...current.filter((item) => item.videoId !== video.videoId)];
  await writeDownloads(next);
  return next;
}

/**
 * Downloads a progressive stream after resolving its optional YouTube
 * signature. Adaptive video-only and audio-only formats are intentionally not
 * selected here because they would require a muxing step.
 */
export async function downloadVideoOffline(
  video,
  { categories = [], onProgress, fetchImpl = fetch } = {},
) {
  if (Platform.OS === 'web') {
    throw new Error('Les téléchargements hors ligne sont disponibles sur mobile.');
  }

  const { config } = await loadAdaptiveConfig();
  const result = await fetchPlayerResponse(video.videoId, { config, fetchImpl });
  const streams = listStreams(result.playerResponse);
  const stream = streams
    .filter((candidate) => candidate.hasVideo && candidate.hasAudio)
    .sort((left, right) => (Number.parseInt(left.qualityLabel ?? '0', 10) || 0)
      - (Number.parseInt(right.qualityLabel ?? '0', 10) || 0))[0] ?? null;
  if (!stream) {
    throw new Error('Aucun format vidéo YouTube disponible.');
  }
  const streamUrl = await resolveStreamUrl(stream, result.playerJsUrl, { config, signFunc: config.signFunc, fetchImpl });

  const directory = new Directory(Paths.document, 'downloads');
  directory.create({ intermediates: true, idempotent: true });
  const destination = new File(directory, `${video.videoId}.mp4`);
  const task = LegacyFileSystem.createDownloadResumable(
    streamUrl,
    destination.uri,
    {
      headers: {
        Referer: 'https://www.youtube.com/',
        Origin: 'https://www.youtube.com',
        'User-Agent': VIDEO_USER_AGENT,
        Accept: 'video/mp4,video/*;q=0.9,*/*;q=0.8',
      },
    },
    ({ totalBytesWritten = 0, totalBytesExpectedToWrite = 0 }) => {
      onProgress?.({
        done: totalBytesWritten,
        total: totalBytesExpectedToWrite,
        percent: totalBytesExpectedToWrite > 0
          ? Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100)
          : 0,
      });
    },
  );
  let output;
  try {
    output = await task.downloadAsync();
  } catch (error) {
    throw new Error(`Connexion au flux vidéo impossible: ${error?.message ?? 'Network request failed'}`);
  }
  const downloadedFile = new File(output?.uri ?? destination.uri);
  const downloadedSize = downloadedFile.size ?? 0;
  if (!downloadedFile.exists || downloadedSize < 1024) {
    try {
      downloadedFile.delete();
    } catch {
      // Le fichier incomplet peut déjà avoir été supprimé.
    }
    throw new Error('Le fichier vidéo reçu est vide ou invalide.');
  }

  const downloads = await saveDownload(video, {
    categories,
    localUri: downloadedFile.uri,
  });
  return { downloads, localUri: downloadedFile.uri, stream };
}

export async function deleteDownload(videoId) {
  const current = await readDownloads();
  const removed = current.find((item) => item.videoId === videoId);
  if (Platform.OS !== 'web' && removed?.localUri) {
    try {
      new File(removed.localUri).delete();
    } catch {
      // Le fichier peut déjà avoir été supprimé : on retire la fiche quand même.
    }
  }
  const next = current.filter((item) => item.videoId !== videoId);
  await writeDownloads(next);
  return next;
}
