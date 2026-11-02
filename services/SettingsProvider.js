import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { applyLanguage } from '../i18n';
import { resolveSettings, writeSettings } from './settings';

const SettingsContext = createContext(null);

export function SettingsProvider({ initialSettings, children }) {
  const [settings, setSettings] = useState(initialSettings);
  const settingsRef = useRef(initialSettings);
  const initialRef = useRef(initialSettings);

  useEffect(() => {
    if (initialRef.current === initialSettings) return;
    initialRef.current = initialSettings;
    settingsRef.current = initialSettings;
    setSettings(initialSettings);
    applyLanguage(initialSettings.language).catch((error) => {
      console.error('Unable to apply the saved language preference.', error);
    });
  }, [initialSettings]);

  const updateSettings = useCallback(async (patch) => {
    const previous = settingsRef.current;
    const next = resolveSettings({ ...previous, ...patch });

    settingsRef.current = next;
    setSettings(next);

    try {
      if (Object.prototype.hasOwnProperty.call(patch, 'language')) {
        await applyLanguage(next.language);
      }
      await writeSettings(patch);
    } catch (error) {
      settingsRef.current = previous;
      setSettings(previous);
      if (Object.prototype.hasOwnProperty.call(patch, 'language')) {
        await applyLanguage(previous.language);
      }
      throw error;
    }

    return next;
  }, []);

  const value = useMemo(() => ({ settings, updateSettings }), [settings, updateSettings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider.');
  return context.settings;
}

export function useSetting(key) {
  const settings = useSettings();
  return settings[key];
}

export function useUpdateSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useUpdateSettings must be used within SettingsProvider.');
  return context.updateSettings;
}
