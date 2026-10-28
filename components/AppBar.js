import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing } from '../constants/theme';
import { FocusMark } from './FocusMark';
import { Chevron, SearchIcon } from './Icons';

/**
 * Barre du haut façon YouTube : marque à gauche, recherche et profil à droite.
 * En mode recherche, le champ remplace la marque.
 */
export default function AppBar({
  searching = false,
  query = '',
  onChangeQuery,
  onToggleSearch,
  onOpenLibrary,
  syncLabel = '',
}) {
  if (searching) {
    return (
      <View style={styles.bar}>
        <Pressable
          onPress={onToggleSearch}
          accessibilityRole="button"
          accessibilityLabel="Fermer la recherche"
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Chevron direction="left" color={colors.text} size={9} thickness={2} />
        </Pressable>

        <View style={styles.field}>
          <SearchIcon color={colors.textFaint} size={15} thickness={2} />
          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            placeholder="Rechercher une vidéo ou une chaîne"
            placeholderTextColor={colors.textFaint}
            selectionColor={colors.accent}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            style={[styles.input, Platform.OS === 'web' && styles.inputWeb]}
            accessibilityLabel="Rechercher dans le flux"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.bar}>
      <View style={styles.brand}>
        <FocusMark size={20} />
        <Text style={styles.wordmark}>focus</Text>
        {syncLabel ? (
          <View style={styles.syncTag} accessibilityLiveRegion="polite">
            <View style={styles.syncDot} />
            <Text style={styles.syncText} numberOfLines={1}>
              {syncLabel}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onToggleSearch}
          accessibilityRole="button"
          accessibilityLabel="Rechercher"
          hitSlop={8}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <SearchIcon color={colors.text} size={19} thickness={2} />
        </Pressable>

        <Pressable
          onPress={onOpenLibrary}
          accessibilityRole="button"
          accessibilityLabel="Ma bibliothèque de chaînes"
          hitSlop={6}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>F</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    height: 56,
    gap: spacing.md,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  wordmark: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.9,
  },
  syncTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: spacing.xs,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  syncDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accent,
  },
  syncText: {
    color: colors.textMuted,
    fontSize: 10.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.onAccent,
    fontSize: 13,
    fontWeight: '800',
  },
  backButton: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 14.5,
    paddingVertical: 0,
  },
  inputWeb: {
    outlineStyle: 'none',
  },
});
