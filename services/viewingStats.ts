import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_PROFILE_ID,
  VIEWING_SCHEMA_VERSION,
} from '../src/domain/viewing';
import type {
  PlaybackDescriptor,
  ViewingDay,
  ViewingFormat,
  ViewingSession,
  ViewingSource,
  ViewingStats,
  ViewingVideoRecord,
} from '../src/domain/viewing';
import { UNCATEGORIZED_KEY, categoryKey } from '../src/domain/categories';
import { DAY_MS, dayKey } from '../src/shared/utils/date';
import { splitIntervalByHour } from '../src/shared/utils/timeSlices';

// Les statistiques de visionnage vivent uniquement sur l'appareil.
//
// Principes :
//   - le temps compté est le temps réel (horloge murale) passé à lire avec
//     l'application au premier plan ; la vitesse de lecture ne le modifie pas ;
//   - chaque mesure est découpée aux frontières d'heure et de jour, pour que
//     « ce jour-là » et « le soir » restent justes ;
//   - une erreur de suivi ne remonte jamais : elle est journalisée et la
//     lecture continue normalement.

const KEY_PREFIX = 'focus.viewing.v1.';
const LEGACY_KEY = 'focus.tracking.v1';

const MAX_DAYS = 400;
const MAX_VIDEOS = 2000;
const MAX_SESSIONS = 600;
const SESSION_GAP_MS = 30 * 60 * 1000;
const MIN_WATCHED_SECONDS = 3;
const ABANDON_RATIO = 0.2;
const COMPLETE_RATIO = 0.9;
const PERSIST_DELAY_MS = 3000;
const MAX_TICK_MS = 5000;

let profileId = DEFAULT_PROFILE_ID;
let state: ViewingStats | null = null;
let loading: Promise<ViewingStats | null> | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let writeChain: Promise<void> = Promise.resolve();
const listeners = new Set<(value: ViewingStats) => void>();

interface Attempt {
  descriptor: Required<Pick<PlaybackDescriptor, 'videoId'>> & PlaybackDescriptor;
  playing: boolean;
  rate: number;
  lastTickAt: number | null;
  lastPosition: number | null;
  contentSeen: number;
  duration: number;
  watched: number;
  counted: boolean;
  completed: boolean;
  finalized: boolean;
}

let attempt: Attempt | null = null;

function warn(issue: unknown) {
  // Volontairement discret : le suivi est un confort, jamais une condition de
  // lecture. Aucune alerte visible n'est déclenchée.
  console.warn('Viewing statistics issue (playback continues).', issue);
}

function storageKey(id: string) {
  return `${KEY_PREFIX}${id}`;
}

function emptyDay(): ViewingDay {
  return {
    seconds: 0,
    byCategory: {},
    byChannel: {},
    byHour: {},
    byFormat: { short: 0, long: 0 },
    bySource: { online: 0, offline: 0 },
    videos: 0,
    completed: 0,
    abandoned: 0,
    sessions: 0,
    contentSeconds: 0,
    speedWeighted: 0,
  };
}

function emptyStats(id = profileId): ViewingStats {
  return {
    schemaVersion: VIEWING_SCHEMA_VERSION,
    profileId: id,
    days: {},
    videos: {},
    categories: {},
    channels: {},
    sessions: [],
    shorts: { current: 0, longest: 0, longestAt: null },
    lastActivityAt: null,
    updatedAt: Date.now(),
  };
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberRecord(value: unknown): Record<string, number> {
  const source = objectOf(value);
  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(source)) {
    const seconds = num(entry);
    if (seconds > 0) result[key] = seconds;
  }
  return result;
}

function sanitizeDay(raw: unknown): ViewingDay {
  const value = objectOf(raw);
  const format = objectOf(value.byFormat);
  const source = objectOf(value.bySource);
  return {
    seconds: num(value.seconds),
    byCategory: numberRecord(value.byCategory),
    byChannel: numberRecord(value.byChannel),
    byHour: numberRecord(value.byHour),
    byFormat: { short: num(format.short), long: num(format.long) },
    bySource: { online: num(source.online), offline: num(source.offline) },
    videos: num(value.videos),
    completed: num(value.completed),
    abandoned: num(value.abandoned),
    sessions: num(value.sessions),
    contentSeconds: num(value.contentSeconds),
    speedWeighted: num(value.speedWeighted),
    ...(value.estimated ? { estimated: true } : {}),
  };
}

