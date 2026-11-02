import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Settings, SettingsPatch } from '../domain/settings';

const KEY = 'focus.settings.v1';
export const SETTINGS_SCHEMA_VERSION = 2;
export const GOAL_MIN = 1;
export const GOAL_MAX = 20;
export const SHORTS_POSITIONS = ['top', 'after-first-row'] as const;
export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  weeklyGoal: 8,
  autoplayNext: false,
  shortsPosition: 'after-first-row',
  language: 'system',
  theme: 'system',
  playbackSpeed: 1,
  subtitles: false,
  hideShorts: false,
  dataSaver: false,
});

interface SettingsStorage {
  get: () => Promise<string | null>;
  set: (value: string) => Promise<void>;
}

export const settingsStorage: SettingsStorage = {
  get: () => AsyncStorage.getItem(KEY),
  set: (value) => AsyncStorage.setItem(KEY, value),
};

let cache: Settings | null = null;

function clampGoal(value: unknown): number {
  const goal = Number(value);
  if (!Number.isFinite(goal)) return DEFAULT_SETTINGS.weeklyGoal;
  return Math.min(GOAL_MAX, Math.max(GOAL_MIN, Math.round(goal)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isShortsPosition(value: unknown): value is Settings['shortsPosition'] {
  return SHORTS_POSITIONS.some((position) => position === value);
}

function migrate(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return { ...DEFAULT_SETTINGS };

  if (raw.schemaVersion === SETTINGS_SCHEMA_VERSION) {
    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      schemaVersion: SETTINGS_SCHEMA_VERSION,
    };
  }

  // v1 only contained the weekly goal, autoplay switch, and Shorts position.
  return {
    ...DEFAULT_SETTINGS,
    weeklyGoal: raw.weeklyGoal,
    autoplayNext: raw.autoplayNext,
    shortsPosition: raw.shortsPosition,
  };
}

function sanitize(raw: unknown): Settings {
  const migrated = migrate(raw);
  const language = migrated.language;
  const theme = migrated.theme;
  const playbackSpeed = Number(migrated.playbackSpeed);
  return {
    ...DEFAULT_SETTINGS,
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    weeklyGoal: clampGoal(migrated.weeklyGoal),
    autoplayNext: Boolean(migrated.autoplayNext),
    shortsPosition: isShortsPosition(migrated.shortsPosition)
      ? migrated.shortsPosition
      : DEFAULT_SETTINGS.shortsPosition,
    language: language === 'system' || language === 'fr' || language === 'en'
      ? language
      : DEFAULT_SETTINGS.language,
    theme: theme === 'system' || theme === 'light' || theme === 'dark'
      ? theme
      : DEFAULT_SETTINGS.theme,
    playbackSpeed: PLAYBACK_SPEEDS.some((speed) => speed === playbackSpeed)
      ? playbackSpeed
      : DEFAULT_SETTINGS.playbackSpeed,
    subtitles: Boolean(migrated.subtitles),
    hideShorts: Boolean(migrated.hideShorts),
    dataSaver: Boolean(migrated.dataSaver),
  };
}

export function resolveSettings(raw: unknown): Settings {
  return sanitize(raw);
}

export async function readSettings(): Promise<Settings> {
  if (cache) return cache;

  try {
    const raw = await settingsStorage.get();
    const stored: unknown = raw ? JSON.parse(raw) : null;
    cache = sanitize(stored);
    if (!raw || !isRecord(stored) || stored.schemaVersion !== SETTINGS_SCHEMA_VERSION) {
      await settingsStorage.set(JSON.stringify(cache));
    }
  } catch (error) {
    console.error('Unable to load saved settings; using defaults.', error);
    cache = { ...DEFAULT_SETTINGS };
  }

  return cache;
}

export function getSettings(): Settings {
  return cache ?? { ...DEFAULT_SETTINGS };
}

export async function writeSettings(patch: SettingsPatch): Promise<Settings> {
  const previous = cache ?? { ...DEFAULT_SETTINGS };
  const next = sanitize({ ...previous, ...patch });
  cache = next;

  try {
    await settingsStorage.set(JSON.stringify(next));
  } catch (error) {
    cache = previous;
    throw new Error('Unable to save settings.', { cause: error });
  }

  return next;
}

export function clearSettingsCacheForTests(): void {
  cache = null;
}
