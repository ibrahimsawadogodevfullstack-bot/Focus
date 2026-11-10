import {
  PERIOD_DAYS,
  type ViewingPeriod,
  type ViewingStats,
} from '../src/domain/viewing';
import {
  UNCATEGORIZED_KEY,
  categoryForChannel,
  categoryKey,
  type CategoryLike,
} from '../src/domain/categories';
import { DAY_MS, dayKey } from '../src/shared/utils/date';

// Agrégations pures des statistiques de visionnage.
//
// Aucune dépendance au stockage ni au réseau : ce module est la seule source
// de vérité pour les périodes, les parts, les comparaisons et les phrases de
// résumé. Il est donc testable directement avec `node --test`.

export interface DayPoint {
  key: string;
  timestamp: number;
  seconds: number;
  videos: number;
  isToday: boolean;
  /** Séances démarrées ce jour-là (série des sparklines « séances »). */
  sessions: number;
  /** Vidéos menées à la fin ce jour-là (série des sparklines « terminées »). */
  completed: number;
}

export interface CategorySlice {
  id: string;
  name: string;
  seconds: number;
  share: number;
  deleted: boolean;
  uncategorized: boolean;
}

export interface ChannelSlice {
  id: string;
  name: string;
  seconds: number;
  share: number;
}

export interface PeriodTotals {
  seconds: number;
  videos: number;
  activeDays: number;
  days: number;
  sessions: number;
  completed: number;
  abandoned: number;
  replays: number;
  averageSpeed: number | null;
}

export interface PeriodComparison {
  seconds: number | null;
  videos: number | null;
  activeDays: number | null;
  sessions: number | null;
}

export interface MomentTotals {
  night: number;
  morning: number;
  afternoon: number;
  evening: number;
  total: number;
  top: 'night' | 'morning' | 'afternoon' | 'evening' | null;
}

export interface SummarySentence {
  key: string;
  params?: Record<string, string | number | boolean>;
}

export interface PeriodSummary {
  period: ViewingPeriod;
  range: { start: number; end: number; dayKeys: string[] };
  days: DayPoint[];
  totals: PeriodTotals;
  previous: PeriodTotals | null;
  comparisons: PeriodComparison;
  categories: CategorySlice[];
  channels: ChannelSlice[];
  formats: { short: number; long: number; shortShare: number; longShare: number };
  moments: MomentTotals;
  weekday: { index: number; seconds: number } | null;
  sessions: { count: number; averageSeconds: number; longestSeconds: number };
  shorts: { longest: number; current: number };
  online: { online: number; offline: number };
  hasActivity: boolean;
  hasAnyHistory: boolean;
  estimated: boolean;
  sentences: SummarySentence[];
  /** Objectif du jour (0 = aucun), repris des réglages. */
  goalMinutes: number;
  todaySeconds: number;
}

const MOMENT_OF_HOUR = (hour: number): 'night' | 'morning' | 'afternoon' | 'evening' => {
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
};

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function addDays(timestamp: number, days: number): number {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

function dayKeysBetween(start: number, dayCount: number): string[] {
  return Array.from({ length: dayCount }, (_, index) => dayKey(addDays(start, index)));
}

function timestampForDayKey(key: string): number {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day).getTime();
}

/** Bornes des périodes : jours locaux complets, aujourd'hui inclus. */
export function resolvePeriodRange(period: ViewingPeriod, now: number = Date.now()) {
  const count = PERIOD_DAYS[period];
  const todayStart = startOfLocalDay(now);
  const start = addDays(todayStart, -(count - 1));
  const end = addDays(todayStart, 1);
  const previousStart = addDays(start, -count);
  return {
    start,
    end,
    dayKeys: dayKeysBetween(start, count),
    previous: {
      start: previousStart,
      end: start,
      dayKeys: dayKeysBetween(previousStart, count),
    },
  };
}

function derivedCategorySeconds(
  day: NonNullable<ViewingStats['days'][string]>,
  categories: readonly CategoryLike[],
): Record<string, number> {
  const keys = Object.keys(day.byCategory ?? {});
  if (keys.length > 0) return day.byCategory;

  // Jour importé de l'ancien suivi : on ne connaissait que les chaînes.
  const result: Record<string, number> = {};
  for (const [channelId, seconds] of Object.entries(day.byChannel ?? {})) {
    if (!(seconds > 0)) continue;
    const category = categoryForChannel(channelId, categories);
    const key = categoryKey(category?.id);
    result[key] = (result[key] ?? 0) + seconds;
  }
  return result;
}

