import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'focus.tracking.v1';

const EMPTY = {
  videos: {},
  days: {},
  channels: {},
};

let state = null;
let loading = null;
const listeners = new Set();
let writeTimer = null;

function parse(raw) {
  if (!raw) return { ...EMPTY };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...EMPTY };
    return {
      videos: parsed.videos ?? {},
      days: parsed.days ?? {},
      channels: parsed.channels ?? {},
    };
  } catch {
    return { ...EMPTY };
  }
}

export function dayKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export async function initTracking() {
  if (state) return state;
  if (!loading) {
    loading = AsyncStorage.getItem(KEY)
      .catch(() => null)
      .then((raw) => {
        state = parse(raw);
        return state;
      });
  }
  return loading;
}

export function getTracking() {
  return state ?? { ...EMPTY };
}

export function subscribeTracking(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener(state);
}

function persist() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    if (state) AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, 700);
}

function entry(video) {
  const current = state.videos[video.videoId];
  if (current) return current;
  const fresh = {
    videoId: video.videoId,
    channelId: video.channelId,
    channelTitle: video.channelTitle,
    title: video.title,
    publishedAt: video.publishedAt ?? null,
    seconds: 0,
    position: 0,
    duration: 0,
    completed: false,
    completedAt: null,
    lastAt: null,
    opens: 0,
    replays: 0,
    lastReplayAt: null,
    rating: null,
    ratedAt: null,
  };
  state.videos[video.videoId] = fresh;
  return fresh;
}

function touch(video) {
  if (!state) state = { ...EMPTY, videos: {}, days: {}, channels: {} };
  const item = entry(video);
  item.channelId = video.channelId ?? item.channelId;
  item.channelTitle = video.channelTitle ?? item.channelTitle;
  item.title = video.title ?? item.title;
  return item;
}

/** Ouverture d'une vidéo : compte les consultations. */
export function markOpened(video) {
  if (!video?.videoId) return;
  const item = touch(video);
  item.opens += 1;
  item.lastAt = Date.now();
  persist();
  emit();
}

/**
 * Temps effectif : n'enregistre que les secondes réellement vues.
 * `seconds` est un delta, `position` la position courante.
 */
export function trackPlayback({ video, seconds = 0, position = 0, duration = 0, completed = false }) {
  if (!video?.videoId) return;
  const item = touch(video);
  const now = Date.now();
  const watched = Math.max(0, Math.min(seconds, 120));

  if (watched > 0) {
    item.seconds += watched;
    item.lastAt = now;

    const key = dayKey(now);
    const day = state.days[key] ?? { seconds: 0, channels: {} };
    day.seconds += watched;

    const channelId = item.channelId ?? 'unknown';
    day.channels[channelId] = (day.channels[channelId] ?? 0) + watched;
    state.days[key] = day;

    state.channels[channelId] = (state.channels[channelId] ?? 0) + watched;
  }

  if (position > 0) item.position = position;
  if (duration > 0) item.duration = duration;

  if (completed && !item.completed) {
    item.completed = true;
    item.completedAt = now;
    item.lastAt = now;
  }

  persist();
  emit();
}

/** Retour en arrière volontaire : sert à repérer les passages à revoir. */
export function trackReplay(video, atSeconds) {
  if (!video?.videoId) return;
  const item = touch(video);
  item.replays += 1;
  item.lastReplayAt = Math.max(0, Math.round(atSeconds));
  item.lastAt = Date.now();
  persist();
  emit();
}

export function setRating(video, rating) {
  if (!video?.videoId) return;
  const item = touch(video);
  item.rating = rating;
  item.ratedAt = Date.now();
  item.lastAt = Date.now();
  persist();
  emit();
}

export async function resetTracking() {
  state = { videos: {}, days: {}, channels: {} };
  await AsyncStorage.removeItem(KEY).catch(() => {});
  emit();
}
