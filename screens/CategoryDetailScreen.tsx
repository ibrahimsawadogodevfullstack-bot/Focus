import type { ComponentType } from 'react';

import FeedScreen from './FeedScreen';

const SharedFeedScreen = FeedScreen as ComponentType<any>;

export default function CategoryDetailScreen({
  categoryId,
  categoryName,
  categories,
  videos,
  formats,
  channels,
  seenIds,
  avatars,
  trackingVideos,
  dataSaver,
  onOpen,
  onDownload,
  onBack,
}: {
  categoryId: string;
  categoryName: string;
  categories: { id: string; name: string; channelIds: string[] }[];
  videos: any[];
  formats: Record<string, string>;
  channels: any[];
  seenIds: string[];
  avatars: Record<string, string>;
  trackingVideos: Record<string, any>;
  dataSaver: boolean;
  onOpen: (video: any, queue: any[]) => void;
  onDownload: (video: any, categoryId: string) => void;
  onBack: () => void;
}) {
  return (
    <SharedFeedScreen
      source="remote"
      videos={videos}
      formats={formats}
      channels={channels}
      categories={categories}
      activeCategoryId={categoryId}
      onSelectCategory={() => {}}
      onOpenCategories={onBack}
      onOpenChannels={onBack}
      onBack={onBack}
      headerTitle={categoryName}
      showCategoryChips={false}
      seenIds={seenIds}
      avatars={avatars}
      trackingVideos={trackingVideos}
      dataSaver={dataSaver}
      onOpen={onOpen}
      onDownload={onDownload}
    />
  );
}
