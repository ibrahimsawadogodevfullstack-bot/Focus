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

export type YtdlpCompleteEvent = {
  id: string;
  processId: string;
  filePath: string;
  sizeBytes: number;
  format: 'video' | 'audio';
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

export type YtdlpDownloadOptions = {
  id: string;
  url: string;
  outDir: string;
  fileName?: string;
  format?: 'video' | 'audio';
  quality?: '480p' | '720p' | '1080p';
};

interface YtdlpNativeModule {
  getVersion(): Promise<string>;
  getMetadata(url: string): Promise<YtdlpMetadata>;
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
