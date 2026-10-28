import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import BrandMark from '../components/BrandMark';
import ChannelAvatar from '../components/ChannelAvatar';
import ConfirmSheet from '../components/ConfirmSheet';
import { CheckIcon, CloseIcon } from '../components/Icons';
import { colors, radius, spacing } from '../constants/theme';

export default function CategoryEditor({ category, channels, avatars = {}, onSave, onDelete, onClose }) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(category?.name ?? '');
  const [selected, setSelected] = useState(() => new Set(category?.channelIds ?? []));
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && selected.size > 0 && !saving;

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

    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: category?.id,
        name: trimmedName,
        channelIds: [...selected],
      });
    } catch (issue) {
      setError(issue?.message ?? 'Enregistrement impossible.');
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
          accessibilityLabel="Fermer"
          style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
        >
          <CloseIcon color={colors.text} size={13} />
        </Pressable>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {category ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
        </Text>

        <BrandMark size={15} textSize={15} style={styles.headerBrand} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>Nom de la catégorie</Text>
        <TextInput
          value={name}
          onChangeText={(value) => {
            setName(value);
            if (error) setError(null);
          }}
          placeholder="Ex. Maths, Anglais, Tech"
          placeholderTextColor={colors.textFaint}
          maxLength={40}
          autoFocus={!category}
          returnKeyType="done"
          accessibilityLabel="Nom de la catégorie"
          style={styles.nameInput}
        />
        <Text style={styles.counter}>{name.length} / 40</Text>

        <View style={styles.sectionRow}>
          <Text style={styles.label}>Chaînes</Text>
          <Text style={styles.selection}>
            {selected.size} sélectionnée{selected.size > 1 ? 's' : ''}
          </Text>
        </View>

        {channels.length > 5 ? (
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher une chaîne"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Rechercher une chaîne"
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
            <Text style={styles.noResult}>Aucune chaîne ne correspond.</Text>
          ) : null}

          {channels.length === 0 ? (
            <Text style={styles.noResult}>
              Ajoute d’abord des chaînes depuis l’onglet Chaînes.
            </Text>
          ) : null}
        </View>

        {category ? (
          <Pressable
            onPress={confirmDelete}
            accessibilityRole="button"
            style={({ pressed }) => [styles.delete, pressed && styles.deletePressed]}
          >
            <Text style={styles.deleteText}>Supprimer la catégorie</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
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
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Text>
        </Pressable>
      </View>

      <ConfirmSheet
        visible={confirmingDelete}
        title="Supprimer la catégorie ?"
        message={`« ${category?.name ?? ''} » sera supprimée. Les chaînes restent dans ta bibliothèque.`}
        confirmLabel="Supprimer la catégorie"
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
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
    borderRadius: 22,
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
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  headerBrand: {
    marginLeft: 'auto',
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  label: {
    color: colors.text,
    fontSize: 13.5,
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
    fontSize: 16,
  },
  counter: {
    color: colors.textFaint,
    fontSize: 11,
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
    fontSize: 12,
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
    fontSize: 14,
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
    borderRadius: 11,
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
    fontSize: 12,
    fontWeight: '800',
  },
  rowTitle: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 14.5,
    fontWeight: '500',
  },
  rowTitleActive: {
    color: colors.text,
    fontWeight: '600',
  },
  noResult: {
    color: colors.textFaint,
    fontSize: 13,
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
    fontSize: 14,
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
    fontSize: 12.5,
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
    fontSize: 15.5,
    fontWeight: '700',
  },
  saveTextDisabled: {
    color: colors.textFaint,
  },
});
