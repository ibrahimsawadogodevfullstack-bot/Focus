// Transformation des pages renvoyées par yt-dlp en vidéos du flux.
//
// L'extraction « rapide » (`--flat-playlist`) d'un onglet `/videos` ne donne
// que l'identifiant, le titre, la durée et le nombre de vues : pas de date de
// publication. Les cartes affichent donc la durée et les vues, et laissent la
// date vide (`publishedAt: 0`). L'ordre de la chaîne reste chronologique.
//
// Ces fonctions sont pures : la requête réseau et le cache vivent dans
// `services/channelVideos.ts`.

import type { YtdlpChannelVideo } from '../modules/ytdlp';

export type ChannelIdentity = { id: string; title?: string };

export type ChannelPageVideo = {
  videoId: string;
  channelId: string;
  channelTitle: string;
  title: string;
  publishedAt: number;
  thumbnail: string;
  url: string;
  urlSource: 'generated';
  format: 'video';
  isShort: false;
  duration: number;
  viewCount?: number;
};

function thumbnailFor(videoId: string, provided?: string | null): string {
  // Les URLs signées de yt-dlp finissent par expirer ; cette forme stable est
  // identique à celle utilisée par le flux RSS.
  const value = typeof provided === 'string' ? provided.trim() : '';
  if (value.startsWith('https://i.ytimg.com/')) return value;
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Convertit une page native en vidéos prêtes pour `FeedScreen`.
 *
 * Les entrées sans identifiant sont ignorées. Les doublons internes à la page
 * sont éliminés : une chaîne ne devrait pas en produire, mais une réponse
 * inattendue ne doit pas casser la grille.
 */
export function toChannelVideos(
  entries: YtdlpChannelVideo[] | null | undefined,
  channel: ChannelIdentity,
  channelTitle = '',
): ChannelPageVideo[] {
  const name = channelTitle || channel.title || '';
  const seen = new Set<string>();
  const videos: ChannelPageVideo[] = [];

  for (const entry of entries ?? []) {
    if (!entry || typeof entry !== 'object') continue;
    const videoId = typeof entry.videoId === 'string' ? entry.videoId.trim() : '';
    if (!videoId || seen.has(videoId)) continue;
    seen.add(videoId);

    const duration = Number(entry.durationSec);
    const viewCount = Number(entry.viewCount);
    const views = Number.isFinite(viewCount) && viewCount > 0 ? viewCount : undefined;

    videos.push({
      videoId,
      channelId: channel.id,
      channelTitle: name,
      title: entry.title?.trim() || 'Vidéo',
      publishedAt: 0,
      thumbnail: thumbnailFor(videoId, entry.thumbnailUrl),
      url: `https://www.youtube.com/watch?v=${videoId}`,
      urlSource: 'generated',
      format: 'video',
      isShort: false,
      duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
      viewCount: views,
    });
  }

  return videos;
}

/**
 * Fusionne deux listes sans doublon, en gardant l'ordre d'arrivée : les 15
 * vidéos du RSS d'abord, puis les pages chargées dans l'ordre de la chaîne.
 */
export function mergeChannelVideos<T extends { videoId?: string }>(
  existing: T[] | null | undefined,
  incoming: T[] | null | undefined,
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const video of existing ?? []) {
    const videoId = video?.videoId;
    if (!videoId || seen.has(videoId)) continue;
    seen.add(videoId);
    merged.push(video);
  }
  for (const video of incoming ?? []) {
    const videoId = video?.videoId;
    if (!videoId || seen.has(videoId)) continue;
    seen.add(videoId);
    merged.push(video);
  }

  return merged;
}
