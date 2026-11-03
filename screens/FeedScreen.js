import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import ActionSheet from '../components/ActionSheet';
import AppBar from '../components/AppBar';
import CategoryChips from '../components/CategoryChips';
import ConfirmSheet from '../src/shared/ui/ConfirmSheet';
import EmptyState from '../src/shared/ui/EmptyState';
import FeedSkeleton from '../components/FeedSkeleton';
import ShortsShelf from '../components/ShortsShelf';
import SyncBar from '../components/SyncBar';
import VideoCard from '../components/VideoCard';
import { DownloadIcon, TrashIcon } from '../src/shared/ui/Icons';
import { colors, layout, spacing } from '../src/shared/theme/tokens';
import { isFormatResolved, resolveFormats, splitByFormat } from '../src/domain/videoFormat';
import { hasFailedFormat } from '../services/formats';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';
import { timeAgo } from '../src/shared/utils/format';

const GUTTER = layout.gridGutter; // 16 px
const GAP = layout.gridGap; // 16 px

/** La rangée Shorts arrive après ce nombre de vidéos longues. */
export const SHORTS_SHELF_POSITION = 2;

const normalize = (value) =>
  (value || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Colonnes de la grille selon la largeur de l'écran. */
function columnsFor(width) {
  if (width < layout.twoColumnMinWidth) return 1;
  if (width < layout.threeColumnMinWidth) return 2;
  return 3;
}

export default function FeedScreen({
  videos,
  formats = {},
  channels,
  categories,
  activeCategoryId,
  onSelectCategory,
  onOpenCategories,
  onOpenChannels,
  onOpenProfile,
  seenIds,
  avatars = {},
  loading,
  refreshing,
  sync,
  error,
  fromCache,
  savedAt,
  failedChannels = [],
  onRefresh,
  trackingVideos = {},
  onOpen,
  onDownload,
  onRemoveChannel,
  shortsPosition = 'after-first-row',
  dataSaver = false,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemeStyles(baseStyles);
  const { t } = useTranslation(['home', 'common']);

  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [menuVideo, setMenuVideo] = useState(null);
  const [menuChannel, setMenuChannel] = useState(null);

  const columns = columnsFor(windowWidth);

  // Mobile-first : le portrait reste plein largeur. Le centrage n’est appliqué
  // que sur les grands écrans où le contenu n’a plus besoin d’occuper toute
  // la largeur de la feuille.
  const isCompactPhone = windowWidth < layout.twoColumnMinWidth;
  const contentWidth = isCompactPhone ? windowWidth : Math.min(windowWidth, layout.maxContentWidth);
  const sidePadding = isCompactPhone ? spacing.md : Math.max(0, (windowWidth - contentWidth) / 2);
  const cardWidth = Math.max(
    0,
    (contentWidth - 2 * GUTTER - (columns - 1) * GAP) / columns,
  );

  const activeCategory = useMemo(
    () => categories.find((category) => category.id === activeCategoryId) ?? null,
    [categories, activeCategoryId],
  );

  const scopeIds = useMemo(
    () => (activeCategory ? new Set(activeCategory.channelIds) : null),
    [activeCategory],
  );

  const scopedVideos = useMemo(() => {
    if (!scopeIds) return videos;
    return videos.filter((video) => scopeIds.has(video.channelId));
  }, [videos, scopeIds]);

  // Format effectif appliqué une fois : la grille, la rangée Shorts et le
  // lecteur lisent ensuite le même champ `format`.
  const formattedVideos = useMemo(
    () => resolveFormats(scopedVideos, formats),
    [scopedVideos, formats],
  );

  const visibleVideos = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return formattedVideos;
    return formattedVideos.filter(
      (video) =>
        normalize(video.title).includes(needle) ||
        normalize(video.channelTitle).includes(needle),
    );
  }, [query, formattedVideos]);

  // Les deux flux ne se mélangent jamais : les Shorts vont dans leur rangée,
  // les vidéos longues dans la grille.
  const { shorts, long } = useMemo(() => splitByFormat(visibleVideos), [visibleVideos]);

  // Vidéos dont le format n'est encore prouvé par rien : on ne dessine pas leur
  // vignette (un Short pourrait apparaître dans un cadre 16:9). Elles gardent
  // leur place avec un placeholder neutre, puis se résolvent progressivement.
  const pendingIds = useMemo(() => {
    const pending = new Set();
    for (const video of scopedVideos) {
      if (
        !isFormatResolved(video, formats) &&
        !hasFailedFormat(video.videoId)
      ) {
        pending.add(video.videoId);
      }
    }
    return pending;
  }, [scopedVideos, formats]);

  // Grille construite en lignes explicites : largeurs strictement égales, et
  // insertion de la rangée Shorts après la première ligne complète contenant
  // SHORTS_SHELF_POSITION vidéos (2 sur une colonne, 3 sur trois colonnes).
  const rows = useMemo(() => {
    const list = [];
    const at =
      shortsPosition === 'top'
        ? 0
        : Math.ceil(SHORTS_SHELF_POSITION / columns) * columns;
    let buffer = [];
    let inserted = shorts.length === 0;

    const flush = () => {
      if (buffer.length === 0) return;
      list.push({
        type: 'row',
        key: `row-${columns}-${list.length}`,
        videos: buffer,
      });
      buffer = [];
    };

    long.forEach((video, index) => {
      if (!inserted && index === at) {
        flush();
        list.push({ type: 'shorts', key: `shorts-${columns}` });
        inserted = true;
      }
      buffer.push(video);
      if (buffer.length === columns) flush();
    });

    flush();
    if (!inserted) list.push({ type: 'shorts', key: `shorts-${columns}` });

    return list;
  }, [long, shorts.length, columns, shortsPosition]);

  const seen = useMemo(() => new Set(seenIds), [seenIds]);
  const hasHistory = seenIds.length > 0;
  const scopeChannelCount = scopeIds ? scopeIds.size : channels.length;
  const isFirstLoad = loading && videos.length === 0;

  const syncActive = Boolean(sync?.active);
  const syncLabel = syncActive
    ? `${sync.done ?? 0}/${sync.total ?? 0} · ${sync.percent ?? 0} %`
    : '';

  // La barre d'onglets est en flux, sous la liste : sa hauteur exacte est
  // retirée de la zone visible (padding top 6 + onglets + zone sûre).
  const tabBarHeight = 6 + layout.tabBar + Math.max(insets.bottom, 6);

  const toggleSearch = useCallback(() => {
    setSearching((current) => {
      if (current) setQuery('');
      return !current;
    });
  }, []);

  const progressFor = useCallback(
    (video) => {
      const entry = trackingVideos?.[video.videoId];
      if (!entry || !(entry.duration > 0)) return 0;
      return entry.position / entry.duration;
    },
    [trackingVideos],
  );

  const renderItem = useCallback(
    ({ item }) => {
      if (item.type === 'shorts') {
        return (
          <ShortsShelf
            videos={shorts}
            seen={seen}
            hasHistory={hasHistory}
            sidePadding={sidePadding}
            dataSaver={dataSaver}
            onOpen={onOpen}
            onMore={onRemoveChannel ? setMenuVideo : undefined}
          />
        );
      }

      return (
        <View style={[styles.gridRow, { paddingHorizontal: sidePadding + GUTTER }]}>
          {item.videos.map((video) => (
            <VideoCard
              key={video.videoId}
              width={cardWidth}
              video={video}
              pending={pendingIds.has(video.videoId)}
              progress={progressFor(video)}
              duration={trackingVideos?.[video.videoId]?.duration}
              isNew={hasHistory && !seen.has(video.videoId)}
              onPress={() => onOpen(video, long)}
              dataSaver={dataSaver}
              channelAvatar={avatars[video.channelId]}
              onMore={onRemoveChannel ? () => setMenuVideo(video) : undefined}
            />
          ))}
        </View>
      );
    },
    [
      avatars,
      cardWidth,
      dataSaver,
      hasHistory,
      long,
      onOpen,
      onRemoveChannel,
      pendingIds,
      progressFor,
      seen,
      shorts,
      sidePadding,
      styles.gridRow,
      trackingVideos,
    ],
  );

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <AppBar
        searching={searching}
        query={query}
        onChangeQuery={setQuery}
        onToggleSearch={toggleSearch}
        onOpenProfile={onOpenProfile}
        syncLabel={syncLabel}
      />

      <SyncBar active={syncActive} percent={sync?.percent ?? 0} />

      <CategoryChips
        categories={categories}
        activeId={activeCategoryId}
        onSelect={onSelectCategory}
        onManage={onOpenCategories}
      />

      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        extraData={`${columns}-${cardWidth}-${shortsPosition}-${sidePadding}`}
        renderItem={renderItem}
        ListHeaderComponent={
          error ? (
            <View style={[styles.banner, { marginHorizontal: sidePadding + GUTTER }]}>
              <Text style={styles.bannerText}>
                {fromCache
                  ? t('home:offlineCacheMessage')
                  : t('home:partialFailureMessage')}
              </Text>
              <Pressable onPress={onRefresh} hitSlop={10} accessibilityRole="button">
                <Text style={styles.bannerAction}>{t('home:retry')}</Text>
              </Pressable>
            </View>
          ) : null
        }
        ListEmptyComponent={
          isFirstLoad ? (
            <FeedSkeleton
              columns={columns}
              cardWidth={cardWidth}
              rows={2}
              sidePadding={sidePadding}
            />
          ) : query.trim() ? (
            <EmptyState
              title={t('home:noResults')}
              message={t('home:noSearchMatch', { query: query.trim() })}
              actionLabel={t('common:clearSearch')}
              onAction={toggleSearch}
            />
          ) : (
            <EmptyState
              title={activeCategory ? t('home:emptyCategory') : t('home:nothingToShow')}
              message={
                activeCategory
                  ? t('home:emptyCategoryMessage')
                  : t('home:emptyFeedMessage')
              }
              actionLabel={
                activeCategory
                  ? t('home:editCategory')
                  : t('home:manageChannels')
              }
              onAction={activeCategory ? onOpenCategories : onOpenChannels}
            />
          )
        }
        ListFooterComponent={
          visibleVideos.length > 0 ? (
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                {t('home:video', { count: long.length })}
                {shorts.length > 0
                  ? ` · ${t('home:short', { count: shorts.length })}`
                  : ''}
                {' · '}
                {t('home:channel', { count: scopeChannelCount })}
                {failedChannels.length > 0
                  ? ` · ${t('home:failedChannels', { count: failedChannels.length })}`
                  : ''}
              </Text>
              <Text style={styles.footerText}>
                {savedAt
                  ? t('home:lastSynced', { time: timeAgo(savedAt) })
                  : t('home:neverSynced')}
                {fromCache ? ` · ${t('home:localCache')}` : ''}
              </Text>
              <Pressable
                onPress={onRefresh}
                accessibilityRole="button"
                style={({ pressed }) => [styles.footerButton, pressed && styles.footerButtonPressed]}
              >
                <Text style={styles.footerAction}>{t('home:refresh')}</Text>
              </Pressable>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + spacing.lg },
        ]}
        initialNumToRender={4}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
      />

      <ActionSheet
        visible={Boolean(menuVideo)}
        title={menuVideo?.title}
        message={menuVideo ? `${menuVideo.channelTitle} · ${timeAgo(menuVideo.publishedAt)}` : null}
        actions={
          menuVideo
            ? [
                ...(onRemoveChannel
                  ? [
                      {
                        key: 'remove-channel',
                        label: t('home:removeChannel'),
                        hint: t('home:removeChannelHint'),
                        destructive: true,
                        icon: <TrashIcon color={colors.danger} size={16} />,
                        onPress: () => {
                          setMenuChannel({
                            id: menuVideo.channelId,
                            title: menuVideo.channelTitle,
                          });
                          setMenuVideo(null);
                        },
                      },
                    ]
                  : []),
                ...(onDownload
                  ? [
                      {
                        key: 'download',
                        label: 'Télécharger pour hors ligne',
                        hint: 'Enregistrer si un flux direct est disponible.',
                        icon: <DownloadIcon color={colors.accentText} size={16} />,
                        onPress: () => {
                          const video = menuVideo;
                          setMenuVideo(null);
                          onDownload(video);
                        },
                      },
                    ]
                  : []),
              ]
            : []
        }
        onClose={() => setMenuVideo(null)}
      />

      <ConfirmSheet
        visible={Boolean(menuChannel)}
        title={t('home:removeChannelConfirm')}
        message={t('home:removeChannelHint')}
        confirmLabel={t('home:removeChannel')}
        destructive
        onConfirm={() => {
          const channel = menuChannel;
          setMenuChannel(null);
          if (channel?.id) onRemoveChannel(channel.id);
        }}
        onCancel={() => setMenuChannel(null)}
      />
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  listContent: {
    paddingTop: spacing.xs,
    flexGrow: 1,
  },
  gridRow: {
    flexDirection: 'row',
    gap: GAP,
    alignItems: 'flex-start',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  bannerText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 17,
  },
  bannerAction: {
    color: colors.accentText,
    fontSize: 12.5,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  footerText: {
    color: colors.textFaint,
    fontSize: 11.5,
  },
  footerButton: {
    marginTop: spacing.xs,
    height: 44,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  footerButtonPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  footerAction: {
    color: colors.accentText,
    fontSize: 13,
    fontWeight: '700',
  },
});
