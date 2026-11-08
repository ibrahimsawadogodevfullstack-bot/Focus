import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ChoiceSheet from '../components/ChoiceSheet';
import ConfirmSheet from '../src/shared/ui/ConfirmSheet';
import PageHeader from '../src/shared/ui/PageHeader';
import SettingsRow from '../components/SettingsRow';
import SettingsSection from '../components/SettingsSection';
import { colors, spacing } from '../src/shared/theme/tokens';
import { useThemeStyles } from '../src/shared/theme/ThemeProvider';
import { clearThumbnailCache } from '../services/thumbnails';
import { PLAYBACK_SPEEDS } from '../services/settings';
import { useSettings, useUpdateSettings } from '../services/SettingsProvider';
import type { Settings } from '../src/domain/settings';

const LANGUAGE_OPTIONS = [
  { value: 'system', labelKey: 'systemLanguage' },
  { value: 'fr', labelKey: 'french' },
  { value: 'en', labelKey: 'english' },
] as const;

const THEME_OPTIONS = [
  { value: 'system', labelKey: 'themeSystem' },
  { value: 'light', labelKey: 'light' },
  { value: 'dark', labelKey: 'dark' },
] as const;

export default function SettingsScreen({
  onBack,
  backLabel,
  onOpenStatsSettings,
}: {
  onBack: () => void;
  backLabel?: string;
  onOpenStatsSettings: () => void;
}) {
  const { t } = useTranslation(['settings', 'you', 'common', 'errors']);
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const themedStyles = useThemeStyles(styles);

  const [activeChoice, setActiveChoice] = useState<
    'language' | 'theme' | 'playbackSpeed' | null
  >(null);
  const [confirmingCache, setConfirmingCache] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const save = async (patch: Partial<Settings>) => {
    setError(null);
    setNotice(null);
    try {
      await updateSettings(patch);
    } catch (issue) {
      console.error('Unable to persist a user preference.', issue);
      setError(t('errors:settingsSave'));
    }
  };

  const languageLabel = t(
    `you:${LANGUAGE_OPTIONS.find((option) => option.value === settings.language)?.labelKey ?? 'systemLanguage'}`,
  );
  const themeLabel = t(
    `you:${THEME_OPTIONS.find((option) => option.value === settings.theme)?.labelKey ?? 'themeSystem'}`,
  );

  const choices =
    activeChoice === 'language'
      ? LANGUAGE_OPTIONS.map((option) => ({ value: option.value, label: t(`you:${option.labelKey}`) }))
      : activeChoice === 'theme'
        ? THEME_OPTIONS.map((option) => ({ value: option.value, label: t(`you:${option.labelKey}`) }))
        : PLAYBACK_SPEEDS.map((value) => ({ value, label: `${value}×` }));

  const title =
    activeChoice === 'language'
      ? t('language')
      : activeChoice === 'theme'
        ? t('theme')
        : t('defaultSpeed');

  const clearCache = async () => {
    if (Platform.OS === 'web') {
      setError(t('cacheClearUnavailable'));
      return;
    }
    setClearingCache(true);
    setError(null);
    setNotice(null);
    try {
      const results = await Promise.all([
        Image.clearMemoryCache(),
        Image.clearDiskCache(),
      ]);
      if (results.some((result) => !result)) {
        throw new Error('The image cache could not be cleared.');
      }
      clearThumbnailCache();
      setNotice(t('clearCacheDone'));
    } catch (issue) {
      console.error('Unable to clear the image cache.', issue);
      setError(t('errors:cacheClear'));
    } finally {
      setClearingCache(false);
      setConfirmingCache(false);
    }
  };

  const appVersion = Constants.expoConfig?.version ?? Constants.manifest?.version ?? '—';

  return (
    <SafeAreaView edges={['top']} style={themedStyles.screen}>
      <ScrollView contentContainerStyle={themedStyles.content} showsVerticalScrollIndicator={false}>
        <PageHeader title={t('title')} backLabel={backLabel} onBack={onBack} />

        <SettingsSection title={t('generalSection')}>
          <SettingsRow
            kind="choice"
            label={t('language')}
            value={languageLabel}
            onPress={() => setActiveChoice('language')}
            accessibilityLabel={t('you:choiceAccessibility', {
              label: t('language'),
              value: languageLabel,
            })}
          />
          <SettingsRow
            kind="choice"
            label={t('theme')}
            value={themeLabel}
            onPress={() => setActiveChoice('theme')}
            accessibilityLabel={t('you:choiceAccessibility', {
              label: t('theme'),
              value: themeLabel,
            })}
            last
          />
        </SettingsSection>

        <SettingsSection title={t('playbackSection')}>
          <SettingsRow
            kind="switch"
            label={t('autoplay')}
            description={t('autoplayDescription')}
            value={settings.autoplayNext}
            onValueChange={(value) => save({ autoplayNext: value })}
          />
          <SettingsRow
            kind="choice"
            label={t('defaultSpeed')}
            value={`${settings.playbackSpeed}×`}
            onPress={() => setActiveChoice('playbackSpeed')}
          />
          <SettingsRow
            kind="switch"
            label={t('subtitles')}
            description={t('subtitlesDescription')}
            value={settings.subtitles}
            onValueChange={(value) => save({ subtitles: value })}
            last
          />
        </SettingsSection>

        <SettingsSection title={t('focusSection')}>
          <SettingsRow
            kind="switch"
            label={t('hideShorts')}
            description={t('hideShortsDescription')}
            value={settings.hideShorts}
            onValueChange={(value) => save({ hideShorts: value })}
            last
          />
        </SettingsSection>

        <SettingsSection title={t('dataSection')}>
          <SettingsRow
            kind="switch"
            label={t('dataSaver')}
            description={t('dataSaverDescription')}
            value={settings.dataSaver}
            onValueChange={(value) => save({ dataSaver: value })}
          />
          <SettingsRow
            kind="action"
            label={t('clearCache')}
            description={Platform.OS === 'web' ? t('cacheClearUnavailable') : undefined}
            value={clearingCache ? t('common:loading') : null}
            onPress={() => setConfirmingCache(true)}
            disabled={clearingCache || Platform.OS === 'web'}
            last
          />
        </SettingsSection>

        <SettingsSection title={t('statisticsSection')}>
          <SettingsRow
            kind="action"
            label={t('myStats')}
            description={t('myStatsDescription')}
            value={t('open')}
            onPress={onOpenStatsSettings}
            accessibilityLabel={t('myStats')}
            last
          />
        </SettingsSection>

        <SettingsSection title={t('accountSection')}>
          <SettingsRow
            kind="information"
            label={t('accountLocal')}
            description={t('accountLocalDescription')}
            last
          />
        </SettingsSection>

        <SettingsSection title={t('aboutSection')}>
          <SettingsRow kind="information" label={t('version')} value={appVersion} last />
        </SettingsSection>

        {error || notice ? (
          <Text
            accessibilityLiveRegion="polite"
            style={error ? themedStyles.error : themedStyles.notice}
          >
            {error ?? notice}
          </Text>
        ) : null}
      </ScrollView>

      <ChoiceSheet
        visible={Boolean(activeChoice)}
        title={title}
        choices={choices}
        selectedValue={activeChoice ? settings[activeChoice] : undefined}
        onChoose={(value: string | number) => {
          const setting = activeChoice;
          setActiveChoice(null);
          if (setting) save({ [setting]: value } as Partial<Settings>);
        }}
        onClose={() => setActiveChoice(null)}
      />

      <ConfirmSheet
        visible={confirmingCache}
        title={t('clearCacheConfirmTitle')}
        message={t('clearCacheConfirmMessage')}
        confirmLabel={t('clearCache')}
        onConfirm={clearCache}
        onCancel={() => setConfirmingCache(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.xl,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  notice: {
    color: colors.success,
    fontSize: 13,
    textAlign: 'center',
  },
});
