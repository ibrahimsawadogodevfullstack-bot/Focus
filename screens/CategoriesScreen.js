import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EmptyState from '../components/EmptyState';
import { Chevron, PlusIcon } from '../components/Icons';
import ScreenHeader from '../components/ScreenHeader';
import { colors, radius, spacing } from '../constants/theme';
import { useTheme, useThemeStyles } from '../services/ThemeProvider';

export default function CategoriesScreen({ categories, channels, onCreate, onEdit }) {
  const { colors } = useTheme();
  const styles = useThemeStyles(baseStyles);
  const channelById = new Map(channels.map((channel) => [channel.id, channel]));

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Catégories"
          subtitle={
            categories.length === 0
              ? 'Aucun regroupement'
              : `${categories.length} regroupement${categories.length > 1 ? 's' : ''} de chaînes`
          }
        />

        <Pressable
          onPress={onCreate}
          accessibilityRole="button"
          accessibilityLabel="Créer une catégorie"
          style={({ pressed }) => [styles.createCard, pressed && styles.pressedCard]}
        >
          <View style={styles.createIcon}>
            <PlusIcon color={colors.onAccent} size={16} />
          </View>
          <View style={styles.createTexts}>
            <Text style={styles.createTitle}>Nouvelle catégorie</Text>
            <Text style={styles.createSubtitle}>Ex. Maths, Anglais, Tech — combine tes chaînes.</Text>
          </View>
        </Pressable>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Tes regroupements</Text>
          <View style={styles.sectionRule} />
        </View>

        {categories.map((category) => {
          const members = category.channelIds
            .map((id) => channelById.get(id))
            .filter(Boolean);

          return (
            <Pressable
              key={category.id}
              onPress={() => onEdit(category)}
              accessibilityRole="button"
              accessibilityLabel={`Modifier ${category.name}`}
              style={({ pressed }) => [styles.card, pressed && styles.pressedCard]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {category.name}
                </Text>
                <Chevron direction="right" color={colors.textFaint} size={9} />
              </View>

              <Text style={styles.cardMeta}>
                {members.length} chaîne{members.length > 1 ? 's' : ''}
              </Text>

              {members.length > 0 ? (
                <View style={styles.members}>
                  <View style={styles.stack}>
                    {members.slice(0, 4).map((channel, index) => (
                      <View
                        key={channel.id}
                        style={[styles.stackItem, index > 0 && styles.stackOverlap]}
                      >
                        <Text style={styles.stackText}>
                          {(channel.title || channel.id).trim().charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <Text style={styles.memberNames} numberOfLines={1}>
                    {members
                      .slice(0, 3)
                      .map((channel) => channel.title || channel.id)
                      .join(' · ')}
                    {members.length > 3 ? ` +${members.length - 3}` : ''}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}

        {categories.length === 0 ? (
          <EmptyState
            title="Aucune catégorie"
            message="Une catégorie rassemble plusieurs chaînes : par exemple « Maths » avec trois profs différents."
            actionLabel="Créer la première"
            onAction={onCreate}
          />
        ) : null}
      </ScrollView>
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
  createCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentLine,
  },
  pressedCard: {
    opacity: 0.72,
  },
  createIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  createTexts: {
    flex: 1,
    gap: 3,
  },
  createTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  createSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
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
  card: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    padding: spacing.lg,
    gap: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16.5,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  cardMeta: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '500',
  },
  members: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  stack: {
    flexDirection: 'row',
  },
  stackItem: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  stackOverlap: {
    marginLeft: -6,
  },
  stackText: {
    color: colors.accentText,
    fontSize: 11,
    fontWeight: '800',
  },
  memberNames: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
  },
});
