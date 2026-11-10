/**
 * Géométrie d'une sparkline, sans dépendance à React ni à `react-native-svg`.
 *
 * Le composant `Sparkline` se contente de rendre ces chemins ; toute la
 * logique (normalisation, valeurs manquantes, série plate) est testable ici.
 */

export interface SparklinePoint {
  x: number;
  y: number;
}

export interface SparklineGeometry {
  /** Chemin SVG de la courbe (`M … L …`), vide si aucune valeur. */
  line: string;
  /** Chemin fermé sous la courbe, pour l'aire colorée. */
  area: string;
  points: SparklinePoint[];
  /** Valeur maximale retenue (0 si la série est vide ou nulle). */
  max: number;
}

const EMPTY: SparklineGeometry = { line: '', area: '', points: [], max: 0 };

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampPadding(padding: number, width: number, height: number): number {
  const limit = Math.min(width, height) / 2 - 1;
  if (!Number.isFinite(padding) || padding < 0) return 0;
  return Math.max(0, Math.min(padding, Math.max(0, limit)));
}

/**
 * Construit les chemins d'une sparkline.
 *
 * - les valeurs non finies ou négatives sont ramenées à 0 ;
 * - une série sans activité est tracée au centre (ligne plate), pas collée en bas ;
 * - avec une seule valeur, la courbe devient un segment horizontal centré.
 */
export function buildSparkline(
  values: readonly number[],
  width: number,
  height: number,
  padding = 2,
): SparklineGeometry {
  if (!Array.isArray(values) || values.length === 0) return EMPTY;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return EMPTY;
  if (width <= 0 || height <= 0) return EMPTY;

  const pad = clampPadding(padding, width, height);
  const innerWidth = width - pad * 2;
  const innerHeight = height - pad * 2;

  const clean = values.map((value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  });
  const max = clean.reduce((peak, value) => Math.max(peak, value), 0);

  const points: SparklinePoint[] = clean.map((value, index) => {
    const x =
      clean.length === 1
        ? width / 2
        : pad + (innerWidth * index) / (clean.length - 1);
    const y =
      max > 0 ? pad + innerHeight * (1 - value / max) : pad + innerHeight / 2;
    return { x: round(x), y: round(y) };
  });

  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const first = points[0];
  const last = points[points.length - 1];
  const area = `${line} L ${last.x} ${round(height)} L ${first.x} ${round(height)} Z`;

  return { line, area, points, max };
}
