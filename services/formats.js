import AsyncStorage from '@react-native-async-storage/async-storage';

import { FORMAT_SHORT, FORMAT_VIDEO, isFormatResolved } from './filters';
import { verticalThumb } from './thumbnails';

// Détection du format réel (vertical / horizontal) de chaque vidéo.
//
// Depuis que `rssParser` conserve le lien « alternate » de chaque entrée,
// /shorts/ et /watch?v= tranchent sans réseau. La sonde ci-dessous ne sert plus
// qu'aux anciens caches et aux données sans lien : YouTube ne génère la
// miniature « ratio d'origine » (`oardefault.jpg`) que pour les vidéos
// verticales, donc un HEAD suffit — 200 = verticale, 404 = horizontale. La
// réponse est minuscule, autorise le CORS, et le résultat est conservé.

const KEY = 'focus.formats.v1';
const CONCURRENCY = 4;
const PROBE_TIMEOUT_MS = 8000;
const MAX_ENTRIES = 5000;

let formats = null;
let loading = null;
let running = false;
let notifyTimer = null;
let persistTimer = null;

const listeners = new Set();
const inFlight = new Set();
// Sondes terminées sans réponse (réseau, 5xx…). On ne les mémorise pas dans le
// cache, mais on les expose à l'interface : une carte ne doit pas rester un
// placeholder indéfiniment à cause d'un échec ponctuel.
const failed = new Set();

function parse(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const clean = {};
    for (const [videoId, value] of Object.entries(parsed)) {
      if (value === FORMAT_SHORT || value === FORMAT_VIDEO) clean[videoId] = value;
    }
    return clean;
  } catch {
    return {};
  }
}

export async function initFormats() {
  if (formats) return formats;
  if (!loading) {
    loading = AsyncStorage.getItem(KEY)
      .catch(() => null)
      .then((raw) => {
        formats = parse(raw);
        return formats;
      });
  }
  return loading;
}

export function getFormats() {
  return formats ?? {};
}

export function subscribeFormats(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  // Copie à chaque émission : les sondes mutent `formats` en place. Sans
  // nouvelle référence, React (et les useMemo en aval) ignorerait les résultats
  // suivants et les cartes resteraient des placeholders.
  const snapshot = { ...(formats ?? {}) };
  for (const listener of listeners) listener(snapshot);
}

function scheduleNotify() {
  if (notifyTimer) return;
  // Les sondes arrivent par vagues : on regroupe les rendus plutôt que de
  // reconstruire la grille 240 fois.
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    emit();
  }, 400);
}

function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (!formats) return;
    const entries = Object.entries(formats);
    const trimmed =
      entries.length > MAX_ENTRIES
        ? Object.fromEntries(entries.slice(entries.length - MAX_ENTRIES))
        : formats;
    AsyncStorage.setItem(KEY, JSON.stringify(trimmed)).catch(() => {});
  }, 1500);
}

/**
 * Interroge YouTube sur l'orientation d'une vidéo.
 * Renvoie null en cas d'erreur réseau : on ne mémorise alors rien, pour ne pas
 * figer un mauvais classement (hors ligne, proxy, etc.).
 */
async function probe(videoId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(verticalThumb(videoId), {
      method: 'HEAD',
      signal: controller.signal,
    });
    if (response.status === 200) return FORMAT_SHORT;
    if (response.status === 404) return FORMAT_VIDEO;
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Vrai si la vidéo n'a pas encore de format connu. Un lien RSS /shorts/ ou
 * /watch, un hashtag ou des dimensions sont déjà une preuve : inutile de
 * sonder YouTube pour eux. La sonde ne sert plus qu'aux caches anciens.
 */
export function needsProbe(video, known = formats ?? {}) {
  if (!video?.videoId || known[video.videoId]) return false;
  return !isFormatResolved(video, known);
}

/** Vrai si la dernière sonde a échoué (réseau) : on cesse d'attendre. */
export function hasFailedFormat(videoId) {
  return failed.has(videoId);
}

/**
 * Sonde les vidéos dont le format est inconnu, sans bloquer l'affichage.
 * Les résultats arrivent progressivement : la grille se réorganise à mesure
 * que les Shorts rejoignent leur rangée.
 */
export async function detectFormats(videos = [], { concurrency = CONCURRENCY } = {}) {
  if (running) return;
  await initFormats();

  const todo = videos.filter((video) => needsProbe(video) && !inFlight.has(video.videoId));
  if (todo.length === 0) return;

  running = true;
  let cursor = 0;
  let dirty = false;

  const worker = async () => {
    while (cursor < todo.length) {
      const video = todo[cursor];
      cursor += 1;

      if (formats[video.videoId]) continue;

      inFlight.add(video.videoId);
      const result = await probe(video.videoId);
      inFlight.delete(video.videoId);

      if (result) {
        formats[video.videoId] = result;
        failed.delete(video.videoId);
        dirty = true;
        scheduleNotify();
        schedulePersist();
      } else {
        // Échec réseau : on l'expose pour que la carte cesse d'attendre, mais
        // on ne le persiste pas (nouvelle tentative au prochain chargement).
        failed.add(video.videoId);
        scheduleNotify();
      }
    }
  };

  try {
    await Promise.all(
      Array.from({ length: Math.min(concurrency, todo.length) }, () => worker()),
    );
  } finally {
    running = false;
  }

  if (dirty) {
    if (notifyTimer) {
      clearTimeout(notifyTimer);
      notifyTimer = null;
    }
    emit();
    schedulePersist();
  }
}
