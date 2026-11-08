import { useSyncExternalStore } from 'react';

import { getDownloadsSnapshot, subscribeDownloads } from '../services/downloadManager';

export function useDownloads() {
  return useSyncExternalStore(subscribeDownloads, getDownloadsSnapshot, getDownloadsSnapshot);
}
