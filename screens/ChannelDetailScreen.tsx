import type { ComponentType } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import FeedScreen from './FeedScreen';
import { mergeChannelVideos, type ChannelPageVideo } from '../services/channelPageModel';
import {
  fetchChannelPage,
  isChannelPaginationAvailable,
} from '../services/channelVideos';
import ChannelAvatar from '../src/shared/ui/ChannelAvatar';
import SectionLabel from '../src/shared/ui/SectionLabel';
import { colors, fontSize, layout, radius, spacing } from '../src/shared/theme/tokens';
import { useThemeStyles } from '../src/shared/theme/ThemeProvider';

const SharedFeedScreen = FeedScreen as ComponentType<any>;

type Channel = { id: string; title?: string };

export default function ChannelDetailScreen({
  channel,
  videos,
  formats,
  seenIds,
  avatars,
  trackingVideos,
  dataSaver,
  loading = false,
  refreshing = false,
  onRefresh,
  onOpen,
  onBack,
  categories,
  onDownload,
}: {
  channel: Channel;
  videos: any[];
  formats: Record<string, string>;
  seenIds: string[];
  avatars: Record<string, string>;
  trackingVideos: Record<string, any>;
  dataSaver: boolean;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onOpen: (video: any, queue: any[]) => void;
  onBack: () => void;
  categories?: any[];
  onDownload?: (video: any) => void;
}) {
  const styles = useThemeStyles(baseStyles);
  const { t } = useTranslation('channels');

  const name = channel.title || channel.id;

  // Scroll infini : les 15 vidéos du RSS, puis les pages chargées via yt-dlp.
  const paginationAvailable = isChannelPaginationAvailable();
  const [extraVideos, setExtraVideos] = useState<ChannelPageVideo[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(paginationAvailable);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const pageRef = useRef(0);
  const loadingRef = useRef(false);

  // Changer de chaîne repart de zéro, sans réutiliser la page précédente.
  useEffect(() => {
    setExtraVideos([]);
    setLoadingMore(false);
    setHasMore(isChannelPaginationAvailable());
    setLoadMoreError(null);
    pageRef.current = 0;
    loadingRef.current = false;
  }, [channel.id]);

  const channelTitle = useMemo(
    () => videos.find((video) => video?.channelTitle)?.channelTitle || '',
    [videos],
  );

  const mergedVideos = useMemo(
    () => mergeChannelVideos(videos, extraVideos),
    [videos, extraVideos],
  );

  const loadMore = useCallback(async () => {
    if (loading || loadingRef.current || !hasMore) return;
    if (!isChannelPaginationAvailable()) return;

    loadingRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const page = pageRef.current;
      const result = await fetchChannelPage({ channel, channelTitle, page });
      if (result.videos.length > 0) {
        setExtraVideos((previous) => mergeChannelVideos(previous, result.videos));
        pageRef.current = page + 1;
      }
      setHasMore(result.videos.length > 0 && result.hasMore);
    } catch (error: any) {
      setLoadMoreError(error?.message ?? '');
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [channel, channelTitle, hasMore, loading]);

  const header = (
    <View style={styles.header}>
      <View style={styles.card}>
        <ChannelAvatar uri={avatars[channel.id]} name={name} size={64} />

        <View style={styles.texts}>
          <Text style={styles.title} numberOfLines={2}>
            {name}
          </Text>
          <Text style={styles.channelId} numberOfLines={1}>
            {channel.id}
          </Text>
          <Text style={styles.meta}>{t('videoCount', { count: mergedVideos.length })}</Text>
        </View>
      </View>

      <Pressable
        onPress={() =>
          Linking.openURL(`https://www.youtube.com/channel/${channel.id}`)
        }
        accessibilityRole="link"
        accessibilityLabel={t('openOnYouTube')}
        style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
      >
        <Text style={styles.linkText}>{t('openOnYouTube')}</Text>
      </Pressable>

      <SectionLabel style={styles.section}>{t('videosSection')}</SectionLabel>
    </View>
  );

  return (
    <SharedFeedScreen
      source="remote"
      videos={mergedVideos}
      formats={formats}
      channels={[channel]}
      categories={[]}
      activeCategoryId={null}
      onSelectCategory={() => {}}
      onOpenCategories={onBack}
      onOpenChannels={onBack}
      onBack={onBack}
      headerTitle={name}
      headerContent={header}
      showCategoryChips={false}
      seenIds={seenIds}
      avatars={avatars}
      trackingVideos={trackingVideos}
      dataSaver={dataSaver}
      loading={loading}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onOpen={onOpen}
      onDownload={onDownload}
      onEndReached={paginationAvailable ? loadMore : undefined}
      loadingMore={loadingMore}
      hasMore={paginationAvailable && hasMore}
      loadMoreError={loadMoreError}
      onLoadMoreRetry={loadMore}
    />
  );
}

const baseStyles = StyleSheet.create({
  header: {
    width: '100%',
    maxWidth: 720 + layout.gridGutter * 2,
    alignSelf: 'center',
    paddingHorizontal: layout.gridGutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  texts: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.headline,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  channelId: {
    color: colors.textFaint,
    fontSize: fontSize.caption,
    letterSpacing: 0.2,
  },
  meta: {
    color: colors.textMuted,
    fontSize: fontSize.meta,
    fontWeight: '600',
  },
  link: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  linkPressed: {
    opacity: 0.7,
  },
  linkText: {
    color: colors.accentText,
    fontSize: fontSize.meta,
    fontWeight: '700',
  },
  section: {
    marginLeft: spacing.xs,
  },
});
