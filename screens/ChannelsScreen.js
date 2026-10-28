import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EmptyState from '../components/EmptyState';
import { CloseIcon } from '../components/Icons';
import ScreenHeader from '../components/ScreenHeader';
import { colors, radius, spacing } from '../constants/theme';
import { resolveChannelInput } from '../services/channelResolver';

export default function ChannelsScreen({ channels, onAddChannel, onRemoveChannel }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

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

  const confirmRemove = (channel) => {
    Alert.alert(
      'Retirer cette chaîne ?',
      `« ${channel.title || channel.id} » quittera le flux et les catégories.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: () => onRemoveChannel(channel.id),
        },
      ],
    );
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
              onPress={() => confirmRemove(channel)}
              accessibilityRole="button"
              accessibilityLabel={`Retirer ${channel.title || channel.id}`}
              style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
            >
              <CloseIcon color={colors.textMuted} size={13} />
            </Pressable>
          </View>
        ))}

        {channels.length === 0 ? (
          <EmptyState
            title="Aucune chaîne"
            message="Colle un lien YouTube ci-dessus pour composer ton flux."
          />
        ) : null}
      </ScrollView>
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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePressed: {
    backgroundColor: colors.surface,
  },
});
