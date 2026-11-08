// Découpage d'un intervalle réel aux frontières d'heure locale.
//
// Indispensable pour que « aujourd'hui », « hier » et « le soir » restent
// justes quand une lecture traverse minuit ou un changement d'heure. Fonction
// pure, sans stockage, testable directement.

export interface TimeSlice {
  timestamp: number;
  seconds: number;
}

const MAX_SLICES = 48;

export function splitIntervalByHour(startMs: number, endMs: number): TimeSlice[] {
  const slices: TimeSlice[] = [];
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return slices;
  }

  let cursor = startMs;
  let guard = 0;
  while (cursor < endMs && guard < MAX_SLICES) {
    guard += 1;
    const date = new Date(cursor);
    date.setMinutes(0, 0, 0);
    date.setHours(date.getHours() + 1);
    const boundary = Math.min(date.getTime(), endMs);
    if (!(boundary > cursor)) break;
    slices.push({ timestamp: cursor, seconds: (boundary - cursor) / 1000 });
    cursor = boundary;
  }

  return slices;
}
