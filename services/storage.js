import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_CHANNELS } from '../constants/channels';

const FEED_KEY = 'focus.feed.v1';
const SEEN_KEY = 'focus.seen.v1';
const CHANNELS_KEY = 'focus.channels.v2';
const CATEGORIES_KEY = 'focus.categories.v1';
const SHORTS_KEY = 'focus.shorts.v1';
const SEEN_LIMIT = 2000;
const SHORTS_LIMIT = 400;

const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;

export async function readFeedCache() {
  try {
    const raw = await AsyncStorage.getItem(FEED_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function writeFeedCache(payload) {
  try {
    await AsyncStorage.setItem(FEED_KEY, JSON.stringify(payload));
  } catch {
    // Le cache est un confort : un échec d'écriture ne doit pas casser le flux.
  }
}

export async function readSeenIds() {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addSeenId(videoId) {
  if (!videoId) return [];
  const seen = await readSeenIds();
  if (seen.includes(videoId)) return seen;
  const next = [videoId, ...seen].slice(0, SEEN_LIMIT);
  try {
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

/** Vidéos repérées comme « Shorts » à la lecture (durée très courte). */
export async function readShortIds() {
  try {
    const raw = await AsyncStorage.getItem(SHORTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export async function addShortId(videoId) {
  if (!videoId) return [];
  const current = await readShortIds();
  if (current.includes(videoId)) return current;
  const next = [videoId, ...current].slice(0, SHORTS_LIMIT);
  try {
    await AsyncStorage.setItem(SHORTS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

function sanitizeChannels(value) {  if (!Array.isArray(value)) return null;

  const byId = new Map();
  for (const entry of value) {
    if (!entry || typeof entry.id !== 'string' || !CHANNEL_ID.test(entry.id)) continue;
    const title = typeof entry.title === 'string' ? entry.title.trim() : '';
    if (!byId.has(entry.id)) {
      byId.set(entry.id, { id: entry.id, title });
    }
  }

  return [...byId.values()];
}

/** Chaînes suivies (fournies au premier lancement, puis personnalisées). */
export async function readChannels() {
  try {
    const raw = await AsyncStorage.getItem(CHANNELS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const channels = sanitizeChannels(parsed);
    if (channels && channels.length > 0) return channels;
    if (channels && channels.length === 0) return [];
  } catch {
    // Stockage illisible : on repart des chaînes par défaut.
  }

  return DEFAULT_CHANNELS.map((channel) => ({ ...channel }));
}

export async function writeChannels(channels) {
  try {
    await AsyncStorage.setItem(CHANNELS_KEY, JSON.stringify(channels));
  } catch {
    // ignore
  }
}

function sanitizeCategories(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry) => entry && typeof entry.id === 'string' && typeof entry.name === 'string')
    .map((entry) => ({
      id: entry.id,
      name: entry.name.trim().slice(0, 40),
      channelIds: Array.isArray(entry.channelIds)
        ? entry.channelIds.filter((id) => typeof id === 'string' && CHANNEL_ID.test(id))
        : [],
    }))
    .filter((entry) => entry.name.length > 0 && entry.channelIds.length > 0);
}

export async function readCategories() {
  try {
    const raw = await AsyncStorage.getItem(CATEGORIES_KEY);
    return sanitizeCategories(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

export async function writeCategories(categories) {
  try {
    await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  } catch {
    // ignore
  }
}
