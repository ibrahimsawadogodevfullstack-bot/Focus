import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ConfirmSheet from '../components/ConfirmSheet';
import { Chevron, PlusIcon, TrashIcon } from '../components/Icons';
import ScreenHeader from '../components/ScreenHeader';
import { colors, radius, spacing } from '../constants/theme';
import { GOAL_MAX, GOAL_MIN } from '../services/settings';
import { formatEffort, insightFor, summarize } from '../services/stats';
import { useTheme, useThemeStyles } from '../services/ThemeProvider';

export default function StatsScreen({
  tracking,
  categories,
  videos,
  weeklyGoal = 8,
  onChangeGoal,
  onResetData,
  onOpenCategory,
  onOpenCategories,
}) {
  const { colors } = useTheme();
  const styles = useThemeStyles(baseStyles);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const summary = useMemo(
    () => summarize({ tracking, categories, videos, goal: weeklyGoal }),
    [tracking, categories, videos, weeklyGoal],
  );

  const insight = useMemo(() => insightFor(summary), [summary]);
  const goalRatio = Math.min(1, summary.completedThisWeek / summary.goal);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Ma semaine" subtitle={summary.weekLabel} />

        <View style={styles.cards}>
          <StatCard value={`${summary.activeDays}/7`} label="jours actifs" />
          <StatCard value={formatEffort(summary.weekSeconds)} label="temps effectif" />
          <StatCard value={`${summary.completedThisWeek}`} label="vidéos finies" />
        </View>

        <View style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <Text style={styles.goalLabel}>Mon objectif</Text>
            <Text style={styles.goalValue}>
              {summary.completedThisWeek} / {summary.goal} vidéos
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${goalRatio * 100}%` }]} />
          </View>

          <View style={styles.goalStepper}>
            <Pressable
              onPress={() => onChangeGoal?.(Math.max(GOAL_MIN, weeklyGoal - 1))}
              disabled={weeklyGoal <= GOAL_MIN}
              accessibilityRole="button"
              accessibilityLabel="Réduire l’objectif hebdomadaire"
              accessibilityState={{ disabled: weeklyGoal <= GOAL_MIN }}
              style={({ pressed }) => [
                styles.stepButton,
                weeklyGoal <= GOAL_MIN && styles.stepButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.stepSign}>−</Text>
            </Pressable>

            <Text style={styles.stepHint}>vidéos par semaine</Text>

            <Pressable
              onPress={() => onChangeGoal?.(Math.min(GOAL_MAX, weeklyGoal + 1))}
              disabled={weeklyGoal >= GOAL_MAX}
              accessibilityRole="button"
              accessibilityLabel="Augmenter l’objectif hebdomadaire"
              accessibilityState={{ disabled: weeklyGoal >= GOAL_MAX }}
              style={({ pressed }) => [
                styles.stepButton,
                weeklyGoal >= GOAL_MAX && styles.stepButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <PlusIcon color={colors.text} size={13} thickness={2} />
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Par catégorie</Text>
          <View style={styles.sectionRule} />
        </View>

        {categories.length === 0 ? (
          <Pressable
            onPress={onOpenCategories}
            accessibilityRole="button"
            style={({ pressed }) => [styles.empty, pressed && styles.pressed]}
          >
            <Text style={styles.emptyTitle}>Aucune catégorie</Text>
            <Text style={styles.emptyText}>
              Regroupe tes chaînes en catégories pour suivre ton temps et ta progression.
            </Text>
          </Pressable>
        ) : (
          summary.categories.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => onOpenCategory(category.id)}
              accessibilityRole="button"
              accessibilityLabel={`Statistiques de ${category.name}`}
              style={({ pressed }) => [styles.category, pressed && styles.pressed]}
            >
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryName} numberOfLines={1}>
                  {category.name}
                </Text>
                <StatusPill status={category.status} />
              </View>

              <Text style={styles.categoryMeta}>
                {formatEffort(category.seconds)}
                {category.total > 0
                  ? ` · ${category.completed} / ${category.total} vidéos`
                  : category.lastAt
                    ? ` · dernière activité il y a ${category.daysSince} j`
                    : ' · aucune vidéo dans le flux'}
              </Text>

              <View style={styles.track}>
                <View
                  style={[
                    styles.trackFill,
                    category.status.key === 'review' && styles.trackWarn,
                    category.status.key === 'neglected' && styles.trackDanger,
                    { width: `${Math.round(category.ratio * 100)}%` },
                  ]}
                />
              </View>
            </Pressable>
          ))
        )}

        <View style={styles.insight}>
          <Text style={styles.insightText}>{insight}</Text>
        </View>

        <Pressable
          onPress={() => setConfirmingReset(true)}
          accessibilityRole="button"
          accessibilityLabel="Effacer mes données de suivi"
          style={({ pressed }) => [styles.reset, pressed && styles.pressed]}
        >
          <TrashIcon color={colors.danger} size={15} />
          <Text style={styles.resetText}>Effacer mes données</Text>
        </Pressable>
        <Text style={styles.resetHint}>
          Temps, vidéos terminées et auto-évaluations sont supprimés de cet appareil.
        </Text>
      </ScrollView>

      <ConfirmSheet
        visible={confirmingReset}
        title="Effacer mes données ?"
        message="Ton temps de visionnage, tes vidéos terminées et tes auto-évaluations seront définitivement supprimés. Les chaînes et catégories sont conservées."
        confirmLabel="Effacer"
        destructive
        onConfirm={() => {
          setConfirmingReset(false);
          onResetData?.();
        }}
        onCancel={() => setConfirmingReset(false)}
      />
    </SafeAreaView>
  );
}

function StatCard({ value, label }) {
  const styles = useThemeStyles(baseStyles);
  return (
    <View style={styles.card}>
      <Text style={styles.cardValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

function StatusPill({ status }) {
  const { colors } = useTheme();
  const styles = useThemeStyles(baseStyles);
  const palette = {
    comfort: { bg: colors.successSoft, text: colors.success },
    review: { bg: colors.warnSoft, text: colors.warn },
    neglected: { bg: colors.dangerSoft, text: colors.danger },
    progress: { bg: colors.accentSoft, text: colors.accentText },
    empty: { bg: colors.surfaceAlt, text: colors.textFaint },
  }[status.key];

  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <Text style={[styles.pillText, { color: palette.text }]} numberOfLines={1}>
        {status.label}
      </Text>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  cards: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  card: {
    flex: 1,
    gap: 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  cardValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  cardLabel: {
    color: colors.textFaint,
    fontSize: 10.5,
    fontWeight: '600',
    lineHeight: 13,
  },
  goalCard: {
    marginTop: spacing.sm,
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  goalValue: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: '700',
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  trackFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  trackWarn: {
    backgroundColor: colors.warn,
  },
  trackDanger: {
    backgroundColor: colors.danger,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
  },
  category: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  pressed: {
    opacity: 0.75,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  categoryName: {
    flex: 1,
    color: colors.text,
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  categoryMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  pill: {
    height: 24,
    paddingHorizontal: 9,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 130,
  },
  pillText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  empty: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 14.5,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 18,
  },
  insight: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentLine,
  },
  insightText: {
    color: colors.text,
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: '500',
  },
  goalStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  stepButtonDisabled: {
    opacity: 0.4,
  },
  stepSign: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  stepHint: {
    flex: 1,
    textAlign: 'center',
    color: colors.textFaint,
    fontSize: 11.5,
    fontWeight: '500',
  },
  reset: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxl,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  resetText: {
    color: colors.danger,
    fontSize: 13.5,
    fontWeight: '700',
  },
  resetHint: {
    marginTop: spacing.sm,
    color: colors.textFaint,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
});