function formatCategoryName(
  key: string,
  stats: ViewingStats,
  categories: readonly CategoryLike[],
): { name: string; deleted: boolean; uncategorized: boolean } {
  if (key === UNCATEGORIZED_KEY) {
    return { name: '', deleted: false, uncategorized: true };
  }
  const current = categories.find((category) => category.id === key);
  if (current) return { name: current.name, deleted: false, uncategorized: false };

  const stored = stats.categories[key]?.name;
  if (stored) return { name: stored, deleted: true, uncategorized: false };
  return { name: '', deleted: false, uncategorized: true };
}

function channelName(
  id: string,
  stats: ViewingStats,
): string {
  const stored = stats.channels[id]?.title;
  if (stored) return stored;
  for (const video of Object.values(stats.videos)) {
    if (video.channelId === id && video.channelTitle) return video.channelTitle;
  }
  return '';
}

function sessionsInRange(stats: ViewingStats, start: number, end: number) {
  return (stats.sessions ?? []).filter(
    (session) => session.start >= start && session.start < end,
  );
}

function metricTotals(
  stats: ViewingStats,
  dayKeys: string[],
  categories: readonly CategoryLike[],
  range: { start: number; end: number },
): PeriodTotals {
  let seconds = 0;
  let videos = 0;
  let activeDays = 0;
  let completed = 0;
  let abandoned = 0;
  let speedWeighted = 0;

  for (const key of dayKeys) {
    const day = stats.days[key];
    if (!day) continue;
    seconds += day.seconds;
    videos += day.videos;
    if (day.seconds > 0) activeDays += 1;
    completed += day.completed;
    abandoned += day.abandoned;
    speedWeighted += day.speedWeighted ?? 0;
  }

  const sessions = sessionsInRange(stats, range.start, range.end);
  let replays = 0;
  for (const video of Object.values(stats.videos)) {
    if (video.starts >= 2 && video.lastAt && video.lastAt >= range.start && video.lastAt < range.end) {
      replays += 1;
    }
  }

  return {
    seconds,
    videos,
    activeDays,
    days: dayKeys.length,
    sessions: sessions.length,
    completed,
    abandoned,
    replays,
    averageSpeed: seconds > 0 && speedWeighted > 0 ? speedWeighted / seconds : null,
  };
}

