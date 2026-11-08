import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import en from './locales/en.json';
import fr from './locales/fr.json';

export const FALLBACK_LANGUAGE = 'fr';
export const SUPPORTED_LANGUAGES = ['fr', 'en'];

export function resolveLanguage(preference = 'system', systemLocale) {
  if (preference === 'fr' || preference === 'en') return preference;

  const locale =
    systemLocale ??
    (typeof navigator !== 'undefined' ? navigator.language : getLocales()[0]?.languageTag) ??
    FALLBACK_LANGUAGE;
  const language = locale.toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LANGUAGES.includes(language) ? language : FALLBACK_LANGUAGE;
}

export const i18nReady = i18next.isInitialized
  ? Promise.resolve(i18next)
  : i18next.use(initReactI18next).init({
    resources: { en, fr },
    lng: FALLBACK_LANGUAGE,
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    ns: ['common', 'tabs', 'home', 'you', 'errors', 'categories', 'channels', 'stats', 'player', 'offline', 'crash', 'downloads', 'viewing', 'settings'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    returnNull: false,
  });

export async function applyLanguage(preference) {
  await i18nReady;
  const language = resolveLanguage(preference);
  await i18next.changeLanguage(language);

  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
  }

  return language;
}

export default i18next;
