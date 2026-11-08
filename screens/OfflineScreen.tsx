import { useState } from 'react';
import type { ComponentType } from 'react';

import FeedScreen from './FeedScreen';

const SharedFeedScreen = FeedScreen as ComponentType<any>;

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
    />
  );
}
