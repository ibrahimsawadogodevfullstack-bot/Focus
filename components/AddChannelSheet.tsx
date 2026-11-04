import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../src/shared/theme/tokens';
import { useThemeStyles } from '../src/shared/theme/ThemeProvider';

type AddChannelSheetProps = {
  onClose: () => void;
  onSubmit: (source: string) => Promise<void>;
};

export default function AddChannelSheet({ onClose, onSubmit }: AddChannelSheetProps) {
  const insets = useSafeAreaInsets();
  const styles = useThemeStyles(baseStyles);
  const { t } = useTranslation();
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const value = source.trim();
    if (!value || busy) return;

    setBusy(true);
    setError('');
    try {
      await onSubmit(value);
      onClose();
    } catch {
      setError(t('channels:addFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.dock, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
        >
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <Text style={styles.title}>{t('channels:addTitle')}</Text>
            <Text style={styles.hint}>{t('channels:addHint')}</Text>
            <TextInput
              value={source}
              onChangeText={(value) => {
                setSource(value);
                if (error) setError('');
              }}
              onSubmitEditing={submit}
              placeholder={t('channels:inputPlaceholder')}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              editable={!busy}
              accessibilityLabel={t('channels:inputAccessibility')}
              style={styles.input}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              onPress={submit}
              disabled={!source.trim() || busy}
              accessibilityRole="button"
              accessibilityLabel={t('channels:add')}
              accessibilityState={{ disabled: !source.trim() || busy, busy }}
              style={({ pressed }) => [
                styles.submit,
                (!source.trim() || busy) && styles.submitDisabled,
                pressed && styles.submitPressed,
              ]}
            >
              {busy ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Text style={styles.submitText}>{t('channels:add')}</Text>
              )}
            </Pressable>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common:cancel')}
              style={({ pressed }) => [styles.cancel, pressed && styles.cancelPressed]}
            >
              <Text style={styles.cancelText}>{t('common:cancel')}</Text>
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
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2, 4, 10, 0.72)',
  },
  dock: {
    justifyContent: 'flex-end',
  },
  sheet: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lineStrong,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    color: colors.text,
    fontSize: 15,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
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
    fontSize: 15,
    fontWeight: '700',
  },
  cancel: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPressed: {
    opacity: 0.6,
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});
