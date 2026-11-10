import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import ChannelAvatar from '../src/shared/ui/ChannelAvatar';
import ChannelImportReportView from '../src/shared/ui/ChannelImportReport';
import ConfirmSheet from '../src/shared/ui/ConfirmSheet';
import EmptyState from '../src/shared/ui/EmptyState';
import { TrashIcon } from '../src/shared/ui/Icons';
import ScreenShell from '../src/shared/ui/ScreenShell';
import SectionLabel from '../src/shared/ui/SectionLabel';
import { colors, fontSize, radius, spacing } from '../src/shared/theme/tokens';
import { splitChannelInput } from '../services/channelImport';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';

export default function ChannelsScreen({
  channels,
  avatars = {},
  onAddSources,
  onRemoveChannel,
}) {
  const { colors } = useTheme();
  const styles = useThemeStyles(baseStyles);
  const { t } = useTranslation();
  const scrollRef = useRef(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [report, setReport] = useState(null);
  const [revealTarget, setRevealTarget] = useState(null);
  const [error, setError] = useState(null);
  const [pendingRemove, setPendingRemove] = useState(null);

  // La liste est mise à jour par le parent : on attend donc que le nouveau
  // nombre de chaînes soit atteint pour défiler jusqu'aux lignes ajoutées.
  useEffect(() => {
    if (revealTarget == null || channels.length < revealTarget) return;
    setRevealTarget(null);
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [channels.length, revealTarget]);

  const entries = splitChannelInput(draft);
  const canSubmit = entries.length > 0 && !busy;

  const handleAdd = async () => {
    if (!canSubmit) return;

    setBusy(true);
    setError(null);
    setReport(null);
    setProgress({ done: 0, total: entries.length });
    try {
      const result = await onAddSources(entries.join(','), {
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setReport(result);
      if (result.added.length > 0) {
        setDraft('');
        Keyboard.dismiss();
        // La liste suivie est juste en dessous : on y amène l'utilisateur pour
        // qu'il voie immédiatement les chaînes qui viennent d'arriver.
        setRevealTarget(channels.length + result.added.length);
      }
    } catch {
      setError(t('channels:addFailed'));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const handleRemove = async () => {
    const channel = pendingRemove;
    setPendingRemove(null);
    if (channel) await onRemoveChannel(channel.id);
  };

  return (
    <>
      <ScreenShell
        title={t('channels:title')}
        meta={t('channels:followed', { count: channels.length })}
        scrollRef={scrollRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >

        <View style={styles.addCard}>
          <Text style={styles.fieldLabel}>
            {entries.length > 1
              ? t('channels:addTitleMany')
              : t('channels:addTitle')}
          </Text>
          <TextInput
            value={draft}
            onChangeText={(value) => {
              setDraft(value);
              if (report) setReport(null);
              if (error) setError(null);
            }}
            placeholder={t('channels:inputPlaceholderMany')}
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={!busy}
            accessibilityLabel={t('channels:inputAccessibilityMany')}
            style={styles.input}
          />

          <View style={styles.metaRow}>
            <Text style={styles.helper}>
              {entries.length > 0
                ? t('channels:detected', { count: entries.length })
                : t('channels:addHintMany')}
            </Text>
            {progress ? (
              <Text style={styles.progress}>
                {t('channels:importProgress', {
                  done: progress.done,
                  total: progress.total,
                })}
              </Text>
            ) : null}
          </View>

          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={handleAdd}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel={
              entries.length > 1
                ? t('channels:addMany', { count: entries.length })
                : t('channels:add')
            }
            accessibilityState={{ disabled: !canSubmit, busy }}
            style={({ pressed }) => [
              styles.submit,
              !canSubmit && styles.submitDisabled,
              pressed && canSubmit && styles.submitPressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.onAccent} size="small" />
            ) : (
              <Text style={[styles.submitText, !canSubmit && styles.submitTextDisabled]}>
                {entries.length > 1
                  ? t('channels:addMany', { count: entries.length })
                  : t('channels:add')}
              </Text>
            )}
          </Pressable>

          {report ? (
            <ChannelImportReportView
              report={report}
              avatars={avatars}
              maxListed={8}
            />
          ) : null}
        </View>

        <View style={styles.sectionRow}>
          <SectionLabel>{t('channels:followedSection')}</SectionLabel>
          <View style={styles.sectionRule} />
        </View>

        {channels.map((channel) => (
          <View key={channel.id} style={styles.row}>
            <ChannelAvatar
              uri={avatars[channel.id]}
              name={channel.title || channel.id}
              size={40}
            />

            <View style={styles.rowTexts}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {channel.title || t('channels:untitled')}
              </Text>
              <Text style={styles.rowId} numberOfLines={1}>
                {channel.id}
              </Text>
            </View>

            <Pressable
              onPress={() => setPendingRemove(channel)}
              accessibilityRole="button"
              accessibilityLabel={t('channels:removeAccessibility', {
                title: channel.title || channel.id,
              })}
              hitSlop={4}
              style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
            >
              <TrashIcon color={colors.danger} size={16} />
            </Pressable>
          </View>
        ))}

        {channels.length === 0 ? (
          <EmptyState
            title={t('channels:emptyTitle')}
            message={t('channels:emptyMessage')}
          />
        ) : null}
      </ScreenShell>

      <ConfirmSheet
        visible={Boolean(pendingRemove)}
        title={t('channels:removeConfirmTitle')}
        message={t('channels:removeConfirmMessage', {
          title: pendingRemove?.title || pendingRemove?.id || '',
        })}
        confirmLabel={t('channels:remove')}
        destructive
        onConfirm={handleRemove}
        onCancel={() => setPendingRemove(null)}
      />
    </>
  );
}

const baseStyles = StyleSheet.create({
  addCard: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: fontSize.label,
    fontWeight: '600',
  },
  input: {
    minHeight: 84,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    color: colors.text,
    fontSize: fontSize.body,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  helper: {
    flex: 1,
    color: colors.textFaint,
    fontSize: fontSize.meta,
    lineHeight: 17,
  },
  progress: {
    color: colors.accentText,
    fontSize: fontSize.meta,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.meta,
    fontWeight: '500',
    lineHeight: 17,
  },
  submit: {
    height: 50,
    marginTop: spacing.xs,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  submitPressed: {
    opacity: 0.85,
  },
  submitDisabled: {
    backgroundColor: colors.surfaceAlt,
  },
  submitText: {
    color: colors.onAccent,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  submitTextDisabled: {
    color: colors.textFaint,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 9,
  },
  rowTexts: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  rowId: {
    color: colors.textFaint,
    fontSize: fontSize.caption,
    letterSpacing: 0.2,
  },
  remove: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSoft,
  },
  removePressed: {
    opacity: 0.65,
  },
});
