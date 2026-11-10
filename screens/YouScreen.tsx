import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import ScreenShell from '../src/shared/ui/ScreenShell';
import { PersonIcon, SettingsIcon } from '../src/shared/ui/Icons';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';
import { colors, fontSize, radius, spacing } from '../src/shared/theme/tokens';
import { GoalRing } from '../src/shared/ui/stats/GoalRing';
import { useSettings } from '../services/SettingsProvider';
import { useViewingStats } from '../src/shared/hooks/useViewingStats';
import { buildPeriodSummary, formatWatchTime } from '../services/viewingSummary';
import type { CategoryLike } from '../src/domain/categories';
import type { ViewingPeriod } from '../src/domain/viewing';
import {
  EmptyNote,
  LinkButton,
  LoadingBlock,
  PeriodSelector,
  PrivacyNote,
  StatGrid,
  StatTile,
  StatsCard,
} from '../src/shared/ui/stats/StatsPrimitives';
import { summarySentenceText } from '../src/shared/ui/stats/sentences';

export default function YouScreen({
  categories = [],
  onOpenSettings,
  onOpenStats,
  onOpenStatsSettings,
}: {
  categories?: CategoryLike[];
  onOpenSettings: () => void;
  onOpenStats: (section?: string | null) => void;
  onOpenStatsSettings: () => void;
}) {
  const { t, i18n } = useTranslation(['viewing', 'you', 'common']);
  const settings = useSettings();
  const themedStyles = useThemeStyles(styles);
  const { colors: theme } = useTheme();
  const stats = useViewingStats();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'fr';

  const [period, setPeriod] = useState<ViewingPeriod>(settings.statsDefaultPeriod);

  useEffect(() => {
    setPeriod(settings.statsDefaultPeriod);
  }, [settings.statsDefaultPeriod]);

  const summary = useMemo(() => {
    if (!stats) return null;
    return buildPeriodSummary({
      stats,
      categories,
      period,
      goalMinutes: settings.statsGoalMinutes,
    });
  }, [stats, categories, period, settings.statsGoalMinutes]);

  const statsVisible = settings.statsVisible;
  const sentences = summary && settings.statsShowSummary ? summary.sentences : [];

  const tileComparisons = summary?.comparisons;
  const activeDaysValue = summary
    ? t('activeDaysValue', { active: summary.totals.activeDays, total: summary.totals.days })
    : '—';

  /** Séries quotidiennes des sparklines. Masquées sur « Aujourd'hui » : un
   *  seul point ne dessine pas de courbe lisible. */
  const series = useMemo(() => {
    if (!summary || summary.days.length < 2) return null;
    let accumulatedActiveDays = 0;
    const activeDays = summary.days.map((day) => {
      if (day.seconds > 0) accumulatedActiveDays += 1;
      return accumulatedActiveDays;
    });
    return {
      seconds: summary.days.map((day) => day.seconds),
      videos: summary.days.map((day) => day.videos),
      sessions: summary.days.map((day) => day.sessions),
      activeDays,
    };
  }, [summary]);

  return (
    <ScreenShell
      title={t('you:title')}
      right={
        <Pressable
          onPress={onOpenSettings}
          accessibilityRole="button"
          accessibilityLabel={t('viewing:openSettings')}
          style={({ pressed }) => [themedStyles.gear, pressed && themedStyles.pressed]}
        >
          <SettingsIcon color={theme.text} size={21} />
        </Pressable>
      }
    >
        <View style={themedStyles.profileCard}>
          <View style={themedStyles.avatar}>
            <PersonIcon color={theme.onAccent} size={30} />
          </View>
          <View style={themedStyles.profileCopy}>
            <Text style={themedStyles.profileName}>{t('profileName')}</Text>
            <Text style={themedStyles.profileNote}>{t('profileNote')}</Text>
          </View>
        </View>

        {!statsVisible ? null : !summary ? (
          <View style={themedStyles.loadingStack}>
            <LoadingBlock label={t('common:loading')} height={44} />
            <LoadingBlock label={t('common:loading')} height={200} />
            <LoadingBlock label={t('common:loading')} height={120} />
          </View>
        ) : !summary.hasAnyHistory ? (
          <StatsCard title={t('welcomeTitle')}>
            <Text style={themedStyles.bodyText}>{t('welcomeBody')}</Text>
            <LinkButton
              label={t('settingsButton')}
              onPress={onOpenStatsSettings}
              tone="quiet"
            />
          </StatsCard>
        ) : (
          <>
            {/* La période gouverne toute la page : elle vit donc hors des cartes. */}
            <PeriodSelector value={period} onChange={setPeriod} />

            <StatsCard
              title={t('consumptionTitle')}
              actionLabel={t('openStats')}
              onPress={() => onOpenStats(null)}
            >
              {summary.comparisons.seconds !== null ||
              summary.comparisons.videos !== null ||
              summary.comparisons.activeDays !== null ||
              summary.comparisons.sessions !== null ? (
                <Text style={themedStyles.comparisonBasis}>
                  {t(
                    period === 'today'
                      ? 'comparisonBasisToday'
                      : period === '30d'
                        ? 'comparisonBasis30'
                        : 'comparisonBasis7',
                  )}
                </Text>
              ) : null}

              <StatGrid>
                <StatTile
                  label={t('watchTime')}
                  value={formatWatchTime(summary.totals.seconds, locale)}
                  comparison={tileComparisons?.seconds ?? null}
                  series={series?.seconds}
                  color={theme.chart1}
                />
                <StatTile
                  label={t('videosWatched')}
                  value={String(summary.totals.videos)}
                  comparison={tileComparisons?.videos ?? null}
                  series={series?.videos}
                  color={theme.chart2}
                />
                <StatTile
                  label={t('sessions')}
                  value={String(summary.totals.sessions)}
                  comparison={tileComparisons?.sessions ?? null}
                  series={series?.sessions}
                  color={theme.chart3}
                />
                <StatTile
                  label={t('activeDays')}
                  value={activeDaysValue}
                  comparison={tileComparisons?.activeDays ?? null}
                  series={series?.activeDays}
                  color={theme.chart4}
                />
              </StatGrid>

              {sentences.length > 0 ? (
                <View style={themedStyles.sentences}>
                  {sentences.map((sentence, index) => (
                    <Text key={`${sentence.key}-${index}`} style={themedStyles.sentence}>
                      {summarySentenceText(t, sentence, locale)}
                    </Text>
                  ))}
                </View>
              ) : null}

              {!summary.hasActivity ? (
                <EmptyNote text={t('noPeriodData')} />
              ) : null}

              {summary.estimated ? (
                <Text style={themedStyles.estimated}>{t('estimatedNote')}</Text>
              ) : null}
            </StatsCard>

            <StatsCard title={t('goalTitle')}>
              {settings.statsGoalMinutes > 0 ? (
                <View style={themedStyles.goalWrap}>
                  <GoalRing
                    current={summary.todaySeconds}
                    target={settings.statsGoalMinutes}
                    locale={locale}
                    currentLabel={t('watchTime')}
                    goalLabel={t('goalLabel')}
                    reachedLabel={t('goalReached')}
                    overLabel={t('goalOver')}
                  />
                </View>
              ) : (
                <>
                  <EmptyNote text={t('goalNone')} />
                  <LinkButton
                    label={t('goalSet')}
                    onPress={onOpenStatsSettings}
                    tone="quiet"
                  />
                </>
              )}
            </StatsCard>

            <PrivacyNote text={t('privacyNote')} />
          </>
        )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  gear: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  profileCopy: {
    flex: 1,
    gap: 3,
  },
  profileName: {
    color: colors.text,
    fontSize: fontSize.headline,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  profileNote: {
    color: colors.textMuted,
    fontSize: fontSize.meta,
    lineHeight: 16,
  },
  loadingStack: {
    gap: spacing.md,
  },
  comparisonBasis: {
    marginTop: -spacing.xs,
    color: colors.textFaint,
    fontSize: fontSize.caption,
    fontWeight: '500',
  },
  goalWrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  bodyText: {
    color: colors.textMuted,
    fontSize: fontSize.label,
    lineHeight: 19,
  },
  sentences: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  sentence: {
    color: colors.text,
    fontSize: fontSize.label,
    lineHeight: 19,
    fontWeight: '500',
  },
  estimated: {
    color: colors.textFaint,
    fontSize: fontSize.caption,
    lineHeight: 16,
  },
});
