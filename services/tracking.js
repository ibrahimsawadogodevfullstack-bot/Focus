import AsyncStorage from '@react-native-async-storage/async-storage';

import { DAY_MS, dayKey } from '../src/shared/utils/date.ts';

const KEY = 'focus.tracking.v1';

// Bornes de rétention : au-delà, les entrées les plus anciennes sont retirées.
// Sans cela, `videos` et `days` grossissent indéfiniment et AsyncStorage finit
// par refuser les écritures, silencieusement.
const MAX_VIDEOS = 800;
const MAX_DAY_AGE = 365;

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

export { dayKey };

export async function initTracking() {
  if (state) return state;
  if (!loading) {
    loading = AsyncStorage.getItem(KEY)
      .catch(() => null)
      .then((raw) => {
        state = parse(raw);
        prune();
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

/** Retire les jours trop anciens, puis les vidéos au-delà du plafond. */
function prune() {
  if (!state) return;

  const oldestDay = dayKey(Date.now() - MAX_DAY_AGE * DAY_MS);
  for (const key of Object.keys(state.days)) {
    if (key < oldestDay) delete state.days[key];
  }

  const entries = Object.values(state.videos);
  if (entries.length <= MAX_VIDEOS) return;

  entries.sort((a, b) => (a.lastAt ?? 0) - (b.lastAt ?? 0));
  for (const entry of entries.slice(0, entries.length - MAX_VIDEOS)) {
    delete state.videos[entry.videoId];
  }
}

function persist() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    prune();
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

/** Efface tout l'historique local (bouton « Effacer mes données »). */
export async function resetTracking() {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  state = { videos: {}, days: {}, channels: {} };
  await AsyncStorage.removeItem(KEY).catch(() => {});
  emit();
}
