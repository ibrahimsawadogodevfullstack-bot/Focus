import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScreenHeader from '../src/shared/ui/ScreenHeader';
import { PersonIcon, SettingsIcon } from '../src/shared/ui/Icons';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';
import { colors, radius, spacing } from '../src/shared/theme/tokens';
import { useSettings } from '../services/SettingsProvider';
import { useViewingStats } from '../src/shared/hooks/useViewingStats';
import { buildPeriodSummary, formatWatchTime } from '../services/viewingSummary';
import type { CategoryLike } from '../src/domain/categories';
import type { ViewingPeriod } from '../src/domain/viewing';
import {
  DailyBars,
  EmptyNote,
  GoalBar,
  LinkButton,
  LoadingBlock,
  PeriodSelector,
  PrivacyNote,
  ShareBar,
  ShareRow,
  StatGrid,
  StatTile,
  StatsCard,
} from '../src/shared/ui/stats/StatsPrimitives';
import { summarySentenceText } from '../src/shared/ui/stats/sentences';
import { listDownloads } from '../src/db';

const WEEKDAY_REFERENCE = new Date(2024, 0, 1); // lundi

function weekdayName(index: number, locale: string) {
  const date = new Date(WEEKDAY_REFERENCE);
  date.setDate(WEEKDAY_REFERENCE.getDate() + index);
  return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date);
}

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
  const [downloadCount, setDownloadCount] = useState<number | null>(null);

  useEffect(() => {
    setPeriod(settings.statsDefaultPeriod);
  }, [settings.statsDefaultPeriod]);

  useEffect(() => {
    let active = true;
    listDownloads()
      .then((rows) => {
        if (active) setDownloadCount(rows.filter((row) => row.status === 'completed').length);
      })
      .catch(() => {
        if (active) setDownloadCount(0);
      });
    return () => {
      active = false;
    };
  }, []);

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

  const moodSegments = summary
    ? [
        {
          key: 'short',
          label: t('shorts'),
          seconds: summary.formats.short,
          share: summary.formats.shortShare,
          color: theme.accent,
        },
        {
          key: 'long',
          label: t('longVideos'),
          seconds: summary.formats.long,
          share: summary.formats.longShare,
          color: theme.success,
        },
      ]
    : [];

  return (
    <SafeAreaView edges={['top']} style={themedStyles.screen}>
      <ScrollView contentContainerStyle={themedStyles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
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
        />

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
            <StatsCard
              title={t('consumptionTitle')}
              actionLabel={t('openStats')}
              onPress={() => onOpenStats(null)}
            >
              <PeriodSelector value={period} onChange={setPeriod} />

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
                />
                <StatTile
                  label={t('videosWatched')}
                  value={String(summary.totals.videos)}
                  comparison={tileComparisons?.videos ?? null}
                />
                <StatTile
                  label={t('activeDays')}
                  value={activeDaysValue}
                  comparison={tileComparisons?.activeDays ?? null}
                />
                <StatTile
                  label={t('sessions')}
                  value={String(summary.totals.sessions)}
                  comparison={tileComparisons?.sessions ?? null}
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

              <LinkButton label={t('settingsButton')} onPress={onOpenStatsSettings} />
            </StatsCard>

            <StatsCard title={t('goalTitle')}>
              {settings.statsGoalMinutes > 0 ? (
                <GoalBar
                  current={summary.todaySeconds}
                  target={settings.statsGoalMinutes}
                  locale={locale}
                  currentLabel={t('watchTime')}
                  goalLabel={t('goalLabel')}
                  reachedLabel={t('goalReached')}
                  overLabel={t('goalOver')}
                />
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

            <StatsCard
              title={t('dailyTitle')}
              actionLabel={t('openDaily')}
              onPress={() => onOpenStats('daily')}
            >
              <DailyBars
                days={summary.days}
                locale={locale}
                dense={summary.days.length > 10}
                accessibilityLabel={t('dailyA11y', {
                  total: formatWatchTime(summary.totals.seconds, locale),
                  active: summary.totals.activeDays,
                  days: summary.totals.days,
                })}
              />
            </StatsCard>

            <StatsCard
              title={t('categoriesTitle')}
              actionLabel={t('openCategories')}
              onPress={() => onOpenStats('categories')}
            >
              {summary.categories.length === 0 ? (
                <EmptyNote text={t('noCategories')} />
              ) : (
                summary.categories.slice(0, 3).map((category, index) => (
                  <ShareRow
                    key={category.id}
                    name={category.uncategorized ? t('uncategorized') : category.name}
                    badge={category.deleted ? t('deleted') : undefined}
                    seconds={category.seconds}
                    share={category.share}
                    locale={locale}
                    color={[theme.accent, theme.success, theme.warn][index] ?? theme.accentLine}
                  />
                ))
              )}
            </StatsCard>

            <StatsCard
              title={t('formatsTitle')}
              actionLabel={t('openFormats')}
              onPress={() => onOpenStats('formats')}
            >
              {summary.totals.seconds > 0 ? (
                <ShareBar
                  segments={moodSegments}
                  locale={locale}
                  accessibilityLabel={t('formatsA11y', {
                    shorts: Math.round(summary.formats.shortShare * 100),
                    long: Math.round(summary.formats.longShare * 100),
                  })}
                />
              ) : (
                <EmptyNote text={t('noPeriodData')} />
              )}
            </StatsCard>

            <StatsCard
              title={t('channelsTitle')}
              actionLabel={t('openChannels')}
              onPress={() => onOpenStats('channels')}
            >
              {summary.channels.length === 0 ? (
                <EmptyNote text={t('noChannels')} />
              ) : (
                summary.channels.slice(0, 3).map((channel, index) => (
                  <ShareRow
                    key={channel.id}
                    name={channel.name || t('unknownChannel')}
                    seconds={channel.seconds}
                    share={channel.share}
                    locale={locale}
                    color={[theme.accent, theme.success, theme.warn][index] ?? theme.accentLine}
                  />
                ))
              )}
            </StatsCard>

            <StatsCard title={t('habitsTitle')}>
              {summary.moments.top || summary.weekday ? (
                <Text style={themedStyles.bodyText}>
                  {summary.moments.top && summary.weekday
                    ? t('habitsLine', {
                        moment: t(`moment${summary.moments.top[0].toUpperCase()}${summary.moments.top.slice(1)}`),
                        weekday: weekdayName(summary.weekday.index, locale),
                      })
                    : summary.moments.top
                      ? t('habitsMomentOnly', {
                          moment: t(`moment${summary.moments.top[0].toUpperCase()}${summary.moments.top.slice(1)}`),
                        })
                      : t('habitsDayOnly', {
                          weekday: weekdayName(summary.weekday!.index, locale),
                        })}
                </Text>
              ) : (
                <EmptyNote text={t('habitsEmpty')} />
              )}
            </StatsCard>

            <StatsCard title={t('engagementTitle')}>
              <StatGrid>
                <StatTile label={t('completed')} value={String(summary.totals.completed)} />
                <StatTile label={t('abandoned')} value={String(summary.totals.abandoned)} />
                <StatTile label={t('replays')} value={String(summary.totals.replays)} />
                <StatTile
                  label={t('averageSpeed')}
                  value={
                    summary.totals.averageSpeed
                      ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(summary.totals.averageSpeed)}×`
                      : '—'
                  }
                />
              </StatGrid>
            </StatsCard>

            <StatsCard title={t('onlineOfflineTitle')}>
              <StatGrid>
                <StatTile
                  label={t('online')}
                  value={formatWatchTime(summary.online.online, locale)}
                />
                <StatTile
                  label={t('offline')}
                  value={formatWatchTime(summary.online.offline, locale)}
                />
              </StatGrid>
              <Text style={themedStyles.bodyText}>
                {t('downloadedVideosValue', { count: downloadCount ?? 0 })}
              </Text>
            </StatsCard>

            <PrivacyNote text={t('privacyNote')} />
          </>
        )}
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
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  gear: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  profileCopy: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  profileNote: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 17,
  },
  loadingStack: {
    gap: spacing.md,
  },
  comparisonBasis: {
    marginTop: -spacing.xs,
    color: colors.textFaint,
    fontSize: 11.5,
    fontWeight: '500',
  },
  bodyText: {
    color: colors.textMuted,
    fontSize: 13.5,
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
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  estimated: {
    color: colors.textFaint,
    fontSize: 11.5,
    lineHeight: 16,
  },
});
