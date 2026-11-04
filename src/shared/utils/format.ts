export function timeAgo(timestamp: number | null | undefined, locale: string = 'fr') {
  if (!timestamp) return '';
  const english = locale.toLowerCase().startsWith('en');
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return english ? 'just now' : 'à l’instant';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return english ? `${minutes} min ago` : `il y a ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return english ? `${hours} hr ago` : `il y a ${hours} h`;

  const days = Math.round(hours / 24);
  if (days < 7) {
    return english
      ? `${days} day${days === 1 ? '' : 's'} ago`
      : `il y a ${days} j`;
  }

  const weeks = Math.round(days / 7);
  if (weeks < 5) {
    return english
      ? `${weeks} week${weeks === 1 ? '' : 's'} ago`
      : `il y a ${weeks} sem`;
  }

  const months = Math.round(days / 30);
  if (months < 12) {
    return english ? `${months} mo ago` : `il y a ${months} mois`;
  }

  const years = Math.round(days / 365);
  return english
    ? `${years} year${years === 1 ? '' : 's'} ago`
    : `il y a ${years} an${years === 1 ? '' : 's'}`;
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
