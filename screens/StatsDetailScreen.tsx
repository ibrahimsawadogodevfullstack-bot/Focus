import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PageHeader from '../src/shared/ui/PageHeader';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';
import { colors, fontSize, radius, spacing } from '../src/shared/theme/tokens';
import { useSettings } from '../services/SettingsProvider';
import { useViewingStats } from '../src/shared/hooks/useViewingStats';
import { buildPeriodSummary, formatWatchTime } from '../services/viewingSummary';
import type { CategoryLike } from '../src/domain/categories';
import type { ViewingPeriod } from '../src/domain/viewing';
import {
  DailyBars,
  EmptyNote,
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

const WEEKDAY_REFERENCE = new Date(2024, 0, 1); // lundi

function weekdayName(index: number, locale: string) {
  const date = new Date(WEEKDAY_REFERENCE);
  date.setDate(WEEKDAY_REFERENCE.getDate() + index);
  return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date);
}

export default function StatsDetailScreen({
  categories = [],
  initialSection = null,
  onBack,
}: {
  categories?: CategoryLike[];
  initialSection?: string | null;
  onBack: () => void;
}) {
  const { t, i18n } = useTranslation(['viewing', 'common']);
  const settings = useSettings();
  const themedStyles = useThemeStyles(styles);
  const { colors: theme } = useTheme();
  const stats = useViewingStats();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'fr';
  const [period, setPeriod] = useState<ViewingPeriod>(settings.statsDefaultPeriod);
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});
  const scrolledRef = useRef(false);

  const summary = useMemo(() => {
    if (!stats) return null;
    return buildPeriodSummary({
      stats,
      categories,
      period,
      goalMinutes: settings.statsGoalMinutes,
    });
  }, [stats, categories, period, settings.statsGoalMinutes]);

  const scrollToInitial = () => {
    if (!initialSection || scrolledRef.current) return;
    const offset = offsets.current[initialSection];
    if (offset === undefined) return;
    scrolledRef.current = true;
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, offset - 8), animated: false });
    }, 40);
  };

  const remember = (key: string, y: number) => {
    offsets.current[key] = y;
    scrollToInitial();
  };

  const durations = summary
    ? [
        { key: 'night', label: t('momentNight'), seconds: summary.moments.night },
        { key: 'morning', label: t('momentMorning'), seconds: summary.moments.morning },
        { key: 'afternoon', label: t('momentAfternoon'), seconds: summary.moments.afternoon },
        { key: 'evening', label: t('momentEvening'), seconds: summary.moments.evening },
      ]
    : [];
  const momentTotal = summary?.moments.total ?? 0;
  const topMoment = summary?.moments.top ?? null;
  const topMomentShare = topMoment && summary
    ? summary.moments[topMoment] / Math.max(1, momentTotal)
    : 0;

  const formatSegments = summary
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
      <PageHeader
        title={t('detailTitle')}
        backLabel={t('backToYou')}
        onBack={onBack}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={themedStyles.content}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToInitial}
      >
        {!summary ? (
          <View style={themedStyles.loadingStack}>
            <LoadingBlock label={t('common:loading')} height={44} />
            <LoadingBlock label={t('common:loading')} height={220} />
            <LoadingBlock label={t('common:loading')} height={180} />
          </View>
        ) : (
          <>
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

            {!summary.hasActivity ? <EmptyNote text={t('noPeriodData')} /> : null}

            <StatsCard title={t('overviewTitle')}>
              <StatGrid>
                <StatTile
                  label={t('watchTime')}
                  value={formatWatchTime(summary.totals.seconds, locale)}
                  comparison={summary.comparisons.seconds}
                />
                <StatTile
                  label={t('videosWatched')}
                  value={String(summary.totals.videos)}
                  comparison={summary.comparisons.videos}
                />
                <StatTile
                  label={t('activeDays')}
                  value={t('activeDaysValue', {
                    active: summary.totals.activeDays,
                    total: summary.totals.days,
                  })}
                  comparison={summary.comparisons.activeDays}
                />
                <StatTile
                  label={t('sessions')}
                  value={String(summary.totals.sessions)}
                  comparison={summary.comparisons.sessions}
                />
              </StatGrid>
              {settings.statsShowSummary && summary.sentences.length > 0 ? (
                <View style={themedStyles.sentences}>
                  {summary.sentences.map((sentence, index) => (
                    <Text key={`${sentence.key}-${index}`} style={themedStyles.sentence}>
                      {summarySentenceText(t, sentence, locale)}
                    </Text>
                  ))}
                </View>
              ) : null}
            </StatsCard>

            <View onLayout={(event) => remember('daily', event.nativeEvent.layout.y)}>
              <StatsCard title={t('dailyTitle')}>
                <DailyBars
                  days={summary.days}
                  locale={locale}
                  dense={summary.days.length > 10}
                  height={120}
                  accessibilityLabel={t('dailyA11y', {
                    total: formatWatchTime(summary.totals.seconds, locale),
                    active: summary.totals.activeDays,
                    days: summary.totals.days,
                  })}
                />
              </StatsCard>
            </View>

            <View onLayout={(event) => remember('categories', event.nativeEvent.layout.y)}>
              <StatsCard title={t('categoriesTitle')}>
                {summary.categories.length === 0 ? (
                  <EmptyNote text={t('noCategories')} />
                ) : (
                  summary.categories.map((category, index) => (
                    <ShareRow
                      key={category.id}
                      name={category.uncategorized ? t('uncategorized') : category.name}
                      badge={category.deleted ? t('deleted') : undefined}
                      seconds={category.seconds}
                      share={category.share}
                      locale={locale}
                      color={[theme.accent, theme.success, theme.warn][index % 3]}
                    />
                  ))
                )}
              </StatsCard>
            </View>

            <View onLayout={(event) => remember('channels', event.nativeEvent.layout.y)}>
              <StatsCard title={t('channelsTitle')}>
                {summary.channels.length === 0 ? (
                  <EmptyNote text={t('noChannels')} />
                ) : (
                  summary.channels.slice(0, 5).map((channel, index) => (
                    <ShareRow
                      key={channel.id}
                      name={channel.name || t('unknownChannel')}
                      seconds={channel.seconds}
                      share={channel.share}
                      locale={locale}
                      color={[theme.accent, theme.success, theme.warn][index % 3]}
                    />
                  ))
                )}
              </StatsCard>
            </View>

            <View onLayout={(event) => remember('formats', event.nativeEvent.layout.y)}>
              <StatsCard title={t('formatsTitle')}>
                {summary.totals.seconds > 0 ? (
                  <ShareBar
                    segments={formatSegments}
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
            </View>

            <View onLayout={(event) => remember('moments', event.nativeEvent.layout.y)}>
              <StatsCard title={t('momentsTitle')}>
                {momentTotal <= 0 ? (
                  <EmptyNote text={t('noMoments')} />
                ) : (
                  durations.map((moment) => (
                    <ShareRow
                      key={moment.key}
                      name={moment.label}
                      seconds={moment.seconds}
                      share={momentTotal > 0 ? moment.seconds / momentTotal : 0}
                      locale={locale}
                      color={theme.accentLine}
                    />
                  ))
                )}
              </StatsCard>
            </View>

            <View onLayout={(event) => remember('habits', event.nativeEvent.layout.y)}>
              <StatsCard title={t('habitsTitle')}>
                {summary.weekday ? (
                  <Text style={themedStyles.bodyText}>
                    {t('mostActiveDay', {
                      weekday: weekdayName(summary.weekday.index, locale),
                      duration: formatWatchTime(summary.weekday.seconds, locale),
                    })}
                  </Text>
                ) : (
                  <EmptyNote text={t('habitsEmpty')} />
                )}
                {topMoment ? (
                  <Text style={themedStyles.bodyText}>
                    {t('mostActiveMoment', {
                      moment: t(`moment${topMoment[0].toUpperCase()}${topMoment.slice(1)}`),
                      share: Math.round(topMomentShare * 100),
                    })}
                  </Text>
                ) : null}
              </StatsCard>
            </View>

            <View onLayout={(event) => remember('sessions', event.nativeEvent.layout.y)}>
              <StatsCard title={t('sessionsTitle')}>
                {summary.sessions.count === 0 ? (
                  <EmptyNote text={t('noSessions')} />
                ) : (
                  <StatGrid>
                    <StatTile label={t('sessionCount')} value={String(summary.sessions.count)} />
                    <StatTile
                      label={t('sessionAverage')}
                      value={formatWatchTime(summary.sessions.averageSeconds, locale)}
                    />
                    <StatTile
                      label={t('sessionLongest')}
                      value={formatWatchTime(summary.sessions.longestSeconds, locale)}
                    />
                  </StatGrid>
                )}
              </StatsCard>
            </View>

            <StatsCard title={t('shortsStreakTitle')}>
              {summary.shorts.longest > 0 ? (
                <Text style={themedStyles.bodyText}>
                  {t('shortsStreakValue', { count: summary.shorts.longest })}
                </Text>
              ) : (
                <EmptyNote text={t('shortsStreakEmpty')} />
              )}
            </StatsCard>

            {summary.estimated ? (
              <Text style={themedStyles.estimated}>{t('estimatedNote')}</Text>
            ) : null}

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
  loadingStack: {
    gap: spacing.md,
  },
  comparisonBasis: {
    marginTop: -spacing.xs,
    color: colors.textFaint,
    fontSize: fontSize.caption,
    fontWeight: '500',
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
    textAlign: 'center',
  },
});
