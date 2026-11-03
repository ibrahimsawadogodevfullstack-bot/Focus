export type ShortsPosition = 'top' | 'after-first-row';
export type LanguagePreference = 'system' | 'fr' | 'en';
export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  schemaVersion: number;
  weeklyGoal: number;
  autoplayNext: boolean;
  shortsPosition: ShortsPosition;
  language: LanguagePreference;
  theme: ThemePreference;
  playbackSpeed: number;
  subtitles: boolean;
  hideShorts: boolean;
  dataSaver: boolean;
}

export type SettingsPatch = Partial<Omit<Settings, 'schemaVersion'>>;