function sanitizeStats(raw: unknown, id: string): ViewingStats {
  const value = objectOf(raw);
  if (!raw || typeof raw !== 'object') return emptyStats(id);

  const days: Record<string, ViewingDay> = {};
  for (const [key, entry] of Object.entries(objectOf(value.days))) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) days[key] = sanitizeDay(entry);
  }

  const videos: Record<string, ViewingVideoRecord> = {};
  for (const [key, entry] of Object.entries(objectOf(value.videos))) {
    const item = objectOf(entry);
    if (!item.videoId) continue;
    videos[key] = {
      videoId: String(item.videoId),
      title: String(item.title ?? ''),
      channelId: String(item.channelId ?? ''),
      channelTitle: String(item.channelTitle ?? ''),
      format: item.format === 'short' ? 'short' : 'long',
      categoryId: typeof item.categoryId === 'string' ? item.categoryId : null,
      categoryName: typeof item.categoryName === 'string' ? item.categoryName : null,
      seconds: num(item.seconds),
      contentSeconds: num(item.contentSeconds),
      duration: num(item.duration),
      starts: num(item.starts),
      completed: Boolean(item.completed),
      completedAt: item.completedAt ? num(item.completedAt) : null,
      abandonedCount: num(item.abandonedCount),
      firstAt: item.firstAt ? num(item.firstAt) : null,
      lastAt: item.lastAt ? num(item.lastAt) : null,
    };
  }

  const categories: ViewingStats['categories'] = {};
  for (const [key, entry] of Object.entries(objectOf(value.categories))) {
    const item = objectOf(entry);
    categories[key] = {
      name: typeof item.name === 'string' && item.name ? item.name : null,
      seconds: num(item.seconds),
    };
  }

  const channels: ViewingStats['channels'] = {};
  for (const [key, entry] of Object.entries(objectOf(value.channels))) {
    const item = objectOf(entry);
    channels[key] = {
      title: typeof item.title === 'string' && item.title ? item.title : null,
      seconds: num(item.seconds),
    };
  }

  const sessions: ViewingSession[] = [];
  for (const entry of Array.isArray(value.sessions) ? value.sessions : []) {
    const item = objectOf(entry);
    const start = num(item.start);
    if (!start) continue;
    sessions.push({
      start,
      end: num(item.end, start),
      seconds: num(item.seconds),
      videos: num(item.videos),
    });
  }

  const shorts = objectOf(value.shorts);
  return {
    schemaVersion: VIEWING_SCHEMA_VERSION,
    profileId: id,
    days,
    videos,
    categories,
    channels,
    sessions,
    shorts: {
      current: num(shorts.current),
      longest: num(shorts.longest),
      longestAt: shorts.longestAt ? num(shorts.longestAt) : null,
    },
    lastActivityAt: value.lastActivityAt ? num(value.lastActivityAt) : null,
    updatedAt: num(value.updatedAt, Date.now()),
  };
}

/** Importe une seule fois l'ancien suivi (`focus.tracking.v1`). */
async function migrateLegacy(): Promise<ViewingStats> {
  const empty = emptyStats();
  try {
    const raw = await AsyncStorage.getItem(LEGACY_KEY);
    if (!raw) return empty;
    const parsed: unknown = JSON.parse(raw);
    const legacy = objectOf(parsed);
    const days: Record<string, ViewingDay> = {};
    let lastActivityAt: number | null = null;

    for (const [key, entry] of Object.entries(objectOf(legacy.days))) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
      const value = objectOf(entry);
      const seconds = num(value.seconds);
      if (seconds <= 0) continue;
      const day = emptyDay();
      day.seconds = seconds;
      day.byChannel = numberRecord(value.channels);
      day.bySource.online = seconds;
      day.estimated = true;
      days[key] = day;
    }

    if (Object.keys(days).length === 0) return empty;

    const channels: ViewingStats['channels'] = {};
    for (const [channelId, seconds] of Object.entries(numberRecord(legacy.channels))) {
      channels[channelId] = { title: null, seconds };
    }

    for (const entry of Object.values(objectOf(legacy.videos))) {
      const video = objectOf(entry);
      const channelId = typeof video.channelId === 'string' ? video.channelId : null;
      if (channelId && typeof video.channelTitle === 'string' && channels[channelId]) {
        channels[channelId].title = video.channelTitle;
      }
      const lastAt = num(video.lastAt);
      if (lastAt > 0) lastActivityAt = Math.max(lastActivityAt ?? 0, lastAt);
    }

    return {
      ...empty,
      days,
      channels,
      lastActivityAt,
      updatedAt: Date.now(),
    };
  } catch (issue) {
    warn(issue);
    return empty;
  }
}

