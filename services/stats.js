import { dayKey } from './tracking';

const DAY = 24 * 60 * 60 * 1000;
const MONTHS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

export const WEEKLY_GOAL = 8;

/** Lundi 00:00 de la semaine courante. */
export function startOfWeek(now = Date.now()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  const shift = (date.getDay() + 6) % 7; // lundi = 0
  date.setDate(date.getDate() - shift);
  return date.getTime();
}

export function weekDays(now = Date.now()) {
  const start = startOfWeek(now);
  return Array.from({ length: 7 }, (_, index) => {
    const stamp = start + index * DAY;
    const date = new Date(stamp);
    return {
      key: dayKey(stamp),
      label: ['L', 'M', 'M', 'J', 'V', 'S', 'D'][index],
      stamp,
      day: date.getDate(),
    };
  });
}

export function weekLabel(now = Date.now()) {
  const start = new Date(startOfWeek(now));
  const end = new Date(startOfWeek(now) + 6 * DAY);
  const startText = `${start.getDate()} ${MONTHS[start.getMonth()]}`;
  const endText = `${end.getDate()} ${MONTHS[end.getMonth()]}`;
  return `${startText} – ${endText}`;
}

/** « 3 h 05 », « 25 min », « < 1 min ». */
export function formatEffort(seconds = 0) {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return total === 0 ? '0 min' : '< 1 min';
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total % 3600) / 60);
  if (hours > 0) return `${hours} h ${`${minutes}`.padStart(2, '0')}`;
  return `${minutes} min`;
}

