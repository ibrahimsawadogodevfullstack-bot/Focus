import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'react-native';

import { thumbnailUri } from './offline';

const KEY = 'focus.downloads.v1';

/**
 * Téléchargements façon YouTube : le menu « … » d'une vidéo enregistre sa
 * fiche et sa miniature. Le fichier vidéo n'est pas enregistré : le lecteur
 * officiel ne le permet pas, la lecture demande une connexion.
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

export async function saveDownload(video) {
  const entry = {
    videoId: video.videoId,
    title: video.title,
    channelId: video.channelId,
    channelTitle: video.channelTitle,
    publishedAt: video.publishedAt ?? null,
    savedAt: Date.now(),
    thumb: false,
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

export async function deleteDownload(videoId) {
  const current = await readDownloads();
  const next = current.filter((item) => item.videoId !== videoId);
  await writeDownloads(next);
  return next;
}
