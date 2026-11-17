// Chargement des vidéos d'une chaîne au-delà des 15 entrées du flux RSS.
//
// Le flux RSS ne pagine pas : on demande les tranches suivantes à yt-dlp, déjà
// embarqué dans l'application (`listChannelVideos`). Chaque page est mise en
// cache en mémoire et les appels concurrents pour la même page sont fusionnés,
// pour qu'un scroll rapide ne lance pas plusieurs extractions.

import { Ytdlp } from '../modules/ytdlp';
import {
  toChannelVideos,
  type ChannelIdentity,
  type ChannelPageVideo,
} from './channelPageModel';

/** Nombre de vidéos demandées par page. Doit rester ≤ 50 (limite native). */
export const CHANNEL_PAGE_SIZE = 30;

export type ChannelPageResult = {
  videos: ChannelPageVideo[];
  hasMore: boolean;
};

const pages = new Map<string, Map<number, ChannelPageResult>>();
const inflight = new Map<string, Promise<ChannelPageResult>>();

/** Faux sur le web : le module natif yt-dlp n'existe pas. */
export function isChannelPaginationAvailable(): boolean {
  return Ytdlp != null;
}

function keyFor(channelId: string, page: number, pageSize: number): string {
  return `${channelId}:${pageSize}:${page}`;
}

/**
 * Charge la page `page` (0 = vidéos 1..30, 1 = 31..60, …).
 *
 * En cas d'erreur réseau, rien n'est mis en cache : l'appelant peut proposer
 * « Réessayer » et relancer la même page.
 */
export async function fetchChannelPage({
  channel,
  channelTitle = '',
  page,
  pageSize = CHANNEL_PAGE_SIZE,
}: {
  channel: ChannelIdentity;
  channelTitle?: string;
  page: number;
  pageSize?: number;
}): Promise<ChannelPageResult> {
  const safePage = Math.max(0, Math.trunc(page) || 0);
  const safeSize = Math.min(50, Math.max(1, Math.trunc(pageSize) || CHANNEL_PAGE_SIZE));
  const key = keyFor(channel.id, safePage, safeSize);

  const cached = pages.get(channel.id)?.get(safePage);
  if (cached) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  if (!Ytdlp) return { videos: [], hasMore: false };

  const task = (async () => {
    const response = await Ytdlp.listChannelVideos({
      channelId: channel.id,
      start: safePage * safeSize + 1,
      count: safeSize,
    });
    const result: ChannelPageResult = {
      videos: toChannelVideos(response.videos, channel, channelTitle),
      // Une page pleine laisse penser qu'il en reste : la page suivante
      // tranchera. Une page vide ou incomplète arrête le chargement.
      hasMore: Boolean(response.hasMore),
    };

    let channelPages = pages.get(channel.id);
    if (!channelPages) {
      channelPages = new Map();
      pages.set(channel.id, channelPages);
    }
    channelPages.set(safePage, result);
    return result;
  })();

  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}

/** Vide le cache d'une chaîne (par exemple après un changement de titre). */
export function resetChannelPages(channelId: string): void {
  pages.delete(channelId);
}
