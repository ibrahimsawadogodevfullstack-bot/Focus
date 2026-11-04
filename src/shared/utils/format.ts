export function timeAgo(timestamp: number | null | undefined, locale: string = 'fr') {
  if (!timestamp) return '';
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return relative.format(0, 'second');

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return relative.format(-minutes, 'minute');

  const hours = Math.round(minutes / 60);
  if (hours < 24) return relative.format(-hours, 'hour');

  const days = Math.round(hours / 24);
  if (days < 7) return relative.format(-days, 'day');

  const weeks = Math.round(days / 7);
  if (weeks < 5) return relative.format(-weeks, 'week');

  const months = Math.round(days / 30);
  if (months < 12) return relative.format(-months, 'month');

  const years = Math.round(days / 365);
  return relative.format(-years, 'year');
}

export function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

export function formatDateShort(timestamp: number = Date.now(), locale: string = 'fr') {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function startOfDay(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
