// Helpers de calendrier partagés par le suivi et les statistiques.
//
// Ils sont volontairement purs (aucun accès au stockage) afin d'être testables
// avec `node --test` et de rester la seule source de vérité sur ce qu'est
// « un jour » et « une semaine ».

export const DAY_MS = 24 * 60 * 60 * 1000;

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

const WEEK_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Clé locale d'un jour : « 2026-10-29 ». */
export function dayKey(timestamp: number = Date.now()) {
  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Lundi 00:00 de la semaine courante. */
export function startOfWeek(now: number = Date.now()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  const shift = (date.getDay() + 6) % 7; // lundi = 0
  date.setDate(date.getDate() - shift);
  return date.getTime();
}

/**
 * Les sept jours de la semaine courante.
 *
 * On avance par `setDate(+1)` et non par `+ DAY_MS` : aux changements d'heure,
 * ajouter 86 400 000 ms décale l'heure locale et peut produire deux fois la
 * même clé de jour (ou en sauter une).
 */
export function weekDays(now: number = Date.now()) {
  const start = new Date(startOfWeek(now));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      key: dayKey(date.getTime()),
      label: WEEK_LETTERS[index],
      stamp: date.getTime(),
      day: date.getDate(),
    };
  });
}

export function weekLabel(now: number = Date.now()) {
  const start = new Date(startOfWeek(now));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const startText = `${start.getDate()} ${MONTHS[start.getMonth()]}`;
  const endText = `${end.getDate()} ${MONTHS[end.getMonth()]}`;
  return `${startText} – ${endText}`;
}

export function daysSince(timestamp: number | null | undefined, now: number = Date.now()) {
  if (!timestamp) return null;
  return Math.floor((now - timestamp) / DAY_MS);
}
