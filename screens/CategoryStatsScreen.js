import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Chevron } from '../src/shared/ui/Icons';
import ScreenHeader from '../src/shared/ui/ScreenHeader';
import { colors, radius, spacing } from '../src/shared/theme/tokens';
import {
  categoryVideos,
  daysSince,
  formatClockShort,
  formatEffort,
  summarize,
  weekDays,
} from '../services/stats';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';

function lastActivityLabel(timestamp, t) {
  const days = daysSince(timestamp);
  if (days === null) return t('stats:noActivity');
  if (days <= 0) return t('stats:today');
  if (days === 1) return t('stats:yesterday');
  return t('stats:daysAgo', { count: days });
}

export default function CategoryStatsScreen({ category, tracking, categories, videos, onBack, onOpen }) {
  const { colors } = useTheme();
  const styles = useThemeStyles(baseStyles);
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'fr';
  const summary = useMemo(
    () => summarize({ tracking, categories, videos, locale }),
    [tracking, categories, videos, locale],
  );

  const stats = summary.categories.find((item) => item.id === category.id) ?? {
    seconds: 0,
    completed: 0,
    total: 0,
    lastAt: null,
    ratio: 0,
  };

  const channelIds = useMemo(() => new Set(category.channelIds), [category.channelIds]);

  // Détail jour par jour, limité aux chaînes de la catégorie.
  const daily = useMemo(() => {
    return weekDays(Date.now(), locale).map((day) => {
      const entry = tracking.days?.[day.key];
      let seconds = 0;
      if (entry && typeof entry === 'object') {
        for (const [channelId, value] of Object.entries(entry.channels ?? {})) {
          if (channelIds.has(channelId)) seconds += value;
        }
      }
      return { ...day, seconds };
    });
  }, [tracking.days, channelIds, locale]);

  const maxSeconds = Math.max(...daily.map((day) => day.seconds), 1);
  const today = new Date().setHours(0, 0, 0, 0);

  const rows = useMemo(
    () => categoryVideos({ tracking, category, videos }),
    [tracking, category, videos],
  );

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('stats:backToStats')}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Chevron direction="left" color={colors.text} size={9} thickness={2} />
          <Text style={styles.backLabel}>{t('tabs:stats')}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title={category.name}
          subtitle={t('stats:lastActivity', { time: lastActivityLabel(stats.lastAt, t) })}
        />

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('stats:thisWeek')}</Text>
          <Text style={styles.bigValue}>{formatEffort(stats.seconds, locale)}</Text>

          <View style={styles.chart}>
            {daily.map((day) => {
              const isToday = day.stamp === today;
              const height = day.seconds > 0 ? Math.max(6, (day.seconds / maxSeconds) * 56) : 3;
              return (
                <View key={day.key} style={styles.chartCol}>
                  <View
                    style={[
                      styles.chartBar,
                      isToday && styles.chartBarToday,
                      { height },
                    ]}
                  />
                  <Text style={[styles.chartDay, isToday && styles.chartDayToday]}>
                    {day.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardLabel}>{t('stats:progress')}</Text>
            <Text style={styles.cardValue}>
              {stats.completed} / {stats.total} {t('stats:videos')}
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${Math.round(stats.ratio * 100)}%` }]} />
          </View>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>{t('stats:myVideos')}</Text>
          <View style={styles.sectionRule} />
        </View>

        {rows.length === 0 ? (
          <Text style={styles.empty}>
            {t('stats:noWatchedVideos')}
          </Text>
        ) : (
          rows.map((row) => (
            <Pressable
              key={row.videoId}
              onPress={() => onOpen(row, rows)}
              accessibilityRole="button"
              accessibilityLabel={t('stats:resumeVideo', { title: row.title })}
              style={({ pressed }) => [styles.video, pressed && styles.pressed]}
            >
              <View style={styles.videoTexts}>
                <Text style={styles.videoTitle} numberOfLines={2}>
                  {row.title}
                </Text>
                <Text style={styles.videoMeta} numberOfLines={1}>
                  {videoMeta(row, t, locale)}
                </Text>
              </View>
              <VideoBadge row={row} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function videoMeta(row, t, locale) {
  if (row.completed) {
    const parts = [t('stats:completedMeta')];
    if (row.replays > 0 && row.lastReplayAt !== null) {
      parts.push(
        t('stats:replayMeta', { time: formatClockShort(row.lastReplayAt), count: row.replays }),
      );
    } else if (row.duration > 0) {
      parts.push(formatEffort(row.duration, locale));
    }
    return parts.join(' · ');
  }

  const percent = row.duration > 0 ? Math.round((row.position / row.duration) * 100) : 0;
  const progress = row.seconds > 0
    ? t('stats:inProgressMeta', { percent: Math.min(99, Math.max(1, percent)) })
    : null;

  if (row.rating === 'fragile') {
    return progress ? `${progress} · ${t('stats:markedFragile')}` : t('stats:markedFragileToReview');
  }
  if (progress) return progress;
  if (row.replays > 0) return t('stats:replayedMeta', { count: row.replays });
  return t('stats:notStarted');
}

function VideoBadge({ row }) {
  const { colors } = useTheme();
  const styles = useThemeStyles(baseStyles);
  const { t } = useTranslation();
  const { label, bg, color } = badgeFor(row, colors);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]} numberOfLines={1}>
        {t(`stats:${label}`)}
      </Text>
    </View>
  );
}

function badgeFor(row, colors) {
  if (row.rating === 'solide') {
    return { label: 'badgeSolid', bg: colors.successSoft, color: colors.success };
  }
  if (row.rating === 'fragile') {
    return { label: 'badgeReview', bg: colors.warnSoft, color: colors.warn };
  }
  if (row.completed) {
    return { label: 'badgeComplete', bg: colors.accentSoft, color: colors.accentText };
  }
  if (row.seconds > 0) {
    return { label: 'badgeResume', bg: colors.surfaceAlt, color: colors.textMuted };
  }
  return { label: 'badgeNew', bg: colors.surfaceAlt, color: colors.textFaint };
}

const baseStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    height: 44,
    paddingRight: spacing.md,
  },
  backLabel: {
    color: colors.text,
    fontSize: 14.5,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  card: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  cardLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  bigValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 74,
    paddingTop: spacing.sm,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  chartBar: {
    width: 14,
    borderRadius: 7,
    backgroundColor: colors.accentSoft,
  },
  chartBarToday: {
    backgroundColor: colors.accent,
  },
  chartDay: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '600',
  },
  chartDayToday: {
    color: colors.accentText,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardValue: {
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
  empty: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 18,
  },
  video: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  videoTexts: {
    flex: 1,
    gap: 3,
  },
  videoTitle: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 18,
  },
  videoMeta: {
    color: colors.textFaint,
    fontSize: 11.5,
    fontWeight: '500',
  },
  badge: {
    height: 24,
    paddingHorizontal: 9,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 110,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
});
