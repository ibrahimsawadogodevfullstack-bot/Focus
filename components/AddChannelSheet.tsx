import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import ChannelImportReportView from '../src/shared/ui/ChannelImportReport';
import type { ChannelImportReport } from '../src/shared/ui/ChannelImportReport';
import { colors, fontSize, icon, radius, spacing } from '../src/shared/theme/tokens';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';
import { CloseIcon } from '../src/shared/ui/Icons';
import { splitChannelInput } from '../services/channelImport';

type AddChannelSheetProps = {
  onClose: () => void;
  onSubmit: (
    source: string,
    options?: { onProgress?: (done: number, total: number) => void },
  ) => Promise<ChannelImportReport>;
};

/**
 * Ajout de chaînes : un panneau flottant centré, au-dessus du clavier.
 * Le champ accepte une liste d'identifiants ou de liens séparés par des
 * virgules ; le résultat reste affiché dans le panneau après l'import.
 */
export default function AddChannelSheet({ onClose, onSubmit }: AddChannelSheetProps) {
  const insets = useSafeAreaInsets();
  const styles = useThemeStyles(baseStyles);
  const { colors: theme } = useTheme();
  const { t } = useTranslation();
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [report, setReport] = useState<ChannelImportReport | null>(null);
  const [error, setError] = useState('');

  const entries = splitChannelInput(source);
  const canSubmit = entries.length > 0 && !busy;

  const requestClose = () => {
    if (!busy) onClose();
  };

  const run = async (raw: string) => {
    const list = splitChannelInput(raw);
    if (list.length === 0 || busy) return;

    setBusy(true);
    setError('');
    setReport(null);
    setProgress({ done: 0, total: list.length });
    try {
      const result = await onSubmit(list.join(','), {
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setReport(result);
      if (result.added.length > 0) setSource('');
    } catch {
      setError(t('channels:addFailed'));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const submit = () => run(source);

  const retryFailed = () => {
    const inputs = report?.failed.map((failure) => failure.input) ?? [];
    if (inputs.length > 0) run(inputs.join(','));
  };

  const paste = async () => {
    try {
      const value = await Clipboard.getStringAsync();
      if (value) {
        setSource(value.trim());
        setReport(null);
        if (error) setError('');
      }
    } catch {
      // Presse-papiers indisponible : la saisie manuelle reste possible.
    }
  };

  const changeSource = (value: string) => {
    setSource(value);
    if (report) setReport(null);
    if (error) setError('');
  };

  const submitLabel = entries.length > 1
    ? t('channels:addMany', { count: entries.length })
    : t('channels:add');

  return (
    <Modal
      transparent
      animationType="fade"
      onRequestClose={requestClose}
      statusBarTranslucent
    >
      <View
        style={[
          styles.backdrop,
          {
            paddingTop: Math.max(insets.top, spacing.xl),
            paddingBottom: Math.max(insets.bottom, spacing.xl),
          },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={requestClose}
          accessible={false}
          importantForAccessibility="no"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardWrap}
        >
          <View style={styles.sheet} accessibilityViewIsModal>
            <View style={styles.header}>
              <Text style={styles.title}>
                {entries.length > 1
                  ? t('channels:addTitleMany')
                  : t('channels:addTitle')}
              </Text>
              <Pressable
                onPress={requestClose}
                disabled={busy}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('common:close')}
                style={({ pressed }) => [
                  styles.close,
                  busy && styles.closeDisabled,
                  pressed && styles.closePressed,
                ]}
              >
                <CloseIcon color={theme.text} size={icon.xs} />
              </Pressable>
            </View>

            <Text style={styles.hint}>{t('channels:addHintMany')}</Text>

            <View style={styles.inputWrap}>
              <TextInput
                value={source}
                onChangeText={changeSource}
                placeholder={t('channels:inputPlaceholderMany')}
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!busy}
                accessibilityLabel={t('channels:inputAccessibilityMany')}
                style={styles.input}
              />
              <Pressable
                onPress={paste}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={t('channels:paste')}
                style={({ pressed }) => [styles.paste, pressed && styles.pastePressed]}
              >
                <Text style={styles.pasteText}>{t('channels:paste')}</Text>
              </Pressable>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.counter}>
                {entries.length > 0
                  ? t('channels:detected', { count: entries.length })
                  : t('channels:pasteHint')}
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
              onPress={submit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel={submitLabel}
              accessibilityState={{ disabled: !canSubmit, busy }}
              style={({ pressed }) => [
                styles.submit,
                !canSubmit && styles.submitDisabled,
                pressed && canSubmit && styles.submitPressed,
              ]}
            >
              {busy ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Text style={styles.submitText}>{submitLabel}</Text>
              )}
            </Pressable>

            {report ? (
              <ScrollView
                style={styles.reportScroll}
                contentContainerStyle={styles.reportContent}
                showsVerticalScrollIndicator={false}
              >
                <ChannelImportReportView report={report} />
              </ScrollView>
            ) : null}

            {report && report.failed.length > 0 && !busy ? (
              <Pressable
                onPress={retryFailed}
                accessibilityRole="button"
                accessibilityLabel={t('channels:retryFailed')}
                style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
              >
                <Text style={styles.retryText}>
                  {t('channels:retryFailedCount', { count: report.failed.length })}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={requestClose}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={report ? t('common:close') : t('common:cancel')}
              style={({ pressed }) => [styles.cancel, pressed && styles.cancelPressed]}
            >
              <Text style={styles.cancelText}>
                {report ? t('common:close') : t('common:cancel')}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(2, 4, 10, 0.72)',
  },
  keyboardWrap: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  sheet: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.headline,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  closeDisabled: {
    opacity: 0.4,
  },
  closePressed: {
    opacity: 0.6,
  },
  hint: {
    color: colors.textMuted,
    fontSize: fontSize.label,
    lineHeight: 18,
  },
  inputWrap: {
    minHeight: 96,
    paddingLeft: spacing.md,
    paddingRight: 5,
    paddingTop: spacing.sm,
    paddingBottom: 5,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  input: {
    minHeight: 62,
    marginRight: 64,
    padding: 0,
    color: colors.text,
    fontSize: fontSize.body,
    lineHeight: 20,
  },
  paste: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  pastePressed: {
    opacity: 0.65,
  },
  pasteText: {
    color: colors.accentText,
    fontSize: fontSize.meta,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  counter: {
    flex: 1,
    color: colors.textFaint,
    fontSize: fontSize.meta,
  },
  progress: {
    color: colors.accentText,
    fontSize: fontSize.meta,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.label,
  },
  submit: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitPressed: {
    opacity: 0.82,
  },
  submitText: {
    color: colors.onAccent,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  reportScroll: {
    maxHeight: 190,
  },
  reportContent: {
    paddingBottom: 2,
  },
  retry: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  retryPressed: {
    opacity: 0.7,
  },
  retryText: {
    color: colors.accentText,
    fontSize: fontSize.label,
    fontWeight: '700',
  },
  cancel: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPressed: {
    opacity: 0.6,
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
});
