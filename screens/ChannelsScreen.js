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

import ConfirmSheet from '../components/ConfirmSheet';
import EmptyState from '../components/EmptyState';
import { TrashIcon } from '../components/Icons';
import ScreenHeader from '../components/ScreenHeader';
import { colors, radius, spacing } from '../constants/theme';
import { resolveChannelInput } from '../services/channelResolver';

export default function ChannelsScreen({ channels, onAddChannel, onRemoveChannel }) {
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
        setError('Cette chaîne est déjà dans ta bibliothèque.');
      } else {
        await onAddChannel(resolved);
        setDraft('');
        Keyboard.dismiss();
      }
    } catch (issue) {
      setError(issue?.message ?? 'Ajout impossible pour le moment.');
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
          title="Chaînes"
          subtitle={`${channels.length} chaîne${channels.length > 1 ? 's' : ''} suivie${
            channels.length > 1 ? 's' : ''
          }`}
        />

        <View style={styles.addCard}>
          <Text style={styles.fieldLabel}>Ajouter une chaîne</Text>
          <TextInput
            value={draft}
            onChangeText={(value) => {
              setDraft(value);
              if (error) setError(null);
            }}
            onSubmitEditing={handleAdd}
            placeholder="UC…, @handle ou lien YouTube"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            editable={!busy}
            accessibilityLabel="Identifiant, handle ou URL de la chaîne à ajouter"
            style={styles.input}
          />
          <Text style={styles.helper}>
            Identifiant de chaîne, @handle, URL de chaîne ou de vidéo.
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
            accessibilityLabel="Ajouter la chaîne"
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
                Ajouter la chaîne
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Suivies</Text>
          <View style={styles.sectionRule} />
        </View>

        {channels.map((channel) => (
          <View key={channel.id} style={styles.row}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(channel.title || channel.id).trim().charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.rowTexts}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {channel.title || 'Chaîne sans titre'}
              </Text>
              <Text style={styles.rowId} numberOfLines={1}>
                {channel.id}
              </Text>
            </View>

            <Pressable
              onPress={() => setPendingRemove(channel)}
              accessibilityRole="button"
              accessibilityLabel={`Retirer ${channel.title || channel.id}`}
              hitSlop={4}
              style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
            >
              <TrashIcon color={colors.danger} size={16} />
            </Pressable>
          </View>
        ))}

        {channels.length === 0 ? (
          <EmptyState
            title="Aucune chaîne"
            message="Colle un lien YouTube ci-dessus pour composer ton accueil."
          />
        ) : null}
      </ScrollView>

      <ConfirmSheet
        visible={Boolean(pendingRemove)}
        title="Retirer cette chaîne ?"
        message={`« ${pendingRemove?.title || pendingRemove?.id || ''} » quittera ta bibliothèque, ton accueil et tes catégories.`}
        confirmLabel="Retirer la chaîne"
        destructive
        onConfirm={handleRemove}
        onCancel={() => setPendingRemove(null)}
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  avatarText: {
    color: colors.accentText,
    fontSize: 15,
    fontWeight: '800',
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
