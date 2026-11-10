import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ChoiceSheet from '../components/ChoiceSheet';
import ConfirmSheet from '../src/shared/ui/ConfirmSheet';
import PageHeader from '../src/shared/ui/PageHeader';
import SettingsRow from '../components/SettingsRow';
import SettingsSection from '../components/SettingsSection';
import { colors, fontSize, radius, spacing } from '../src/shared/theme/tokens';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';
import { useSettings, useUpdateSettings } from '../services/SettingsProvider';
import {
  STATS_GOAL_MAX_MINUTES,
  STATS_GOAL_MIN_MINUTES,
  STATS_GOAL_PRESETS,
} from '../services/settings';
import { resetViewingStats } from '../services/viewingStats';
import type { Settings } from '../src/domain/settings';
import type { ViewingPeriod } from '../src/domain/viewing';

export default function StatsSettingsScreen({
  onBack,
  backLabel,
}: {
  onBack: () => void;
  backLabel?: string;
}) {
  const { t } = useTranslation(['viewing', 'common']);
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const themedStyles = useThemeStyles(styles);
  const { colors: theme } = useTheme();

  const [choice, setChoice] = useState<'goal' | 'period' | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const save = async (patch: Partial<Settings>) => {
    setNotice(null);
    try {
      await updateSettings(patch);
    } catch (issue) {
      console.error('Unable to save statistics settings.', issue);
      setNotice(t('errors:settingsSave'));
    }
  };

  const goal = settings.statsGoalMinutes;
  const goalLabel = goal > 0 ? t('minutesValue', { count: goal }) : t('goalNoneShort');
  const presets = STATS_GOAL_PRESETS.filter((value) => value > 0);
  const goalChoices = [
    { value: 'none', label: t('goalNoneShort') },
    ...presets.map((value) => ({ value: String(value), label: t('minutesValue', { count: value }) })),
    { value: 'custom', label: t('goalCustom') },
  ];
  const goalSelected = goal === 0 ? 'none' : presets.includes(goal) ? String(goal) : 'custom';

  const periodChoices: { value: ViewingPeriod; label: string }[] = [
    { value: 'today', label: t('periodToday') },
    { value: '7d', label: t('period7') },
    { value: '30d', label: t('period30') },
  ];

  const openCustom = () => {
    setCustomValue(goal > 0 ? String(goal) : '30');
    setCustomError(null);
    setCustomOpen(true);
  };

  const saveCustom = async () => {
    const value = Number(customValue.replace(',', '.'));
    if (
      !Number.isFinite(value) ||
      value < STATS_GOAL_MIN_MINUTES ||
      value > STATS_GOAL_MAX_MINUTES
    ) {
      setCustomError(t('goalCustomInvalid'));
      return;
    }
    setCustomError(null);
    setCustomOpen(false);
    await save({ statsGoalMinutes: Math.round(value) });
  };

  const reset = async () => {
    setConfirmingReset(false);
    try {
      await resetViewingStats();
      setNotice(t('resetDone'));
    } catch (issue) {
      console.error('Unable to reset viewing statistics.', issue);
      setNotice(t('resetError'));
    }
  };

  return (
    <SafeAreaView edges={['top']} style={themedStyles.screen}>
      <PageHeader
        title={t('statsSettingsTitle')}
        backLabel={backLabel}
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={themedStyles.content} showsVerticalScrollIndicator={false}>
        <SettingsSection title={t('goalSection')}>
          <SettingsRow
            kind="choice"
            label={t('goalTitle')}
            value={goalLabel}
            onPress={() => setChoice('goal')}
            accessibilityLabel={t('choiceAccessibility', { label: t('goalTitle'), value: goalLabel })}
            last
          />
        </SettingsSection>

        <SettingsSection title={t('displaySection')}>
          <SettingsRow
            kind="choice"
            label={t('defaultPeriod')}
            value={t(
              settings.statsDefaultPeriod === 'today'
                ? 'periodToday'
                : settings.statsDefaultPeriod === '30d'
                  ? 'period30'
                  : 'period7',
            )}
            onPress={() => setChoice('period')}
            accessibilityLabel={t('choiceAccessibility', {
              label: t('defaultPeriod'),
              value: t(
                settings.statsDefaultPeriod === 'today'
                  ? 'periodToday'
                  : settings.statsDefaultPeriod === '30d'
                    ? 'period30'
                    : 'period7',
              ),
            })}
          />
          <SettingsRow
            kind="switch"
            label={t('showSummary')}
            description={t('showSummaryDescription')}
            value={settings.statsShowSummary}
            onValueChange={(value) => save({ statsShowSummary: value })}
          />
          <SettingsRow
            kind="switch"
            label={t('showStats')}
            description={t('showStatsDescription')}
            value={settings.statsVisible}
            onValueChange={(value) => save({ statsVisible: value })}
            last
          />
        </SettingsSection>

        <SettingsSection title={t('resetSection')}>
          <SettingsRow
            kind="action"
            label={t('resetTitle')}
            description={t('resetDescription')}
            onPress={() => setConfirmingReset(true)}
            accessibilityLabel={t('resetTitle')}
            last
          />
        </SettingsSection>

        <Text style={themedStyles.privacy}>{t('privacyNote')}</Text>

        {notice ? (
          <Text accessibilityLiveRegion="polite" style={themedStyles.notice}>
            {notice}
          </Text>
        ) : null}
      </ScrollView>

      <ChoiceSheet
        visible={choice === 'goal'}
        title={t('goalTitle')}
        choices={goalChoices}
        selectedValue={goalSelected}
        onChoose={(value: string) => {
          setChoice(null);
          if (value === 'custom') {
            openCustom();
            return;
          }
          save({ statsGoalMinutes: value === 'none' ? 0 : Number(value) });
        }}
        onClose={() => setChoice(null)}
      />

      <ChoiceSheet
        visible={choice === 'period'}
        title={t('defaultPeriod')}
        choices={periodChoices}
        selectedValue={settings.statsDefaultPeriod}
        onChoose={(value: string | number) => {
          setChoice(null);
          save({ statsDefaultPeriod: value as ViewingPeriod });
        }}
        onClose={() => setChoice(null)}
      />

      <ConfirmSheet
        visible={confirmingReset}
        title={t('resetConfirmTitle')}
        message={t('resetConfirmMessage')}
        confirmLabel={t('resetConfirm')}
        destructive
        onConfirm={reset}
        onCancel={() => setConfirmingReset(false)}
      />

      <Modal
        visible={customOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomOpen(false)}
        statusBarTranslucent
      >
        <View style={themedStyles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setCustomOpen(false)}
            accessible={false}
            importantForAccessibility="no"
          />
          <View style={themedStyles.dialog}>
            <Text style={themedStyles.dialogTitle}>{t('goalCustomTitle')}</Text>
            <Text style={themedStyles.dialogHint}>{t('goalCustomHint')}</Text>
            <TextInput
              value={customValue}
              onChangeText={setCustomValue}
              keyboardType="number-pad"
              inputMode="numeric"
              autoFocus
              maxLength={3}
              accessibilityLabel={t('goalCustomTitle')}
              placeholder="30"
              placeholderTextColor={theme.textFaint}
              style={themedStyles.input}
            />
            {customError ? <Text style={themedStyles.error}>{customError}</Text> : null}
            <View style={themedStyles.dialogActions}>
              <Pressable
                onPress={() => setCustomOpen(false)}
                accessibilityRole="button"
                style={({ pressed }) => [themedStyles.dialogButton, pressed && themedStyles.pressed]}
              >
                <Text style={themedStyles.dialogCancel}>{t('common:cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={saveCustom}
                accessibilityRole="button"
                style={({ pressed }) => [
                  themedStyles.dialogButton,
                  themedStyles.dialogPrimary,
                  pressed && themedStyles.pressed,
                ]}
              >
                <Text style={themedStyles.dialogSave}>{t('common:save')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    gap: spacing.lg,
  },
  privacy: {
    color: colors.textFaint,
    fontSize: fontSize.caption,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  notice: {
    color: colors.success,
    fontSize: fontSize.label,
    textAlign: 'center',
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(2, 4, 10, 0.72)',
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  dialogTitle: {
    color: colors.text,
    fontSize: fontSize.title,
    fontWeight: '700',
    textAlign: 'center',
  },
  dialogHint: {
    color: colors.textMuted,
    fontSize: fontSize.meta,
    lineHeight: 17,
    textAlign: 'center',
  },
  input: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    fontSize: fontSize.headline,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.meta,
    textAlign: 'center',
  },
  dialogActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dialogButton: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  dialogPrimary: {
    backgroundColor: colors.accent,
  },
  dialogCancel: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  dialogSave: {
    color: colors.onAccent,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
});
