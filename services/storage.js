import AsyncStorage from '@react-native-async-storage/async-storage';

const FEED_KEY = 'focus.feed.v1';
const SEEN_KEY = 'focus.seen.v1';
const SEEN_LIMIT = 2000;

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