export function formatClockShort(seconds = 0) {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${`${rest}`.padStart(2, '0')}`;
}

export function daysSince(timestamp, now = Date.now()) {
  if (!timestamp) return null;
  return Math.floor((now - timestamp) / DAY);
}

function videosByCategory(videos, categories) {
  const map = new Map();
  for (const category of categories) {
    map.set(category.id, videos.filter((video) => category.channelIds.includes(video.channelId)));
  }
  return map;
}

function trackedVideos(tracking) {
  return Object.values(tracking.videos ?? {});
}

function statusOf({ hasActivity, days, toReview, ratio }) {
  if (!hasActivity) return { key: 'empty', label: 'Aucune activité' };
  if (days !== null && days >= 7) return { key: 'neglected', label: 'Négligé' };
  if (toReview > 0) {
    return { key: 'review', label: `${toReview} à revoir` };
  }
  if (ratio >= 0.6) return { key: 'comfort', label: "À l'aise" };
  return { key: 'progress', label: 'En cours' };
}

/**
 * Agrège les statistiques de la semaine et par catégorie.
 * `videos` = vidéos actuellement dans l'accueil (pour les totaux).
 */
export function summarize({ tracking, categories, videos, now = Date.now() }) {
  const days = weekDays(now);
  const tracked = trackedVideos(tracking);
  const feedByCategory = videosByCategory(videos, categories);

  const weekKeys = new Set(days.map((day) => day.key));

  let weekSeconds = 0;
  let activeDays = 0;
  const daily = days.map((day) => {
    const entry = tracking.days?.[day.key];
    const seconds = typeof entry === 'number' ? entry : entry?.seconds ?? 0;
    weekSeconds += seconds;
    if (seconds > 0) activeDays += 1;
    return { ...day, seconds };
  });

  const completedThisWeek = tracked.filter(
    (video) => video.completed && video.completedAt && weekKeys.has(dayKey(video.completedAt)),
  ).length;

  const perCategory = categories.map((category) => {
    const channelIds = new Set(category.channelIds);
    const feedVideos = feedByCategory.get(category.id) ?? [];
    const feedIds = new Set(feedVideos.map((video) => video.videoId));

    // Temps de la semaine : somme des canaux de la catégorie.
    let seconds = 0;
    for (const day of days) {
      const entry = tracking.days?.[day.key];
      if (!entry || typeof entry === 'number') continue;
      for (const [channelId, value] of Object.entries(entry.channels ?? {})) {
        if (channelIds.has(channelId)) seconds += value;
      }
    }

    const categoryTracked = tracked.filter((video) => channelIds.has(video.channelId));
    const completed = feedVideos.filter(
      (video) => tracking.videos?.[video.videoId]?.completed,
    ).length;

    const lastAt = categoryTracked.reduce(
      (latest, video) => Math.max(latest, video.lastAt ?? 0),
      0,
    );

    const toReview = categoryTracked.filter(
      (video) => video.rating === 'fragile' && !video.completed,
    ).length;

    const ratio = feedVideos.length > 0 ? completed / feedVideos.length : 0;
    const daysAgo = lastAt ? daysSince(lastAt, now) : null;
    const status = statusOf({
      hasActivity: Boolean(lastAt) || seconds > 0,
      days: daysAgo,
      toReview,
      ratio,
    });

    return {
      id: category.id,
      name: category.name,
      seconds,
      completed,
      total: feedVideos.length,
      lastAt: lastAt || null,
      daysSince: daysAgo,
      toReview,
      ratio,
      status,
      videoCount: categoryTracked.length,
      reviewIds: new Set(
        categoryTracked.filter((video) => video.rating === 'fragile').map((video) => video.videoId),
      ),
      feedIds,
    };
  });

  return {
    weekSeconds,
    activeDays,
    completedThisWeek,
    daily,
    categories: perCategory,
    goal: WEEKLY_GOAL,
    weekLabel: weekLabel(now),
  };
}

/** Ligne « MES VIDÉOS » : vidéos suivies de la catégorie, les plus récentes d'abord. */
export function categoryVideos({ tracking, category, videos }) {
  const channelIds = new Set(category.channelIds);
  const rows = new Map();

  for (const video of videos) {
    if (!channelIds.has(video.channelId)) continue;
    const stats = tracking.videos?.[video.videoId];
    rows.set(video.videoId, {
      videoId: video.videoId,
      title: video.title,
      channelTitle: video.channelTitle,
      channelId: video.channelId,
      publishedAt: video.publishedAt,
      inFeed: true,
      seconds: stats?.seconds ?? 0,
      position: stats?.position ?? 0,
      duration: stats?.duration ?? 0,
      completed: Boolean(stats?.completed),
      rating: stats?.rating ?? null,
      replays: stats?.replays ?? 0,
      lastReplayAt: stats?.lastReplayAt ?? null,
      lastAt: stats?.lastAt ?? null,
    });
  }

  // Vidéos regardées mais sorties du flux récent.
  for (const stats of Object.values(tracking.videos ?? {})) {
    if (!channelIds.has(stats.channelId) || rows.has(stats.videoId)) continue;
    rows.set(stats.videoId, {
      videoId: stats.videoId,
      title: stats.title,
      channelTitle: stats.channelTitle,
      channelId: stats.channelId,
      publishedAt: stats.publishedAt,
      inFeed: false,
      seconds: stats.seconds ?? 0,
      position: stats.position ?? 0,
      duration: stats.duration ?? 0,
      completed: Boolean(stats.completed),
      rating: stats.rating ?? null,
      replays: stats.replays ?? 0,
      lastReplayAt: stats.lastReplayAt ?? null,
      lastAt: stats.lastAt ?? null,
    });
  }

  return [...rows.values()]
    .filter((row) => row.lastAt || row.seconds > 0 || row.completed)
    .sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0));
}

/** Phrase de synthèse façon « Belle avancée en maths… ». */
export function insightFor(summary) {
  const active = summary.categories.filter((category) => category.seconds > 0 || category.completed > 0);

  if (active.length === 0) {
    return 'Ouvre une vidéo pour commencer : ton temps, ta progression et tes révisions apparaîtront ici.';
  }

  const best = [...active].sort((a, b) => b.seconds - a.seconds)[0];
  const neglected = summary.categories
    .filter((category) => category.daysSince !== null && category.daysSince >= 7)
    .sort((a, b) => b.daysSince - a.daysSince)[0];
  const review = summary.categories
    .filter((category) => category.toReview > 0)
    .sort((a, b) => b.toReview - a.toReview)[0];

  const parts = [];
  const celebrate = best && best.seconds > 0 && !(review && review.id === best.id);
  if (celebrate) {
    parts.push(`Belle avancée dans « ${best.name} ».`);
  }
  if (neglected) {
    parts.push(`« ${neglected.name} » est resté de côté depuis ${neglected.daysSince} jours.`);
  }
  if (review) {
    parts.push(
      `${review.toReview} vidéo${review.toReview > 1 ? 's' : ''} de « ${review.name} » ${
        review.toReview > 1 ? 'sont' : 'est'
      } à revoir.`,
    );
  }

  return parts.join(' ') || 'Continue : ta régularité construit tes progrès.';
}
