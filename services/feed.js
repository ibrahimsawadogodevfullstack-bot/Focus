import { CHANNEL_IDS } from '../constants/channels';
import { parseFeed } from './rssParser';
import { readFeedCache, writeFeedCache } from './storage';

const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12000;
const CONCURRENCY = 4;

export const feedUrl = (channelId) =>
  `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/atom+xml, application/xml, text/xml' },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchChannel(channelId) {
  const xml = await fetchWithTimeout(feedUrl(channelId));
  return parseFeed(xml, channelId);
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function mergeFeeds(feeds) {
  const byId = new Map();
  const channels = new Map();

  for (const feed of feeds) {
    if (!feed) continue;
    if (feed.channelId && feed.channelTitle) {
      channels.set(feed.channelId, feed.channelTitle);
    }
    for (const video of feed.videos) {
      if (!byId.has(video.videoId)) {
        byId.set(video.videoId, {
          ...video,
          channelTitle: video.channelTitle || channels.get(video.channelId) || '',
        });
      }
    }
  }

  const videos = [...byId.values()].sort((a, b) => b.publishedAt - a.publishedAt);

  return {
    videos,
    channels: [...channels.entries()].map(([id, title]) => ({ id, title })),
  };
}

export async function fetchFeed(channelIds = CHANNEL_IDS) {
  const startedAt = Date.now();
  const settled = await mapWithConcurrency(channelIds, CONCURRENCY, async (id) => {
    try {
      return { id, feed: await fetchChannel(id), error: null };
    } catch (error) {
      return { id, feed: null, error: error?.message ?? 'Erreur inconnue' };
    }
  });

  const feeds = settled.map((item) => item.feed).filter(Boolean);
  if (feeds.length === 0) {
    const firstError = settled.find((item) => item.error)?.error;
    throw new Error(firstError || 'Aucune chaîne n’a pu être chargée.');
  }

  const merged = mergeFeeds(feeds);
  const payload = {
    ...merged,
    savedAt: Date.now(),
    failedChannels: settled.filter((item) => item.error).map((item) => item.id),
    fetchDurationMs: Date.now() - startedAt,
  };

  await writeFeedCache(payload);
  return { ...payload, fromCache: false };
}

export async function loadFeed({ force = false } = {}) {
  const cached = await readFeedCache();
  const isFresh = cached && Date.now() - (cached.savedAt ?? 0) < CACHE_TTL_MS;

  if (cached && isFresh && !force) {
    return { ...cached, fromCache: true };
  }

  try {
    return await fetchFeed();
  } catch (error) {
    if (cached) {
      return { ...cached, fromCache: true, error: error?.message };
    }
    throw error;
  }
}
