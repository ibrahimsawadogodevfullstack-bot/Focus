import { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import ChannelAvatar from '../src/shared/ui/ChannelAvatar';
import ConfirmSheet from '../src/shared/ui/ConfirmSheet';
import EmptyState from '../src/shared/ui/EmptyState';
import { TrashIcon } from '../src/shared/ui/Icons';
import ScreenHeader from '../src/shared/ui/ScreenHeader';
import { colors, radius, spacing } from '../src/shared/theme/tokens';
import { resolveChannelInput } from '../services/channelResolver';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';

export default function ChannelsScreen({ channels, avatars = {}, onAddChannel, onRemoveChannel }) {
  const { colors } = useTheme();
  const styles = useThemeStyles(baseStyles);
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [pendingRemove, setPendingRemove] = useState(null);

  const canSubmit = draft.trim().length > 0 && !busy;

  const handleAdd = async () => {
    if (!canSubmit) return;

    setBusy(true);
    setError(null);
    try {
      const resolved = await resolveChannelInput(draft.trim());
      if (channels.some((channel) => channel.id === resolved.id)) {
        setError(t('channels:alreadyAdded'));
      } else {
        await onAddChannel(resolved);
        setDraft('');
        Keyboard.dismiss();
      }
    } catch {
      setError(t('channels:addFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    const channel = pendingRemove;
    setPendingRemove(null);
    if (channel) await onRemoveChannel(channel.id);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title={t('channels:title')}
          subtitle={t('channels:followed', { count: channels.length })}
        />

        <View style={styles.addCard}>
          <Text style={styles.fieldLabel}>{t('channels:addTitle')}</Text>
          <TextInput
            value={draft}
            onChangeText={(value) => {
              setDraft(value);
              if (error) setError(null);
            }}
            onSubmitEditing={handleAdd}
            placeholder={t('channels:inputPlaceholder')}
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            editable={!busy}
            accessibilityLabel={t('channels:inputAccessibility')}
            style={styles.input}
          />
          <Text style={styles.helper}>
            {t('channels:addHint')}
          </Text>

          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={handleAdd}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel={t('channels:add')}
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
                {t('channels:add')}
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>{t('channels:followedSection')}</Text>
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
      </ScrollView>

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
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: spacing.xxxl,
  },
  addCard: {
    marginHorizontal: spacing.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: '600',
  },
  input: {
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    color: colors.text,
    fontSize: 15,
  },
  helper: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 17,
  },
  error: {
    color: colors.danger,
    fontSize: 12.5,
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
    fontSize: 15,
    fontWeight: '700',
  },
  submitTextDisabled: {
    color: colors.textFaint,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.sm,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
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
    paddingLeft: spacing.xl,
    paddingRight: spacing.md,
    paddingVertical: 9,
  },
  rowTexts: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 14.5,
    fontWeight: '600',
  },
  rowId: {
    color: colors.textFaint,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  remove: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSoft,
  },
  removePressed: {
    opacity: 0.65,
  },
});
