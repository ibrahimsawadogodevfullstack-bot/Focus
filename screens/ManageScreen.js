import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { resolveChannelInput } from '../services/channelResolver';
import { colors, radius, spacing } from '../constants/theme';

export default function ManageScreen({
  channels,
  categories,
  onBack,
  onAddChannel,
  onRemoveChannel,
  onSaveCategory,
  onDeleteCategory,
}) {
  const [tab, setTab] = useState('channels');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);

  const handleAdd = async () => {
    const value = draft.trim();
    if (!value || busy) return;

    setBusy(true);
    setError(null);
    try {
      const resolved = await resolveChannelInput(value);
      if (channels.some((channel) => channel.id === resolved.id)) {
        setError('Cette chaîne est déjà dans ta bibliothèque.');
      } else {
        await onAddChannel(resolved);
        setDraft('');
      }
    } catch (issue) {
      setError(issue?.message ?? 'Ajout impossible.');
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

  const confirmDeleteCategory = (category) => {
    Alert.alert('Supprimer la catégorie ?', `« ${category.name} » sera supprimée.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => onDeleteCategory(category.id),
      },
    ]);
  };

  if (editing) {
    return (
      <CategoryEditor
        initial={editing}
        channels={channels}
        categories={categories}
        onCancel={() => setEditing(null)}
        onSave={async (category) => {
          await onSaveCategory(category);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Retour au flux"
          hitSlop={12}
          style={styles.back}
        >
          <Text style={styles.backIcon}>‹</Text>
          <Text style={styles.backLabel}>Flux</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Bibliothèque</Text>
        <View style={styles.back} />
      </View>

      <View style={styles.segments}>
        <Segment
          label={`Chaînes ${channels.length}`}
          active={tab === 'channels'}
          onPress={() => setTab('channels')}
        />
        <Segment
          label={`Catégories ${categories.length}`}
          active={tab === 'categories'}
          onPress={() => setTab('categories')}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {tab === 'channels' ? (
          <>
            <View style={styles.addCard}>
              <Text style={styles.cardLabel}>AJOUTER UNE CHAÎNE</Text>
              <View style={styles.addRow}>
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
                  style={styles.input}
                />
                <Pressable
                  onPress={handleAdd}
                  disabled={busy || draft.trim().length === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Ajouter la chaîne"
                  style={({ pressed }) => [
                    styles.addButton,
                    pressed && !busy && draft.trim().length > 0 && styles.addButtonPressed,
                    (busy || draft.trim().length === 0) && styles.addButtonDisabled,
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator color={colors.onAccent} size="small" />
                  ) : (
                    <Text
                      style={[
                        styles.addButtonText,
                        (busy || draft.trim().length === 0) && styles.addButtonTextDisabled,
                      ]}
                    >
                      Ajouter
                    </Text>
                  )}
                </Pressable>
              </View>
              <Text style={styles.hint}>
                Identifiant de chaîne, @handle, URL de chaîne ou de vidéo.
              </Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>

            <Text style={styles.sectionTitle}>Chaînes suivies</Text>

            {channels.map((channel) => (
              <View key={channel.id} style={styles.channelRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(channel.title || channel.id).trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.channelMeta}>
                  <Text style={styles.channelTitle} numberOfLines={1}>
                    {channel.title || 'Chaîne sans titre'}
                  </Text>
                  <Text style={styles.channelId} numberOfLines={1}>
                    {channel.id}
                  </Text>
                </View>
                <Pressable
                  onPress={() => confirmRemove(channel)}
                  accessibilityRole="button"
                  accessibilityLabel={`Retirer ${channel.title || channel.id}`}
                  hitSlop={10}
                  style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
                >
                  <Text style={styles.removeIcon}>×</Text>
                </Pressable>
              </View>
            ))}

            {channels.length === 0 ? (
              <Text style={styles.emptyText}>
                Aucune chaîne. Colle un lien YouTube ci-dessus pour commencer.
              </Text>
            ) : null}
          </>
        ) : (
          <>
            <Pressable
              onPress={() => setEditing({ id: null, name: '', channelIds: [] })}
              accessibilityRole="button"
              style={({ pressed }) => [styles.newCategory, pressed && styles.newCategoryPressed]}
            >
              <Text style={styles.newCategoryPlus}>＋</Text>
              <View style={styles.newCategoryText}>
                <Text style={styles.newCategoryTitle}>Nouvelle catégorie</Text>
                <Text style={styles.newCategoryHint}>
                  Combiner plusieurs chaînes en un seul flux
                </Text>
              </View>
            </Pressable>

            {categories.map((category) => {
              const names = category.channelIds
                .map((id) => channels.find((channel) => channel.id === id)?.title || id)
                .slice(0, 3)
                .join(' · ');

              return (
                <View key={category.id} style={styles.categoryCard}>
                  <View style={styles.categoryHeader}>
                    <View style={styles.categoryTitleBlock}>
                      <Text style={styles.categoryTitle}>{category.name}</Text>
                      <Text style={styles.categoryCount}>
                        {category.channelIds.length} chaîne
                        {category.channelIds.length > 1 ? 's' : ''}
                      </Text>
                    </View>
                    <View style={styles.categoryActions}>
                      <Pressable
                        onPress={() =>
                          setEditing({
                            id: category.id,
                            name: category.name,
                            channelIds: [...category.channelIds],
                          })
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Modifier ${category.name}`}
                        hitSlop={8}
                        style={styles.actionButton}
                      >
                        <Text style={styles.actionText}>Modifier</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => confirmDeleteCategory(category)}
                        accessibilityRole="button"
                        accessibilityLabel={`Supprimer ${category.name}`}
                        hitSlop={8}
                        style={styles.actionButton}
                      >
                        <Text style={styles.actionTextDanger}>Supprimer</Text>
                      </Pressable>
                    </View>
                  </View>
                  <Text style={styles.categoryChannels} numberOfLines={2}>
                    {names}
                    {category.channelIds.length > 3 ? ' …' : ''}
                  </Text>
                </View>
              );
            })}

            {categories.length === 0 ? (
              <Text style={styles.emptyText}>
                Aucune catégorie. Crée-en une pour regrouper les chaînes qui vont
                ensemble (maths, anglais, tech…).
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Segment({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.segment, active && styles.segmentActive]}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function CategoryEditor({ initial, channels, categories, onCancel, onSave }) {
  const [name, setName] = useState(initial.name);
  const [selected, setSelected] = useState(initial.channelIds);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const toggle = (id) => {
    if (error) setError(null);
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const save = async () => {
    const cleaned = name.trim();
    if (!cleaned) {
      setError('Donne un nom à la catégorie.');
      return;
    }
    if (selected.length === 0) {
      setError('Choisis au moins une chaîne.');
      return;
    }
    const duplicate = categories.some(
      (category) =>
        category.id !== initial.id &&
        category.name.toLowerCase() === cleaned.toLowerCase(),
    );
    if (duplicate) {
      setError('Une catégorie porte déjà ce nom.');
      return;
    }

    setSaving(true);
    try {
      await onSave({ id: initial.id, name: cleaned, channelIds: selected });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} hitSlop={12} style={styles.back}>
          <Text style={styles.backLabel}>Annuler</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {initial.id ? 'Modifier' : 'Nouvelle catégorie'}
        </Text>
        <Pressable onPress={save} hitSlop={12} disabled={saving} style={styles.back}>
          {saving ? (
            <ActivityIndicator color={colors.accent} size="small" />
          ) : (
            <Text style={styles.saveText}>Enregistrer</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.addCard}>
          <Text style={styles.cardLabel}>NOM DE LA CATÉGORIE</Text>
          <TextInput
            value={name}
            onChangeText={(value) => {
              setName(value);
              if (error) setError(null);
            }}
            placeholder="Maths, Anglais, Tech…"
            placeholderTextColor={colors.textFaint}
            maxLength={40}
            returnKeyType="done"
            style={styles.input}
          />
        </View>

        <Text style={styles.sectionTitle}>
          Chaînes · {selected.length} sélectionnée{selected.length > 1 ? 's' : ''}
        </Text>

        {channels.map((channel) => {
          const active = selected.includes(channel.id);
          return (
            <Pressable
              key={channel.id}
              onPress={() => toggle(channel.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              style={({ pressed }) => [styles.checkRow, pressed && styles.checkRowPressed]}
            >
              <View style={[styles.check, active && styles.checkActive]}>
                {active ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <View style={styles.channelMeta}>
                <Text style={styles.channelTitle} numberOfLines={1}>
                  {channel.title || channel.id}
                </Text>
              </View>
            </Pressable>
          );
        })}

        {channels.length === 0 ? (
          <Text style={styles.emptyText}>
            Ajoute d’abord des chaînes dans l’onglet Chaînes.
          </Text>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 76,
    paddingVertical: 6,
  },
  backIcon: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 28,
    marginTop: -2,
  },
  backLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  saveText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  segments: {
    flexDirection: 'row',
    gap: 4,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  segmentActive: {
    backgroundColor: colors.surfaceAlt,
  },
  segmentText: {
    color: colors.textFaint,
    fontSize: 12.5,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.text,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  addCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  addRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  addButton: {
    minWidth: 86,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  addButtonPressed: {
    opacity: 0.85,
  },
  addButtonDisabled: {
    backgroundColor: colors.surfaceAlt,
  },
  addButtonText: {
    color: colors.onAccent,
    fontSize: 13,
    fontWeight: '700',
  },
  addButtonTextDisabled: {
    color: colors.textFaint,
  },
  hint: {
    color: colors.textFaint,
    fontSize: 11.5,
  },
  error: {
    color: colors.accent,
    fontSize: 12.5,
    fontWeight: '500',
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  channelMeta: {
    flex: 1,
    gap: 2,
  },
  channelTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  channelId: {
    color: colors.textFaint,
    fontSize: 10.5,
    letterSpacing: 0.2,
  },
  remove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  removePressed: {
    backgroundColor: colors.accentSoft,
  },
  removeIcon: {
    color: colors.textMuted,
    fontSize: 18,
    lineHeight: 20,
    marginTop: -1,
  },
  newCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  newCategoryPressed: {
    backgroundColor: colors.surface,
  },
  newCategoryPlus: {
    color: colors.accent,
    fontSize: 20,
    fontWeight: '700',
  },
  newCategoryText: {
    gap: 2,
  },
  newCategoryTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  newCategoryHint: {
    color: colors.textFaint,
    fontSize: 11.5,
  },
  categoryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  categoryTitleBlock: {
    flex: 1,
    gap: 2,
  },
  categoryTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  categoryCount: {
    color: colors.textFaint,
    fontSize: 11.5,
  },
  categoryActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    paddingVertical: 2,
  },
  actionText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  actionTextDanger: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  categoryChannels: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  emptyText: {
    color: colors.textFaint,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: spacing.md,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  checkRowPressed: {
    opacity: 0.7,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkMark: {
    color: colors.onAccent,
    fontSize: 12,
    fontWeight: '800',
    marginTop: -1,
  },
});
