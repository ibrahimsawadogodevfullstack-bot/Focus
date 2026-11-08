// Modèle des statistiques de visionnage.
//
// Tout est local : aucune de ces structures n'est envoyée sur le réseau.
// Elles sont volontairement simples (objets JSON) pour rester lisibles dans
// AsyncStorage et faciles à agréger avec des fonctions pures.

export type ViewingPeriod = 'today' | '7d' | '30d';
export type ViewingFormat = 'short' | 'long';
export type ViewingSource = 'online' | 'offline';

export const VIEWING_PERIODS: readonly ViewingPeriod[] = ['today', '7d', '30d'];
export const PERIOD_DAYS: Record<ViewingPeriod, number> = {
  today: 1,
  '7d': 7,
  '30d': 30,
};

export const DEFAULT_PROFILE_ID = 'local';
export const VIEWING_SCHEMA_VERSION = 1;

export interface ViewingDay {
  /** Temps réellement passé à regarder, en secondes. */
  seconds: number;
  /** Temps par catégorie (`uncategorized` compris). */
  byCategory: Record<string, number>;
  /** Temps par chaîne. */
  byChannel: Record<string, number>;
  /** Temps par heure locale (0–23). */
  byHour: Record<string, number>;
  byFormat: Record<ViewingFormat, number>;
  bySource: Record<ViewingSource, number>;
  /** Vidéos réellement regardées (≥ 3 s) démarrées ce jour-là. */
  videos: number;
  completed: number;
  abandoned: number;
  /** Sessions commencées ce jour-là. */
  sessions: number;
  /** Somme des secondes de contenu vues (sert à la vitesse moyenne). */
  contentSeconds: number;
  /** Somme du temps réel × vitesse, pour la vitesse moyenne pondérée. */
  speedWeighted: number;
  /** Jours importés de l'ancien suivi (temps et chaînes seulement). */
  estimated?: boolean;
}

export interface ViewingVideoRecord {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  format: ViewingFormat;
  categoryId: string | null;
  categoryName: string | null;
  seconds: number;
  contentSeconds: number;
  duration: number;
  /** Nombre de lectures réellement commencées (≥ 3 s). */
  starts: number;
  /** Une vidéo terminée ne l'est qu'une fois, même en boucle. */
  completed: boolean;
  completedAt: number | null;
  abandonedCount: number;
  firstAt: number | null;
  lastAt: number | null;
}

export interface ViewingSession {
  start: number;
  end: number;
  seconds: number;
  videos: number;
}

export interface ViewingCategoryTotal {
  name: string | null;
  seconds: number;
}

export interface ViewingChannelTotal {
  title: string | null;
  seconds: number;
}

export interface ViewingShortsStreak {
  current: number;
  longest: number;
  longestAt: number | null;
}

export interface ViewingStats {
  schemaVersion: number;
  profileId: string;
  days: Record<string, ViewingDay>;
  videos: Record<string, ViewingVideoRecord>;
  categories: Record<string, ViewingCategoryTotal>;
  channels: Record<string, ViewingChannelTotal>;
  sessions: ViewingSession[];
  shorts: ViewingShortsStreak;
  lastActivityAt: number | null;
  updatedAt: number;
}

export interface PlaybackDescriptor {
  videoId: string;
  title?: string;
  channelId?: string;
  channelTitle?: string;
  format?: ViewingFormat;
  categoryId?: string | null;
  categoryName?: string | null;
  source?: ViewingSource;
}
