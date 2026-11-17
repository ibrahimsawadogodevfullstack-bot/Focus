import { useSyncExternalStore } from 'react';

import {
  getDownloadQueueState,
  getDownloadsSnapshot,
  subscribeDownloads,
} from '../services/downloadManager';

export function useDownloads() {
  return useSyncExternalStore(subscribeDownloads, getDownloadsSnapshot, getDownloadsSnapshot);
}

/** État de la file : en pause après une panne réseau, ou active. */
export function useDownloadQueueState() {
  return useSyncExternalStore(
    subscribeDownloads,
    getDownloadQueueState,
    getDownloadQueueState,
  );
}
