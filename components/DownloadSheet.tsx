import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import ChoiceSheet from './ChoiceSheet';
import { colors, radius, spacing } from '../src/shared/theme/tokens';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';

export type DownloadSheetValue = {
  url: string;
  format: 'video' | 'audio';
  quality: '480p' | '720p' | '1080p';
};

export default function DownloadSheet({
  visible,
  onClose,
  onSubmit,
  busy,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (value: DownloadSheetValue) => void;
  busy?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemeStyles(baseStyles);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['downloads', 'common']);
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<'video' | 'audio'>('video');
  const [quality, setQuality] = useState<'480p' | '720p' | '1080p'>('720p');
  const [qualityOpen, setQualityOpen] = useState(false);

  const handlePaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) setUrl(text.trim());
    } catch {}
  };

  const handleSubmit = () => {
    if (!url.trim()) return;
    onSubmit({ url: url.trim(), format, quality });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <Text style={styles.title}>{t('downloads:sheetTitle')}</Text>
          <View style={styles.urlRow}>
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder={t('downloads:urlPlaceholder')}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={styles.input}
            />
            <Pressable onPress={handlePaste} style={styles.paste}>
              <Text style={styles.pasteText}>{t('downloads:paste')}</Text>
            </Pressable>
          </View>

          <View style={styles.formatRow}>
            <Pressable
              onPress={() => setFormat('video')}
              style={[styles.formatBtn, format === 'video' && styles.formatBtnActive]}
            >
              <Text style={[styles.formatText, format === 'video' && styles.formatTextActive]}>
                {t('downloads:video')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setFormat('audio')}
              style={[styles.formatBtn, format === 'audio' && styles.formatBtnActive]}
            >
              <Text style={[styles.formatText, format === 'audio' && styles.formatTextActive]}>
                {t('downloads:audio')}
              </Text>
            </Pressable>
          </View>

          {format === 'video' ? (
            <Pressable onPress={() => setQualityOpen(true)} style={styles.qualityBtn}>
              <Text style={styles.qualityLabel}>{t('downloads:quality')}</Text>
              <Text style={styles.qualityValue}>{quality}</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={busy || !url.trim()}
            style={({ pressed }) => [
              styles.submit,
              (busy || !url.trim()) && styles.submitDisabled,
              pressed && styles.submitPressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={styles.submitText}>{t('downloads:download')}</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <ChoiceSheet
        visible={qualityOpen}
        title={t('downloads:quality')}
        choices={[
          { value: '480p', label: '480p' },
          { value: '720p', label: '720p' },
          { value: '1080p', label: '1080p' },
        ]}
        selectedValue={quality}
        onChoose={(v: any) => {
          setQuality(v as any);
          setQualityOpen(false);
        }}
        onClose={() => setQualityOpen(false)}
      />
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  urlRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
  },
  paste: {
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasteText: { color: colors.accentText, fontWeight: '600' },
  formatRow: { flexDirection: 'row', gap: spacing.sm },
  formatBtn: {
    flex: 1,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatBtnActive: { backgroundColor: colors.accent },
  formatText: { color: colors.text, fontWeight: '600' },
  formatTextActive: { color: colors.onAccent },
  qualityBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  qualityLabel: { color: colors.textMuted, fontWeight: '600' },
  qualityValue: { color: colors.text, fontWeight: '700' },
  submit: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: { opacity: 0.5 },
  submitPressed: { opacity: 0.85 },
  submitText: { color: colors.onAccent, fontWeight: '700', fontSize: 16 },
});
