import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import ChoiceSheet from '../components/ChoiceSheet';
import ConfirmSheet from '../src/shared/ui/ConfirmSheet';
import { PersonIcon } from '../src/shared/ui/Icons';
import ScreenHeader from '../src/shared/ui/ScreenHeader';
import SettingsRow from '../components/SettingsRow';
import SettingsSection from '../components/SettingsSection';
import { colors, spacing } from '../src/shared/theme/tokens';
import { useThemeStyles } from '../src/shared/theme/ThemeProvider';
import { clearThumbnailCache } from '../services/thumbnails';
import { PLAYBACK_SPEEDS } from '../services/settings';
import { useSettings, useUpdateSettings } from '../services/SettingsProvider';

const CHOICE_OPTIONS = {
  language: [
    { value: 'system', labelKey: 'systemLanguage' },
    { value: 'fr', labelKey: 'french' },
    { value: 'en', labelKey: 'english' },
  ],
  theme: [
    { value: 'system', labelKey: 'themeSystem' },
    { value: 'light', labelKey: 'light' },
    { value: 'dark', labelKey: 'dark' },
  ],
  playbackSpeed: PLAYBACK_SPEEDS.map((value) => ({
    value,
    label: `${value}×`,
  })),
};

function ChoiceValue({ setting, value, t }) {
  const option = CHOICE_OPTIONS[setting].find((item) => item.value === value);
  return option?.label ?? t(`you:${option?.labelKey ?? 'themeSystem'}`);
}

export default function YouScreen() {
  const { t } = useTranslation(['you', 'common']);
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const themedStyles = useThemeStyles(styles);
  const [activeChoice, setActiveChoice] = useState(null);
  const [confirmingCache, setConfirmingCache] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const save = async (patch) => {
    setError(null);
    setNotice(null);
    try {
      await updateSettings(patch);
    } catch (issue) {
      console.error('Unable to persist a user preference.', issue);
      setError(t('errors:settingsSave'));
    }
  };

  const options = activeChoice ? CHOICE_OPTIONS[activeChoice] : [];
  const choices = options.map((option) => ({
    value: option.value,
    label: option.label ?? t(`you:${option.labelKey}`),
  }));

  const clearCache = async () => {
    if (Platform.OS === 'web') {
      setError(t('you:cacheClearUnavailable'));
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
      setNotice(t('you:clearCacheDone'));
    } catch (issue) {
      console.error('Unable to clear the image cache.', issue);
      setError(t('errors:cacheClear'));
    } finally {
      setClearingCache(false);
      setConfirmingCache(false);
    }
  };

  const speedLabel = `${settings.playbackSpeed}×`;
  const appVersion =
    Constants.expoConfig?.version ??
    Constants.manifest?.version ??
    '—';

  return (
    <SafeAreaView edges={['top']} style={themedStyles.screen}>
      <ScrollView
        contentContainerStyle={themedStyles.content}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title={t('you:title')} />

        <View style={themedStyles.profile}>
          <View style={themedStyles.profileAvatar}>
            <PersonIcon color={colors.onAccent} size={22} />
          </View>
          <Text style={themedStyles.profileNote}>{t('you:profileUnavailable')}</Text>
        </View>

        <SettingsSection title={t('you:appearanceSection')}>
          <SettingsRow
            kind="choice"
            label={t('you:language')}
            value={<ChoiceValue setting="language" value={settings.language} t={t} />}
            onPress={() => setActiveChoice('language')}
            accessibilityLabel={t('you:choiceAccessibility', {
              label: t('you:language'),
              value: t(`you:${CHOICE_OPTIONS.language.find((item) => item.value === settings.language)?.labelKey}`),
            })}
          />
          <SettingsRow
            kind="choice"
            label={t('you:theme')}
            value={<ChoiceValue setting="theme" value={settings.theme} t={t} />}
            onPress={() => setActiveChoice('theme')}
            last
          />
        </SettingsSection>

        <SettingsSection title={t('you:playbackSection')}>
          <SettingsRow
            kind="switch"
            label={t('you:autoplay')}
            description={t('you:autoplayDescription')}
            value={settings.autoplayNext}
            onValueChange={(value) => save({ autoplayNext: value })}
          />
          <SettingsRow
            kind="choice"
            label={t('you:defaultSpeed')}
            value={speedLabel}
            onPress={() => setActiveChoice('playbackSpeed')}
          />
          <SettingsRow
            kind="switch"
            label={t('you:subtitles')}
            description={t('you:subtitlesDescription')}
            value={settings.subtitles}
            onValueChange={(value) => save({ subtitles: value })}
            last
          />
        </SettingsSection>

        <SettingsSection title={t('you:focusSection')}>
          <SettingsRow
            kind="switch"
            label={t('you:hideShorts')}
            description={t('you:hideShortsDescription')}
            value={settings.hideShorts}
            onValueChange={(value) => save({ hideShorts: value })}
            last
          />
        </SettingsSection>

        <SettingsSection title={t('you:dataSection')}>
          <SettingsRow
            kind="switch"
            label={t('you:dataSaver')}
            description={t('you:dataSaverDescription')}
            value={settings.dataSaver}
            onValueChange={(value) => save({ dataSaver: value })}
            last
          />
          <SettingsRow
            kind="action"
            label={t('you:clearCache')}
            description={Platform.OS === 'web' ? t('you:cacheClearUnavailable') : undefined}
            value={clearingCache ? t('common:loading') : null}
            onPress={() => setConfirmingCache(true)}
            disabled={clearingCache || Platform.OS === 'web'}
          />
        </SettingsSection>

        <SettingsSection title={t('you:aboutSection')}>
          <SettingsRow kind="information" label={t('you:version')} value={appVersion} last />
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
        title={
          activeChoice === 'language'
            ? t('you:language')
            : activeChoice === 'theme'
              ? t('you:theme')
              : t('you:defaultSpeed')
        }
        choices={choices}
        selectedValue={activeChoice ? settings[activeChoice] : undefined}
        onChoose={(value) => {
          const setting = activeChoice;
          setActiveChoice(null);
          if (setting) save({ [setting]: value });
        }}
        onClose={() => setActiveChoice(null)}
      />

      <ConfirmSheet
        visible={confirmingCache}
        title={t('you:clearCacheConfirmTitle')}
        message={t('you:clearCacheConfirmMessage')}
        confirmLabel={t('you:clearCache')}
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
  profile: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  profileNote: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
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
