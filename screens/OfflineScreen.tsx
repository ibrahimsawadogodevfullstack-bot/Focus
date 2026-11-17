import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useTranslation } from 'react-i18next';

import { useDownloads } from '../hooks/useDownloads';
import FeedScreen from './FeedScreen';

const SharedFeedScreen = FeedScreen as ComponentType<any>;

const KEEP_AWAKE_TAG = 'focus-downloads';

export default function OfflineScreen({
  categories = [],
  onOpenCategories,
  onOpenDownload,
}: {
  categories: { id: string; name: string; channelIds?: string[] }[];
  onOpenCategories: () => void;
  onOpenDownload: (video: any) => void;
}) {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const { t } = useTranslation('offline');
  const downloads = useDownloads();

  // Filet de sécurité quand le service de premier plan n'a pas pu démarrer
  // (Android 12+ refuse parfois un service lancé en arrière-plan) : tant que la
  // liste des téléchargements est affichée, l'écran ne s'éteint pas. Une vidéo
  // d'une heure qui coupe l'écran au bout de 30 s échouait systématiquement.
  const hasActiveDownload = downloads.some(
    (download) => download.status === 'downloading' || download.status === 'queued',
  );

  useEffect(() => {
    if (!hasActiveDownload) return undefined;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [hasActiveDownload]);

  return (
    <SharedFeedScreen
      source="downloaded"
      videos={[]}
      formats={{}}
      channels={[]}
      categories={categories}
      activeCategoryId={activeCategoryId}
      onSelectCategory={setActiveCategoryId}
      onOpenCategories={onOpenCategories}
      onOpen={onOpenDownload}
      seenIds={[]}
      avatars={{}}
      loading={false}
      refreshing={false}
      failedChannels={[]}
      trackingVideos={{}}
      shortsPosition="top"
      dataSaver
      headerTitle={t('title')}
    />
  );
}
