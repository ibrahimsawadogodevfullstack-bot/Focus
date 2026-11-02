import { DEFAULT_CHANNEL_IDS } from '../constants/channels';
import { feedUrl } from './feedUrl';
import { netFetch } from './net';
import { parseFeed } from './rssParser';
import { startPerformance } from './performance';
import { readFeedCache, writeFeedCache } from './storage';

const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12000;
const CONCURRENCY = 4;

export { feedUrl };

async function fetchWithTimeout(url, channelId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const finish = startPerformance('feed.request', { channelId });
  let outcome = { result: 'error' };
  try {
    const response = await netFetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/atom+xml, application/xml, text/xml' },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const body = await response.text();
    outcome = { result: 'ok', status: response.status, responseChars: body.length };
    return body;
  } catch (error) {
    outcome = {
      result: 'error',
      errorName: error?.name ?? 'Error',
      message: error?.message ?? 'Request failed',
    };
    throw error;
  } finally {
    clearTimeout(timer);
    finish(outcome);
  }
}

async function fetchChannel(channelId) {
  const xml = await fetchWithTimeout(feedUrl(channelId), channelId);
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
        // On ne stampe plus `format` ici : un « video » par défaut serait
        // indiscernable d'un vrai format fourni par une API. Le classement est
        // appliqué au rendu (resolveFormats), une fois les sondes connues.
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

export async function fetchFeed(channelIds = DEFAULT_CHANNEL_IDS, { onProgress } = {}) {
  const startedAt = Date.now();
  const total = channelIds.length;
  let done = 0;

  // Chaque chaîne terminée fait avancer la barre : « 8/17 · 47 % ».
  onProgress?.({ done, total, percent: 0 });

  const settled = await mapWithConcurrency(channelIds, CONCURRENCY, async (id) => {
    try {
      return { id, feed: await fetchChannel(id), error: null };
    } catch (error) {
      return { id, feed: null, error: error?.message ?? 'Erreur inconnue' };
    } finally {
      done += 1;
      onProgress?.({ done, total, percent: Math.round((done / total) * 100) });
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
    channelKey: [...channelIds].sort().join(','),
    savedAt: Date.now(),
    failedChannels: settled.filter((item) => item.error).map((item) => item.id),
    fetchDurationMs: Date.now() - startedAt,
  };

  await writeFeedCache(payload);
  return { ...payload, fromCache: false };
}

export async function loadFeed({
  channelIds = DEFAULT_CHANNEL_IDS,
  force = false,
  onProgress,
  onCached,
} = {}) {
  const finish = startPerformance('feed.load', {
    channelCount: channelIds.length,
    force,
  });
  const channelKey = [...channelIds].sort().join(',');
  const cached = await readFeedCache();
  const sameScope = cached && cached.channelKey === channelKey;
  const isFresh = cached && Date.now() - (cached.savedAt ?? 0) < CACHE_TTL_MS;

  if (sameScope && isFresh && !force) {
    onProgress?.({ done: channelIds.length, total: channelIds.length, percent: 100 });
    finish({
      source: 'cache',
      cacheAgeMs: Math.max(0, Date.now() - cached.savedAt),
      videoCount: cached.videos?.length ?? 0,
    });
    return { ...cached, fromCache: true };
  }

  if (sameScope && cached && !isFresh && !force) {
    onCached?.({ ...cached, fromCache: true });
  }

  try {
    const result = await fetchFeed(channelIds, { onProgress });
    finish({
      source: 'network',
      videoCount: result.videos.length,
      failedChannelCount: result.failedChannels.length,
    });
    return result;
  } catch (error) {
    if (sameScope && cached) {
      onProgress?.({ done: channelIds.length, total: channelIds.length, percent: 100 });
      finish({
        source: 'stale-cache',
        result: 'network-error',
        cacheAgeMs: Math.max(0, Date.now() - cached.savedAt),
        videoCount: cached.videos?.length ?? 0,
      });
      return { ...cached, fromCache: true, error: error?.message };
    }
    finish({ source: 'network', result: 'error' });
    throw error;
  }
}