function prune() {
  if (!state) return;

  const oldest = dayKey(Date.now() - MAX_DAYS * DAY_MS);
  for (const key of Object.keys(state.days)) {
    if (key < oldest) delete state.days[key];
  }

  const videos = Object.values(state.videos);
  if (videos.length > MAX_VIDEOS) {
    videos.sort((a, b) => (a.lastAt ?? 0) - (b.lastAt ?? 0));
    for (const video of videos.slice(0, videos.length - MAX_VIDEOS)) {
      delete state.videos[video.videoId];
    }
  }

  const sessions = state.sessions;
  const cutoff = Date.now() - MAX_DAYS * DAY_MS;
  let firstKept = 0;
  while (firstKept < sessions.length && sessions[firstKept].end < cutoff) firstKept += 1;
  if (firstKept > 0) state.sessions = sessions.slice(firstKept);
  if (state.sessions.length > MAX_SESSIONS) {
    state.sessions = state.sessions.slice(state.sessions.length - MAX_SESSIONS);
  }
}

function emit() {
  if (!state) return;
  for (const listener of listeners) listener(state);
}

function schedulePersist() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void writeNow();
  }, PERSIST_DELAY_MS);
}

function writeNow(): Promise<void> {
  const current = state;
  if (!current) return Promise.resolve();
  let payload: string;
  try {
    prune();
    payload = JSON.stringify(current);
  } catch (issue) {
    warn(issue);
    return Promise.resolve();
  }
  writeChain = writeChain
    .then(() => AsyncStorage.setItem(storageKey(current.profileId), payload))
    .catch((issue) => {
      warn(issue);
    });
  return writeChain;
}

/** Force l'écriture (arrière-plan, fermeture, réinitialisation). */
export function flushViewingStats(): Promise<void> {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  return writeNow();
}

export async function initViewingStats(id: string = DEFAULT_PROFILE_ID): Promise<ViewingStats> {
  profileId = id || DEFAULT_PROFILE_ID;
  if (state && state.profileId === profileId) return state;
  if (loading) return (await loading) ?? emptyStats(profileId);

  loading = (async () => {
    try {
      let raw: string | null = null;
      try {
        raw = await AsyncStorage.getItem(storageKey(profileId));
      } catch (issue) {
        warn(issue);
      }
      const loaded = raw === null
        ? await migrateLegacy()
        : sanitizeStats(JSON.parse(raw), profileId);
      loaded.profileId = profileId;
      state = loaded;
      prune();
      if (raw === null) {
        // Écrit immédiatement (même vide) : cela empêche une nouvelle tentative
        // d'import après une réinitialisation.
        await writeNow();
      }
      return state;
    } catch (issue) {
      warn(issue);
      state = emptyStats(profileId);
      return state;
    }
  })();

  const result = await loading;
  loading = null;
  return result ?? emptyStats(profileId);
}

export function getViewingStats(): ViewingStats | null {
  return state;
}

