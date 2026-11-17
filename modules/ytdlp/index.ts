import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export type YtdlpMetadata = {
  videoId: string;
  title: string;
  channelName: string;
  durationSec: number;
  thumbnailUrl: string;
};

export type YtdlpProgressEvent = {
  id: string;
  processId: string;
  progress: number; // 0..1
  percent: number; // 0..100
  etaSeconds: number;
  speed: string | null;
  detail: string;
};

export type YtdlpDownloadMetadata = {
  title?: string | null;
  channelName?: string | null;
  durationSec?: number | null;
  thumbnailUrl?: string | null;
};

export type YtdlpCompleteEvent = {
  id: string;
  processId: string;
  filePath: string;
  sizeBytes: number;
  format: 'video' | 'audio';
  /** Renseigné par yt-dlp (fichier info.json), après le téléchargement. */
  metadata?: YtdlpDownloadMetadata | null;
};

export type YtdlpErrorEvent = {
  id: string;
  processId: string;
  code: string;
  message: string;
};

export type YtdlpVersionEvent = {
  version: string;
};

export type YtdlpUpdateResult = {
  version: string;
  updated: boolean;
  /** `busy` : un téléchargement tourne, la mise à jour est reportée. */
  skipped?: 'busy';
};

export type YtdlpDownloadOptions = {
  id: string;
  url: string;
  outDir: string;
  fileName?: string;
  format?: 'video' | 'audio';
  quality?: '480p' | '720p' | '1080p';
  /** Libellé de la notification de premier plan, déjà traduit. */
  notificationLabel?: string;
};

/** Une ligne de l'onglet « Vidéos » d'une chaîne (extraction aplatie). */
export type YtdlpChannelVideo = {
  videoId: string;
  title: string;
  durationSec: number;
  viewCount: number;
  thumbnailUrl: string;
};

export type YtdlpChannelPage = {
  videos: YtdlpChannelVideo[];
  /** Vrai tant que la dernière page demandée était pleine. */
  hasMore: boolean;
};

export type YtdlpChannelPageOptions = {
  channelId: string;
  /** Rang de la première vidéo demandée, à partir de 1. */
  start?: number;
  /** Nombre de vidéos à demander (1..50). */
  count?: number;
};

interface YtdlpNativeModule {
  getVersion(): Promise<string>;
  update(): Promise<YtdlpUpdateResult>;
  getMetadata(url: string): Promise<YtdlpMetadata>;
  listChannelVideos(options: YtdlpChannelPageOptions): Promise<YtdlpChannelPage>;
  download(options: YtdlpDownloadOptions): Promise<string>;
  cancel(processId: string): Promise<boolean>;
  addListener(
    event: 'onProgress',
    callback: (event: YtdlpProgressEvent) => void,
  ): { remove: () => void };
  addListener(
    event: 'onComplete',
    callback: (event: YtdlpCompleteEvent) => void,
  ): { remove: () => void };
  addListener(
    event: 'onError',
    callback: (event: YtdlpErrorEvent) => void,
  ): { remove: () => void };
  addListener(
    event: 'onVersion',
    callback: (event: YtdlpVersionEvent) => void,
  ): { remove: () => void };
  removeAllListeners(event: string): void;
}

const isAndroid = Platform.OS === 'android';

export const Ytdlp = (isAndroid
  ? (requireOptionalNativeModule<YtdlpNativeModule>('Ytdlp') ?? null)
  : null) as YtdlpNativeModule | null;

export function isYtdlpAvailable(): boolean {
  return Ytdlp !== null;
}
