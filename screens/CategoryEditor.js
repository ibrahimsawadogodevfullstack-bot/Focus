import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import ChannelAvatar from '../src/shared/ui/ChannelAvatar';
import ConfirmSheet from '../src/shared/ui/ConfirmSheet';
import { CheckIcon, CloseIcon } from '../src/shared/ui/Icons';
import { colors, fontSize, icon, radius, spacing } from '../src/shared/theme/tokens';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';

export default function CategoryEditor({
  category,
  channels,
  categories = [],
  avatars = {},
  onSave,
  onDelete,
  onClose,
}) {
  const { colors } = useTheme();
  const styles = useThemeStyles(baseStyles);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [name, setName] = useState(category?.name ?? '');
  const [selected, setSelected] = useState(() => new Set(category?.channelIds ?? []));
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const trimmedName = name.trim();
  // Les catégories de téléchargement peuvent exister sans chaîne : on n'exige
  // plus de sélection de chaînes pour enregistrer.
  const canSave = trimmedName.length > 0 && !saving;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return channels;
    return channels.filter((channel) =>
      `${channel.title ?? ''} ${channel.id}`.toLowerCase().includes(term),
    );
  }, [channels, query]);

  const toggle = (channelId) => {
    setError(null);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!canSave) return;

    // Deux catégories du même nom rendraient les puces de l'accueil
    // indiscernables : on refuse avant d'écrire.
    const duplicate = categories.some(
      (entry) =>
        entry.id !== category?.id &&
        entry.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );
    if (duplicate) {
      setError(t('categories:duplicateError'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: category?.id,
        name: trimmedName,
        channelIds: [...selected],
      });
    } catch {
      setError(t('categories:saveError'));
      setSaving(false);
    }
  };

  const confirmDelete = () => setConfirmingDelete(true);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common:close')}
          style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
        >
          <CloseIcon color={colors.text} size={icon.xs} />
        </Pressable>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {category
            ? t('categories:editCategory', { name: category.name })
            : t('categories:createTitle')}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.editorContent}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.nameSection}>
          <Text style={styles.label}>{t('categories:editorName')}</Text>
          <TextInput
            value={name}
            onChangeText={(value) => {
              setName(value);
              if (error) setError(null);
            }}
            placeholder={t('categories:editorPlaceholder')}
            placeholderTextColor={colors.textFaint}
            maxLength={40}
            autoFocus={!category}
            returnKeyType="done"
            accessibilityLabel={t('categories:editorName')}
            style={styles.nameInput}
          />
          <Text style={styles.counter}>{name.length} / 40</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sectionRow}>
            <Text style={styles.label}>{t('channels:title')}</Text>
            <Text style={styles.selection}>
              {t('categories:selectedChannels', { count: selected.size })}
            </Text>
          </View>

          {channels.length > 5 ? (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('categories:searchChannel')}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t('categories:searchChannel')}
              style={styles.searchInput}
            />
          ) : null}

          <View style={styles.list}>
            {filtered.map((channel) => {
              const active = selected.has(channel.id);
              return (
                <Pressable
                  key={channel.id}
                  onPress={() => toggle(channel.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={channel.title || channel.id}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <View style={[styles.check, active && styles.checkActive]}>
                    {active ? <CheckIcon color={colors.onAccent} size={11} /> : null}
                  </View>

                  <ChannelAvatar
                    uri={avatars[channel.id]}
                    name={channel.title || channel.id}
                    size={30}
                  />

                  <Text style={[styles.rowTitle, active && styles.rowTitleActive]} numberOfLines={1}>
                    {channel.title || channel.id}
                  </Text>
                </Pressable>
              );
            })}

            {filtered.length === 0 && channels.length > 0 ? (
              <Text style={styles.noResult}>{t('categories:noChannelMatches')}</Text>
            ) : null}

            {channels.length === 0 ? (
              <Text style={styles.noResult}>
                {t('categories:addChannelsFirst')}
              </Text>
            ) : null}
          </View>

          {category ? (
            <Pressable
              onPress={confirmDelete}
              accessibilityRole="button"
              style={({ pressed }) => [styles.delete, pressed && styles.deletePressed]}
            >
              <Text style={styles.deleteText}>{t('categories:deleteCategoryButton')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!error && !saving && !trimmedName ? (
            <Text style={styles.saveHint}>{t('categories:saveHint')}</Text>
          ) : null}
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave, busy: saving }}
            style={({ pressed }) => [
              styles.save,
              !canSave && styles.saveDisabled,
              pressed && canSave && styles.savePressed,
            ]}
          >
            <Text style={[styles.saveText, !canSave && styles.saveTextDisabled]}>
              {saving ? t('common:saving') : t('common:save')}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <ConfirmSheet
        visible={confirmingDelete}
        title={t('categories:deleteConfirmTitle')}
        message={t('categories:deleteConfirmMessage', { name: category?.name ?? '' })}
        confirmLabel={t('categories:deleteCategoryButton')}
        destructive
        onConfirm={() => {
          setConfirmingDelete(false);
          onDelete(category.id);
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  editorContent: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  nameSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    height: 56,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  closePressed: {
    backgroundColor: colors.surfaceAlt,
  },
  headerTitle: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.headline,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'left',
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  label: {
    color: colors.text,
    fontSize: fontSize.label,
    fontWeight: '600',
  },
  nameInput: {
    height: 50,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    color: colors.text,
    fontSize: fontSize.body,
  },
  counter: {
    color: colors.textFaint,
    fontSize: fontSize.caption,
    marginTop: 6,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  selection: {
    color: colors.accentText,
    fontSize: fontSize.meta,
    fontWeight: '600',
  },
  searchInput: {
    height: 44,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    color: colors.text,
    fontSize: fontSize.body,
  },
  list: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
  },
  checkActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  avatarText: {
    color: colors.accentText,
    fontSize: fontSize.meta,
    fontWeight: '800',
  },
  rowTitle: {
    flex: 1,
    color: colors.textMuted,
    fontSize: fontSize.body,
    fontWeight: '500',
  },
  rowTitleActive: {
    color: colors.text,
    fontWeight: '600',
  },
  noResult: {
    color: colors.textFaint,
    fontSize: fontSize.label,
    paddingVertical: spacing.lg,
  },
  delete: {
    marginTop: spacing.xxl,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  deletePressed: {
    opacity: 0.7,
  },
  deleteText: {
    color: colors.danger,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.meta,
    textAlign: 'center',
  },
  saveHint: {
    color: colors.textFaint,
    fontSize: fontSize.meta,
    textAlign: 'center',
  },
  save: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  savePressed: {
    opacity: 0.85,
  },
  saveDisabled: {
    backgroundColor: colors.surfaceAlt,
  },
  saveText: {
    color: colors.onAccent,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  saveTextDisabled: {
    color: colors.textFaint,
  },
});
