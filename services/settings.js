import AsyncStorage from '@react-native-async-storage/async-storage';

// Préférences locales de l'élève. Trois réglages seulement, tous stockés sur
// l'appareil : objectif hebdomadaire, lecture continue, place de la rangée
// Shorts sur l'accueil.
const KEY = 'focus.settings.v1';

export const GOAL_MIN = 1;
export const GOAL_MAX = 20;
export const SHORTS_POSITIONS = ['top', 'after-first-row'];

export const DEFAULT_SETTINGS = {
  weeklyGoal: 8,
  autoplayNext: false,
  shortsPosition: 'after-first-row',
};

let cache = null;

function clampGoal(value) {
  const goal = Number(value);
  if (!Number.isFinite(goal)) return DEFAULT_SETTINGS.weeklyGoal;
  return Math.min(GOAL_MAX, Math.max(GOAL_MIN, Math.round(goal)));
}

function sanitize(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  return {
    weeklyGoal: clampGoal(raw.weeklyGoal),
    autoplayNext: Boolean(raw.autoplayNext),
    shortsPosition: SHORTS_POSITIONS.includes(raw.shortsPosition)
      ? raw.shortsPosition
      : DEFAULT_SETTINGS.shortsPosition,
  };
}

export async function readSettings() {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = sanitize(raw ? JSON.parse(raw) : null);
  } catch {
    cache = { ...DEFAULT_SETTINGS };
  }
  return cache;
}

export function getSettings() {
  return cache ?? { ...DEFAULT_SETTINGS };
}

/** Écrit un ou plusieurs réglages et renvoie l'état complet à jour. */
export async function writeSettings(patch) {
  cache = sanitize({ ...(cache ?? DEFAULT_SETTINGS), ...patch });
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Un réglage non persisté reste appliqué pour la session en cours.
  }
  return cache;
}
