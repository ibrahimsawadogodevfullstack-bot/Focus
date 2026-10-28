import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BrandMark from '../components/BrandMark';
import { Chevron } from '../components/Icons';
import { colors, radius, spacing } from '../constants/theme';
import {
  categoryVideos,
  daysSince,
  formatClockShort,
  formatEffort,
  summarize,
  weekDays,
} from '../services/stats';

const DAY = 24 * 60 * 60 * 1000;

function lastActivityLabel(timestamp) {
  const days = daysSince(timestamp);
  if (days === null) return 'Aucune activité';
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  return `il y a ${days} jours`;
}

export default function CategoryStatsScreen({ category, tracking, categories, videos, onBack, onOpen }) {
  const summary = useMemo(
    () => summarize({ tracking, categories, videos }),
    [tracking, categories, videos],
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
    return weekDays().map((day) => {
      const entry = tracking.days?.[day.key];
      let seconds = 0;
      if (entry && typeof entry === 'object') {
        for (const [channelId, value] of Object.entries(entry.channels ?? {})) {
          if (channelIds.has(channelId)) seconds += value;
        }
      }
      return { ...day, seconds };
    });
  }, [tracking.days, channelIds]);

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
          accessibilityLabel="Retour aux statistiques"
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Chevron direction="left" color={colors.text} size={9} thickness={2} />
          <Text style={styles.backLabel}>Stats</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BrandMark style={styles.brand} />
        <Text style={styles.title}>{category.name}</Text>
        <Text style={styles.subtitle}>
          Dernière activité : {lastActivityLabel(stats.lastAt)}
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Cette semaine</Text>
          <Text style={styles.bigValue}>{formatEffort(stats.seconds)}</Text>

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
            <Text style={styles.cardLabel}>Avancement</Text>
            <Text style={styles.cardValue}>
              {stats.completed} / {stats.total} vidéos
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${Math.round(stats.ratio * 100)}%` }]} />
          </View>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Mes vidéos</Text>
          <View style={styles.sectionRule} />
        </View>

        {rows.length === 0 ? (
          <Text style={styles.empty}>
            Aucune vidéo regardée dans cette catégorie pour le moment.
          </Text>
        ) : (
          rows.map((row) => (
            <Pressable
              key={row.videoId}
              onPress={() => onOpen(row, rows)}
              accessibilityRole="button"
              accessibilityLabel={`Reprendre ${row.title}`}
              style={({ pressed }) => [styles.video, pressed && styles.pressed]}
            >
              <View style={styles.videoTexts}>
                <Text style={styles.videoTitle} numberOfLines={2}>
                  {row.title}
                </Text>
                <Text style={styles.videoMeta} numberOfLines={1}>
                  {videoMeta(row)}
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

function videoMeta(row) {
  if (row.completed) {
    const parts = ['Terminée'];
    if (row.replays > 0 && row.lastReplayAt !== null) {
      parts.push(
        `passage ${formatClockShort(row.lastReplayAt)} revu ${row.replays} fois`,
      );
    } else if (row.duration > 0) {
      parts.push(formatEffort(row.duration));
    }
    return parts.join(' · ');
  }

  const percent = row.duration > 0 ? Math.round((row.position / row.duration) * 100) : 0;
  const progress =
    row.seconds > 0 ? `En cours · ${Math.min(99, Math.max(1, percent))} % vu` : null;

  if (row.rating === 'fragile') {
    return progress ? `${progress} · marquée fragile` : 'Marquée fragile · à revoir';
  }
  if (progress) return progress;
  if (row.replays > 0) return `Revue ${row.replays} fois`;
  return 'Pas encore commencée';
}

function VideoBadge({ row }) {
  const { label, bg, color } = badgeFor(row);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function badgeFor(row) {
  if (row.rating === 'solide') {
    return { label: 'Bien compris', bg: colors.successSoft, color: colors.success };
  }
  if (row.rating === 'fragile') {
    return { label: 'À revoir', bg: colors.warnSoft, color: colors.warn };
  }
  if (row.completed) {
    return { label: 'Terminée', bg: colors.accentSoft, color: colors.accentText };
  }
  if (row.seconds > 0) {
    return { label: 'Reprendre', bg: colors.surfaceAlt, color: colors.textMuted };
  }
  return { label: 'Nouvelle', bg: colors.surfaceAlt, color: colors.textFaint };
}

const styles = StyleSheet.create({
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
  brand: {
    marginBottom: spacing.md,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 2,
    color: colors.textFaint,
    fontSize: 12.5,
    fontWeight: '500',
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