export function subscribeViewingStats(listener: (value: ViewingStats) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function currentDay(timestamp: number): ViewingDay {
  if (!state) throw new Error('Viewing statistics are not ready.');
  const key = dayKey(timestamp);
  const existing = state.days[key];
  if (existing) return existing;
  const day = emptyDay();
  state.days[key] = day;
  return day;
}

function touchVideo(descriptor: PlaybackDescriptor, now = Date.now()): ViewingVideoRecord {
  if (!state) throw new Error('Viewing statistics are not ready.');
  const current = state.videos[descriptor.videoId];
  if (current) {
    if (descriptor.title) current.title = descriptor.title;
    if (descriptor.channelId) current.channelId = descriptor.channelId;
    if (descriptor.channelTitle) current.channelTitle = descriptor.channelTitle;
    if (descriptor.format) current.format = descriptor.format;
    if (descriptor.categoryId !== undefined) {
      current.categoryId = descriptor.categoryId ?? null;
    }
    if (descriptor.categoryName !== undefined) {
      current.categoryName = descriptor.categoryName ?? null;
    }
    return current;
  }
  const fresh: ViewingVideoRecord = {
    videoId: descriptor.videoId,
    title: descriptor.title ?? '',
    channelId: descriptor.channelId ?? '',
    channelTitle: descriptor.channelTitle ?? '',
    format: descriptor.format ?? 'long',
    categoryId: descriptor.categoryId ?? null,
    categoryName: descriptor.categoryName ?? null,
    seconds: 0,
    contentSeconds: 0,
    duration: 0,
    starts: 0,
    completed: false,
    completedAt: null,
    abandonedCount: 0,
    firstAt: now,
    lastAt: null,
  };
  state.videos[descriptor.videoId] = fresh;
  return fresh;
}

/** Répartit un intervalle réel sur les heures et les jours locaux. */
function applyInterval(startMs: number, endMs: number, callback: (timestamp: number, seconds: number) => void) {
  for (const slice of splitIntervalByHour(startMs, endMs)) {
    callback(slice.timestamp, slice.seconds);
  }
}

function categoryLabel(categoryId: string | null): string | null {
  if (!state) return null;
  const key = categoryKey(categoryId);
  if (key === UNCATEGORIZED_KEY) return null;
  return state.categories[key]?.name ?? null;
}

function addWatchTime(timestamp: number, millis: number, active: Attempt) {
  if (!state || millis <= 0) return;
  const channelId = active.descriptor.channelId || 'unknown';
  const key = categoryKey(active.descriptor.categoryId ?? null);
  const categoryName = active.descriptor.categoryName ?? categoryLabel(active.descriptor.categoryId ?? null);
  const format: ViewingFormat = active.descriptor.format ?? 'long';
  const source: ViewingSource = active.descriptor.source ?? 'online';

  const start = timestamp - millis;
  applyInterval(start, timestamp, (stamp, seconds) => {
    if (!state || seconds <= 0) return;
    const day = currentDay(stamp);
    const hour = String(new Date(stamp).getHours());

    day.seconds += seconds;
    day.byHour[hour] = (day.byHour[hour] ?? 0) + seconds;
    day.byFormat[format] = (day.byFormat[format] ?? 0) + seconds;
    day.bySource[source] = (day.bySource[source] ?? 0) + seconds;
    day.byChannel[channelId] = (day.byChannel[channelId] ?? 0) + seconds;
    day.byCategory[key] = (day.byCategory[key] ?? 0) + seconds;
    day.speedWeighted += seconds * Math.max(0.25, Math.min(4, active.rate));

    const channel = state.channels[channelId] ?? { title: null, seconds: 0 };
    channel.seconds += seconds;
    if (!channel.title && active.descriptor.channelTitle) {
      channel.title = active.descriptor.channelTitle;
    }
    state.channels[channelId] = channel;

    const category = state.categories[key] ?? { name: null, seconds: 0 };
    category.seconds += seconds;
    if (!category.name && categoryName) category.name = categoryName;
    state.categories[key] = category;

    const video = touchVideo(active.descriptor, timestamp);
    video.seconds += seconds;
    video.lastAt = timestamp;
    if (active.duration > 0) video.duration = active.duration;

    state.lastActivityAt = timestamp;
    state.shorts = state.shorts ?? { current: 0, longest: 0, longestAt: null };
  });
}

function currentSession(timestamp: number): ViewingSession {
  if (!state) throw new Error('Viewing statistics are not ready.');
  const last = state.sessions[state.sessions.length - 1];
  if (last && timestamp - last.end <= SESSION_GAP_MS) return last;
  const session: ViewingSession = { start: timestamp, end: timestamp, seconds: 0, videos: 0 };
  state.sessions.push(session);
  currentDay(timestamp).sessions += 1;
  return session;
}

function accumulate(now: number) {
  if (!state || !attempt || !attempt.playing || attempt.lastTickAt === null) return;
  const previous = attempt.lastTickAt;
  attempt.lastTickAt = now;

  let delta = now - previous;
  if (!(delta > 0) || delta > MAX_TICK_MS) return;

  const seconds = delta / 1000;
  attempt.watched += seconds;
  addWatchTime(now, delta, attempt);

  const session = currentSession(now);
  session.end = now;
  session.seconds += seconds;

  if (!attempt.counted && attempt.watched >= MIN_WATCHED_SECONDS) {
    attempt.counted = true;
    const day = currentDay(now);
    day.videos += 1;
    session.videos += 1;
    const video = touchVideo(attempt.descriptor, now);
    video.starts += 1;
    video.lastAt = now;

    if ((attempt.descriptor.format ?? 'long') === 'short') {
      state.shorts.current += 1;
      if (state.shorts.current > state.shorts.longest) {
        state.shorts.longest = state.shorts.current;
        state.shorts.longestAt = now;
      }
    } else {
      state.shorts.current = 0;
    }
  }
}

function maybeComplete(now: number) {
  if (!state || !attempt || attempt.finalized) return;
  if (!(attempt.duration > 0)) return;
  if (attempt.contentSeen < attempt.duration * COMPLETE_RATIO) return;

  const video = touchVideo(attempt.descriptor, now);
  attempt.completed = true;
  if (video.completed) return;

  video.completed = true;
  video.completedAt = now;
  video.lastAt = now;
  currentDay(now).completed += 1;
}

function finalize(now = Date.now()) {
  if (!attempt || attempt.finalized) return;
  accumulate(now);
  attempt.finalized = true;
  attempt.playing = false;

  if (state && attempt.counted) {
    const video = touchVideo(attempt.descriptor, now);
    video.duration = attempt.duration || video.duration;
    video.lastAt = now;
    if (
      !video.completed &&
      attempt.duration > 0 &&
      attempt.contentSeen < attempt.duration * ABANDON_RATIO
    ) {
      video.abandonedCount += 1;
      currentDay(now).abandoned += 1;
    }
  }

  attempt = null;
  if (state) state.updatedAt = Date.now();
  schedulePersist();
  emit();
}

/** Démarre une lecture (ou remplace la précédente). */
export function viewingBegin(descriptor: PlaybackDescriptor) {
  try {
    if (!state || !descriptor?.videoId) return;
    finalize();
    const now = Date.now();
    attempt = {
      descriptor,
      playing: false,
      rate: 1,
      lastTickAt: null,
      lastPosition: null,
      contentSeen: 0,
      duration: 0,
      watched: 0,
      counted: false,
      completed: false,
      finalized: false,
    };
    const video = touchVideo(descriptor, now);
    if (!video.lastAt) video.lastAt = now;
    // Une nouvelle lecture interrompt une éventuelle série de Shorts : la série
    // se mesure sur des lectures consécutives réellement commencées.
    if ((descriptor.format ?? 'long') !== 'short' && state.shorts.current > 0) {
      state.shorts.current = 0;
    }
    state.updatedAt = now;
    emit();
  } catch (issue) {
    warn(issue);
  }
}

/** Indique si la vidéo joue vraiment (pause, arrière-plan : faux). */
export function viewingSetPlaying(playing: boolean, rate = 1) {
  try {
    if (!attempt) return;
    const now = Date.now();
    const nextRate = Number.isFinite(rate) && rate > 0 ? rate : 1;

    if (playing && attempt.playing) {
      if (attempt.rate !== nextRate) {
        accumulate(now);
        attempt.rate = nextRate;
        attempt.lastTickAt = now;
      }
      return;
    }

    if (!playing && attempt.playing) {
      accumulate(now);
      attempt.playing = false;
      attempt.lastTickAt = null;
      schedulePersist();
      return;
    }

    if (playing && !attempt.playing) {
      attempt.rate = nextRate;
      attempt.playing = true;
      attempt.lastTickAt = now;
    }
  } catch (issue) {
    warn(issue);
  }
}

/** Position et durée envoyées par le lecteur (toutes les ~500 ms). */
export function viewingProgress({
  position = 0,
  duration = 0,
}: {
  position?: number;
  duration?: number;
}) {
  try {
    if (!attempt) return;
    const now = Date.now();

    if (duration > 0 && Math.abs(duration - attempt.duration) > 0.5) {
      attempt.duration = duration;
    }

    if (attempt.playing) {
      accumulate(now);
      if (attempt.lastPosition !== null) {
        const delta = position - attempt.lastPosition;
        // Seuls les petits pas en avant comptent comme du contenu vu : un saut
        // dans la barre de progression ne valide jamais une vidéo.
        if (delta > 0 && delta < 2.5) {
          attempt.contentSeen += delta;
          const video = touchVideo(attempt.descriptor, now);
          video.contentSeconds += delta;
          video.lastAt = now;
        }
      }
    }

    attempt.lastPosition = position;
    maybeComplete(now);
    state!.updatedAt = now;
    schedulePersist();
    emit();
  } catch (issue) {
    warn(issue);
  }
}

/** Termine la lecture courante et clôt la session en cours de mesure. */
export function viewingEnd() {
  try {
    finalize();
  } catch (issue) {
    warn(issue);
  }
}

/** Réinitialise les statistiques du profil courant, et lui seul. */
export async function resetViewingStats(id: string = profileId): Promise<void> {
  if (attempt) {
    attempt = null;
  }
  profileId = id || DEFAULT_PROFILE_ID;
  state = emptyStats(profileId);
  emit();
  try {
    await writeChain;
    await AsyncStorage.setItem(storageKey(profileId), JSON.stringify(state));
  } catch (issue) {
    warn(issue);
  }
}

/** Utilisé par les tests pour repartir d'un état vierge. */
export async function clearViewingStatsForTests(id: string = DEFAULT_PROFILE_ID): Promise<void> {
  attempt = null;
  state = null;
  loading = null;
  profileId = id;
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  await AsyncStorage.removeItem(storageKey(id)).catch(() => {});
}