function percentChange(current: number, previous: number): number | null {
  if (!(previous > 0)) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function shares<T extends { seconds: number }>(items: T[], total: number) {
  return items.map((item) => ({ ...item, share: total > 0 ? item.seconds / total : 0 }));
}

function comparisonSentence(
  period: ViewingPeriod,
  current: number,
  previous: number,
): SummarySentence | null {
  if (!(previous > 0) || !(current > 0)) return null;
  const difference = Math.abs(current - previous);
  const suffix = period === 'today' ? 'Today' : period === '7d' ? '7d' : '30d';

  if (difference / previous < 0.05) {
    return { key: `summarySame${suffix}` };
  }
  return {
    key: current > previous ? `summaryMore${suffix}` : `summaryLess${suffix}`,
    params: { duration: Math.round(difference) },
  };
}

function lastSeenByCategory(
  stats: ViewingStats,
  categories: readonly CategoryLike[],
  now: number,
) {
  const seen: Record<string, number> = {};
  const keys = Object.keys(stats.days).sort().reverse();
  for (const key of keys) {
    const day = stats.days[key];
    const totals = derivedCategorySeconds(day, categories);
    for (const [categoryId, seconds] of Object.entries(totals)) {
      if (seconds > 0 && seen[categoryId] === undefined) {
        seen[categoryId] = timestampForDayKey(key);
      }
    }
  }
  return categories
    .map((category) => {
      const last = seen[category.id];
      if (last === undefined) return null;
      return {
        id: category.id,
        name: category.name,
        days: Math.max(0, Math.floor((startOfLocalDay(now) - startOfLocalDay(last)) / DAY_MS)),
      };
    })
    .filter((entry): entry is { id: string; name: string; days: number } => Boolean(entry))
    .filter((entry) => entry.days >= 7)
    .sort((a, b) => b.days - a.days);
}

function buildSentences(
  summary: Omit<PeriodSummary, 'sentences'>,
  stats: ViewingStats,
  categories: readonly CategoryLike[],
  now: number,
): SummarySentence[] {
  if (summary.totals.activeDays < 3) return [];

  const sentences: SummarySentence[] = [];
  const total = summary.totals.seconds;

  const top = summary.categories[0];
  if (top && total > 0 && top.share >= 0.25) {
    sentences.push({
      key: top.uncategorized ? 'summaryTopCategoryUncategorized' : 'summaryTopCategory',
      params: {
        name: top.uncategorized ? '' : top.name,
        percent: Math.round(top.share * 100),
        uncategorized: top.uncategorized,
      },
    });
  }

  if (summary.previous) {
    const comparison = comparisonSentence(
      summary.period,
      summary.totals.seconds,
      summary.previous.seconds,
    );
    if (comparison) sentences.push(comparison);
  }

  const goalSeconds = summary.goalMinutes * 60;
  if (goalSeconds > 0 && summary.todaySeconds >= goalSeconds) {
    sentences.push({
      key: 'summaryGoalReached',
      params: { target: summary.goalMinutes },
    });
  } else if (summary.formats.shortShare > 0.3 && total > 0) {
    sentences.push({
      key: 'summaryShorts',
      params: { percent: Math.round(summary.formats.shortShare * 100) },
    });
  } else {
    const idle = lastSeenByCategory(stats, categories, now)[0];
    if (idle) {
      sentences.push({
        key: 'summaryCategoryIdle',
        params: { name: idle.name, days: idle.days },
      });
    } else if (summary.sessions.longestSeconds >= 20 * 60) {
      sentences.push({
        key: 'summaryLongestSession',
        params: { duration: summary.sessions.longestSeconds },
      });
    }
  }

  return sentences.slice(0, 3);
}

/**
 * Construit tout ce dont les écrans ont besoin pour une période donnée.
 * `categories` sert uniquement aux jours importés de l'ancien suivi et aux
 * noms de catégories supprimées.
 */
export function buildPeriodSummary({
  stats,
  categories = [],
  period = '7d',
  now = Date.now(),
  goalMinutes = 0,
}: {
  stats: ViewingStats;
  categories?: readonly CategoryLike[];
  period?: ViewingPeriod;
  now?: number;
  goalMinutes?: number;
}): PeriodSummary {
  const range = resolvePeriodRange(period, now);
  const totals = metricTotals(stats, range.dayKeys, categories, range);
  const previous = metricTotals(stats, range.previous.dayKeys, categories, range.previous);

  const days: DayPoint[] = range.dayKeys.map((key) => {
    const day = stats.days[key];
    return {
      key,
      timestamp: timestampForDayKey(key),
      seconds: day?.seconds ?? 0,
      videos: day?.videos ?? 0,
      isToday: key === dayKey(now),
      sessions: day?.sessions ?? 0,
      completed: day?.completed ?? 0,
    };
  });

  const categorySeconds: Record<string, number> = {};
  const channelSeconds: Record<string, number> = {};
  let shortSeconds = 0;
  let estimated = false;
  const hourTotals: Record<string, number> = { night: 0, morning: 0, afternoon: 0, evening: 0 };
  const weekdays = Array.from({ length: 7 }, () => 0);

  for (const key of range.dayKeys) {
    const day = stats.days[key];
    if (!day) continue;
    if (day.estimated) estimated = true;

    for (const [categoryId, seconds] of Object.entries(derivedCategorySeconds(day, categories))) {
      if (seconds > 0) categorySeconds[categoryId] = (categorySeconds[categoryId] ?? 0) + seconds;
    }
    for (const [channelId, seconds] of Object.entries(day.byChannel ?? {})) {
      if (seconds > 0) channelSeconds[channelId] = (channelSeconds[channelId] ?? 0) + seconds;
    }

    shortSeconds += day.byFormat?.short ?? 0;
    for (const [hour, seconds] of Object.entries(day.byHour ?? {})) {
      if (!(seconds > 0)) continue;
      hourTotals[MOMENT_OF_HOUR(Number(hour))] += seconds;
    }

    const dayDate = new Date(timestampForDayKey(key));
    const weekday = (dayDate.getDay() + 6) % 7; // lundi = 0
    weekdays[weekday] += day.seconds;
  }

  const categorySlices: CategorySlice[] = Object.entries(categorySeconds)
    .map(([id, seconds]) => {
      const display = formatCategoryName(id, stats, categories);
      return {
        id,
        name: display.name,
        seconds,
        share: 0,
        deleted: display.deleted,
        uncategorized: display.uncategorized,
      };
    })
    .sort((a, b) => b.seconds - a.seconds);
  const categoryTotal = categorySlices.reduce((sum, item) => sum + item.seconds, 0);
  const categoriesWithShares = shares(categorySlices, categoryTotal);

  const channelSlices: ChannelSlice[] = Object.entries(channelSeconds)
    .map(([id, seconds]) => ({ id, name: channelName(id, stats), seconds, share: 0 }))
    .sort((a, b) => b.seconds - a.seconds);
  const channelTotal = channelSlices.reduce((sum, item) => sum + item.seconds, 0);
  const channelsWithShares = shares(channelSlices, channelTotal);

  const longSeconds = Math.max(0, totals.seconds - shortSeconds);
  const formatTotal = shortSeconds + longSeconds;
  const momentsTotal =
    hourTotals.night + hourTotals.morning + hourTotals.afternoon + hourTotals.evening;
  let topMoment: MomentTotals['top'] = null;
  for (const key of ['night', 'morning', 'afternoon', 'evening'] as const) {
    if (momentsTotal <= 0) break;
    if (topMoment === null || hourTotals[key] > hourTotals[topMoment]) topMoment = key;
  }

  let weekdayTop: { index: number; seconds: number } | null = null;
  for (let index = 0; index < weekdays.length; index += 1) {
    const seconds = weekdays[index];
    if (seconds <= 0) continue;
    if (!weekdayTop || seconds > weekdayTop.seconds) weekdayTop = { index, seconds };
  }

  const rangeSessions = sessionsInRange(stats, range.start, range.end);
  const sessionSeconds = rangeSessions.reduce((sum, session) => sum + session.seconds, 0);
  const longestSession = rangeSessions.reduce(
    (max, session) => Math.max(max, session.seconds),
    0,
  );

  let offlineSeconds = 0;
  let onlineSeconds = 0;
  for (const key of range.dayKeys) {
    const day = stats.days[key];
    if (!day) continue;
    offlineSeconds += day.bySource?.offline ?? 0;
    onlineSeconds += day.bySource?.online ?? 0;
  }
  // Les jours importés n'avaient pas cette information : on les compte comme
  // « en ligne », ce qui correspond à leur origine.
  const knownSource = offlineSeconds + onlineSeconds;
  if (knownSource < totals.seconds) onlineSeconds += totals.seconds - knownSource;

  const summaryBase: Omit<PeriodSummary, 'sentences'> = {
    period,
    range,
    days,
    totals,
    previous: previous.seconds > 0 || previous.videos > 0 ? previous : null,
    comparisons: {
      seconds: percentChange(totals.seconds, previous.seconds),
      videos: percentChange(totals.videos, previous.videos),
      activeDays: percentChange(totals.activeDays, previous.activeDays),
      sessions: percentChange(totals.sessions, previous.sessions),
    },
    categories: categoriesWithShares,
    channels: channelsWithShares,
    formats: {
      short: shortSeconds,
      long: longSeconds,
      shortShare: formatTotal > 0 ? shortSeconds / formatTotal : 0,
      longShare: formatTotal > 0 ? longSeconds / formatTotal : 0,
    },
    moments: {
      night: hourTotals.night,
      morning: hourTotals.morning,
      afternoon: hourTotals.afternoon,
      evening: hourTotals.evening,
      total: momentsTotal,
      top: topMoment,
    },
    weekday: weekdayTop,
    sessions: {
      count: rangeSessions.length,
      averageSeconds: rangeSessions.length > 0 ? sessionSeconds / rangeSessions.length : 0,
      longestSeconds: longestSession,
    },
    shorts: {
      longest:
        stats.shorts?.longestAt && stats.shorts.longestAt >= range.start && stats.shorts.longestAt < range.end
          ? stats.shorts.longest
          : 0,
      current: stats.shorts?.current ?? 0,
    },
    online: { online: onlineSeconds, offline: offlineSeconds },
    hasActivity: totals.seconds > 0 || totals.videos > 0,
    hasAnyHistory: Object.keys(stats.days).length > 0,
    estimated,
    goalMinutes,
    todaySeconds: stats.days[dayKey(now)]?.seconds ?? 0,
  };

  return {
    ...summaryBase,
    sentences: buildSentences(summaryBase, stats, categories, now),
  };
}

/** Durées localisées : « 1 h 05 » (FR) / « 1h 05m » (EN). */
export function formatWatchTime(seconds: number, locale = 'fr'): string {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const english = locale.toLowerCase().startsWith('en');
  if (total <= 0) return english ? '0 min' : '0 min';
  if (total < 60) {
    // Arrondi volontairement neutre : jamais « 0 min » pour une lecture réelle.
    return english ? '< 1 min' : '< 1 min';
  }
  const minutes = Math.round(total / 60);
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (english) return `${hours}h ${String(rest).padStart(2, '0')}m`;
  return `${hours} h ${String(rest).padStart(2, '0')}`;
}

/** Pourcentage localisé : « 42 % » (FR) / « 42% » (EN). */
export function formatPercent(share: number, locale = 'fr'): string {
  const percent = Math.round((Number(share) || 0) * 100);
  return locale.toLowerCase().startsWith('en') ? `${percent}%` : `${percent} %`;
}

/** Variation signée, neutre : « +12 % » / « −12 % ». */
export function formatVariation(percent: number | null, locale = 'fr'): string {
  if (percent === null) return '';
  const english = locale.toLowerCase().startsWith('en');
  const sign = percent > 0 ? '+' : percent < 0 ? '−' : '';
  const value = Math.abs(percent);
  return english ? `${sign}${value}%` : `${sign}${value} %`;
}
