import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import ActionSheet from '../components/ActionSheet';
import AppBar from '../components/AppBar';
import CategoryChips from '../components/CategoryChips';
import ConfirmSheet from '../src/shared/ui/ConfirmSheet';
import DownloadProgressRow from '../components/DownloadProgressRow';
import DownloadRow, { DOWNLOAD_ROW_HEIGHT } from '../components/DownloadRow';
import EmptyState from '../src/shared/ui/EmptyState';
import FeedFilters from '../components/FeedFilters';
import FeedSkeleton from '../components/FeedSkeleton';
import ShortsShelf, { shortsShelfHeight } from '../components/ShortsShelf';
import ScreenHeader from '../src/shared/ui/ScreenHeader';
import SyncBar from '../components/SyncBar';
import VideoCard, { videoCardHeight } from '../components/VideoCard';
import {
  CheckIcon,
  CloseIcon,
  DownloadIcon,
  SearchIcon,
  TrashIcon,
} from '../src/shared/ui/Icons';
import { colors, fontSize, icon, layout, radius, spacing } from '../src/shared/theme/tokens';
import { isFormatResolved, resolveFormats, splitByFormat } from '../src/domain/videoFormat';
import { hasFailedFormat } from '../services/formats';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';
import { timeAgo } from '../src/shared/utils/format';
import { useDownloads } from '../hooks/useDownloads';
import * as DM from '../services/downloadManager';
import { formatBytes } from '../services/localVideos';
import { toDownloadedFeedVideos } from '../services/downloadFeed';

const GUTTER = layout.gridGutter; // 16 px
const GAP = layout.gridGap; // 16 px

/** La rangée Shorts arrive après ce nombre de vidéos longues. */
export const SHORTS_SHELF_POSITION = 2;

const SORT_OPTIONS = [
  { key: 'recent', labelKey: 'sortRecent' },
  { key: 'views', labelKey: 'sortViews' },
  { key: 'channel', labelKey: 'sortChannel' },
];

const normalize = (value) =>
  (value || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Timestamp comparable quel que soit le format renvoyé par le flux. */
function timeValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Colonnes de la grille selon la largeur de l'écran. */
function columnsFor(width) {
  if (width < layout.twoColumnMinWidth) return 1;
  if (width < layout.threeColumnMinWidth) return 2;
  return 3;
}

export default function FeedScreen({
  source = 'remote',
  videos = [],
  formats = {},
  channels = [],
  categories = [],
  activeCategoryId = null,
  onSelectCategory = () => {},
  onOpenCategories,
  onCreateCategory,
  onOpenChannels,
  onOpenProfile,
  seenIds = [],
  avatars = {},
  loading = false,
  refreshing = false,
  sync,
  error,
  fromCache = false,
  savedAt,
  failedChannels = [],
  onRefresh,
  trackingVideos = {},
  onOpen = () => {},
  onDownload,
  onRemoveChannel,
  showCategoryChips = true,
  headerTitle,
  onBack,
  shortsPosition = 'after-first-row',
  dataSaver = false,
}) {
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const { colors } = useTheme();
  const styles = useThemeStyles(baseStyles);
  const { t, i18n } = useTranslation(['home', 'common', 'downloads', 'offline']);
  const downloadRecords = useDownloads();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'fr';
  const isOffline = source === 'downloaded';

  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [menuVideo, setMenuVideo] = useState(null);
  const [menuChannel, setMenuChannel] = useState(null);
  const [downloadToRemove, setDownloadToRemove] = useState(null);
  const [unseenOnly, setUnseenOnly] = useState(false);
  const [hideShorts, setHideShorts] = useState(false);
  const [sort, setSort] = useState('recent');
  const [sortOpen, setSortOpen] = useState(false);

  const columns = columnsFor(windowWidth);

  // Mobile-first : le portrait reste plein largeur. Le centrage n’est appliqué
  // que sur les grands écrans où le contenu n’a plus besoin d’occuper toute
  // la largeur de la feuille.
  const isCompactPhone = windowWidth < layout.twoColumnMinWidth;
  const contentWidth = isCompactPhone ? windowWidth : Math.min(windowWidth, layout.maxContentWidth);
  const sidePadding = isCompactPhone ? 0 : Math.max(0, (windowWidth - contentWidth) / 2);
  const rowPadding = isCompactPhone ? 0 : sidePadding + GUTTER;
  const cardWidth = Math.max(
    0,
    (contentWidth - 2 * rowPadding - (columns - 1) * GAP) / columns,
  );

  const activeCategory = useMemo(
    () => categories.find((category) => category.id === activeCategoryId) ?? null,
    [categories, activeCategoryId],
  );

  const visibleSourceVideos = useMemo(
    () => source === 'downloaded'
      ? toDownloadedFeedVideos(downloadRecords, activeCategoryId)
      : videos,
    [source, downloadRecords, activeCategoryId, videos],
  );

  const visibleDownloadTasks = useMemo(
    () => source === 'downloaded'
      ? downloadRecords.filter((download) =>
          (activeCategoryId == null || download.categoryId === activeCategoryId) &&
          ['queued', 'downloading', 'failed'].includes(download.status),
        )
      : [],
    [source, downloadRecords, activeCategoryId],
  );

  const offlineSummary = useMemo(() => {
    if (!isOffline) return null;
    const list = downloadRecords.filter(
      (download) =>
        download.status === 'completed' &&
        Boolean(download.filePath) &&
        (activeCategoryId == null || download.categoryId === activeCategoryId),
    );
    return {
      count: list.length,
      size: list.reduce((sum, download) => sum + (download.sizeBytes || 0), 0),
    };
  }, [activeCategoryId, downloadRecords, isOffline]);

  const offlineSubtitle = offlineSummary && offlineSummary.count > 0
    ? [
        t('home:video', { count: offlineSummary.count }),
        offlineSummary.size > 0 ? formatBytes(offlineSummary.size) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  const downloadByVideo = useMemo(() => {
    const records = new Map();
    for (const download of downloadRecords) {
      if (source === 'downloaded') {
        records.set(download.id, download);
      } else if (activeCategoryId && download.categoryId === activeCategoryId) {
        records.set(download.videoId, download);
      }
    }
    return records;
  }, [downloadRecords, source, activeCategoryId]);

  const scopeIds = useMemo(
    () => (activeCategory ? new Set(activeCategory.channelIds) : null),
    [activeCategory],
  );

  const scopedVideos = useMemo(() => {
    if (source === 'downloaded' || !scopeIds) return visibleSourceVideos;
    return visibleSourceVideos.filter((video) => scopeIds.has(video.channelId));
  }, [source, visibleSourceVideos, scopeIds]);

  // Format effectif appliqué une fois : la grille, la rangée Shorts et le
  // lecteur lisent ensuite le même champ `format`.
  const formattedVideos = useMemo(
    () => resolveFormats(scopedVideos, formats),
    [scopedVideos, formats],
  );

  const seen = useMemo(() => new Set(seenIds), [seenIds]);
  const hasHistory = seenIds.length > 0;
  // Les filtres éditoriaux ne concernent que le flux distant ; la liste des
  // téléchargements garde son ordre de bibliothèque.
  const filtersApply = source === 'remote';

  const searchedVideos = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return formattedVideos;
    return formattedVideos.filter(
      (video) =>
        normalize(video.title).includes(needle) ||
        normalize(video.channelTitle).includes(needle),
    );
  }, [query, formattedVideos]);

  const visibleVideos = useMemo(() => {
    let list = searchedVideos;

    if (filtersApply && unseenOnly && hasHistory) {
      list = list.filter((video) => !seen.has(video.videoId));
    }
    if (!filtersApply) return list;

    const sorted = [...list];
    if (sort === 'views') {
      sorted.sort(
        (a, b) =>
          (Number(b.viewCount) || 0) - (Number(a.viewCount) || 0) ||
          timeValue(b.publishedAt) - timeValue(a.publishedAt),
      );
    } else if (sort === 'channel') {
      sorted.sort(
        (a, b) =>
          normalize(a.channelTitle).localeCompare(normalize(b.channelTitle)) ||
          timeValue(b.publishedAt) - timeValue(a.publishedAt),
      );
    } else {
      sorted.sort((a, b) => timeValue(b.publishedAt) - timeValue(a.publishedAt));
    }
    return sorted;
  }, [filtersApply, hasHistory, searchedVideos, seen, sort, unseenOnly]);

  // Les deux flux ne se mélangent jamais : les Shorts vont dans leur rangée,
  // les vidéos longues dans la grille.
  const { shorts: detectedShorts, long } = useMemo(
    () => splitByFormat(visibleVideos),
    [visibleVideos],
  );
  const shorts = useMemo(
    () => (filtersApply && hideShorts ? [] : detectedShorts),
    [detectedShorts, filtersApply, hideShorts],
  );

  const unseenCount = useMemo(() => {
    if (!hasHistory) return 0;
    return formattedVideos.reduce(
      (count, video) => count + (seen.has(video.videoId) ? 0 : 1),
      0,
    );
  }, [formattedVideos, hasHistory, seen]);

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
    if (isOffline) {
      return long.map((video, index) => ({
        type: 'downloadVideo',
        key: `download-video-${video.downloadId || video.videoId || index}`,
        video,
      }));
    }

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
  }, [columns, isOffline, long, shorts.length, shortsPosition]);

  const listRows = useMemo(
    () => [
      ...visibleDownloadTasks.map((download) => ({
        type: 'download',
        key: `download-${download.id}`,
        download,
      })),
      ...rows,
    ],
    [rows, visibleDownloadTasks],
  );

  // `FlatList` a besoin des positions des lignes pour virtualiser proprement.
  // Sans elles, la zone défilante se construit au fil des mesures et la barre
  // de défilement saute ; les cellules déjà rendues restent alors la seule
  // partie du flux réellement atteignable.
  const rowHeight = videoCardHeight(cardWidth);
  const shortsRowHeight = shortsShelfHeight(fontScale);
  const rowOffsets = useMemo(() => {
    let offset = 0;
    return listRows.map((row, index) => {
      const length = row.type === 'shorts'
        ? shortsRowHeight
        : row.type === 'download'
          ? 94
          : row.type === 'downloadVideo'
            ? DOWNLOAD_ROW_HEIGHT
            : rowHeight;
      const frame = { index, length, offset };
      offset += length;
      return frame;
    });
  }, [listRows, rowHeight, shortsRowHeight]);

  const getItemLayout = useCallback(
    (_data, index) =>
      rowOffsets[index] ?? { index, length: rowHeight, offset: rowHeight * index },
    [rowOffsets, rowHeight],
  );

  const scopeChannelCount = scopeIds ? scopeIds.size : channels.length;
  const isFirstLoad = source === 'remote' && loading && videos.length === 0;

  const syncActive = Boolean(sync?.active);
  const syncLabel = syncActive
    ? `${sync.done ?? 0}/${sync.total ?? 0} · ${sync.percent ?? 0} %`
    : '';

  const sortLabel = t(
    `home:${SORT_OPTIONS.find((option) => option.key === sort)?.labelKey ?? 'sortRecent'}`,
  );
  const resetFilters = useCallback(() => {
    setUnseenOnly(false);
    setHideShorts(false);
    setSort('recent');
  }, []);

  // Une carte ouvre le même menu que le bouton « ⋮ » : appui long inclus.
  const canOpenMenu = Boolean(onRemoveChannel || onDownload || source === 'downloaded');

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
      if (item.type === 'download') {
        return (
          <DownloadProgressRow
            download={item.download}
            onCancel={() => DM.cancelDownload(item.download.id)}
            onRetry={() => DM.retryDownload(item.download.id)}
          />
        );
      }

      if (item.type === 'downloadVideo') {
        const record = downloadByVideo.get(item.video.downloadId);
        return (
          <View style={[styles.downloadRowWrap, { paddingHorizontal: sidePadding + GUTTER }]}>
            <DownloadRow
              video={item.video}
              sizeBytes={record?.sizeBytes}
              onPress={() => onOpen(item.video, long)}
              onMore={canOpenMenu ? () => setMenuVideo(item.video) : undefined}
              onLongPress={canOpenMenu ? () => setMenuVideo(item.video) : undefined}
            />
          </View>
        );
      }

      if (item.type === 'shorts') {
        return (
          <ShortsShelf
            videos={shorts}
            seen={seen}
            hasHistory={hasHistory}
            sidePadding={sidePadding}
            dataSaver={dataSaver}
            onOpen={onOpen}
            onMore={canOpenMenu ? setMenuVideo : undefined}
            onLongPress={canOpenMenu ? setMenuVideo : undefined}
          />
        );
      }

      return (
        <View style={[styles.gridRow, { paddingHorizontal: rowPadding }]}>
          {item.videos.map((video) => (
            (() => {
              const record = downloadByVideo.get(
                source === 'downloaded' ? video.downloadId : video.videoId,
              );
              const isDownloading = record?.status === 'queued' || record?.status === 'downloading';
              return (
                <VideoCard
                  key={video.feedItemId || video.downloadId || video.videoId}
                  width={cardWidth}
                  video={video}
                  pending={pendingIds.has(video.videoId)}
                  progress={isDownloading ? record.progress : source === 'downloaded' ? 0 : progressFor(video)}
                  duration={video.duration ?? trackingVideos?.[video.videoId]?.duration}
                  isNew={source === 'remote' && hasHistory && !seen.has(video.videoId)}
                  onPress={() => onOpen(video, long)}
                  dataSaver={dataSaver}
                  channelAvatar={avatars[video.channelId]}
                  onMore={canOpenMenu ? () => setMenuVideo(video) : undefined}
                  onLongPress={canOpenMenu ? () => setMenuVideo(video) : undefined}
                />
              );
            })()
          ))}
        </View>
      );
    },
    [
      avatars,
      canOpenMenu,
      cardWidth,
      dataSaver,
      hasHistory,
      long,
      onOpen,
      pendingIds,
      progressFor,
      seen,
      shorts,
      sidePadding,
      rowPadding,
      styles.downloadRowWrap,
      styles.gridRow,
      trackingVideos,
      downloadByVideo,
      source,
    ],
  );

  const menuDownload = menuVideo
    ? downloadByVideo.get(source === 'downloaded' ? menuVideo.downloadId : menuVideo.videoId)
    : null;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      {headerTitle ? (
        <ScreenHeader
          title={headerTitle}
          onBack={onBack}
          right={
            isOffline ? (
              <Pressable
                onPress={toggleSearch}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={searching ? t('home:closeSearch') : t('home:searchAccessibility')}
                style={({ pressed }) => [styles.headerAction, pressed && styles.headerActionPressed]}
              >
                {searching ? (
                  <CloseIcon color={colors.text} size={icon.xs} />
                ) : (
                  <SearchIcon color={colors.text} size={icon.md} />
                )}
              </Pressable>
            ) : null
          }
        />
      ) : (
        <AppBar
          searching={searching}
          query={query}
          onChangeQuery={setQuery}
          onToggleSearch={toggleSearch}
          onOpenProfile={onOpenProfile}
          syncLabel={source === 'remote' ? syncLabel : ''}
          offline={source === 'remote' && fromCache}
        />
      )}

      {headerTitle && searching ? (
        <View style={[styles.searchBar, { marginHorizontal: sidePadding + GUTTER }]}>
          <SearchIcon color={colors.textFaint} size={icon.sm} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('home:searchPlaceholder')}
            placeholderTextColor={colors.textFaint}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t('home:searchAccessibility')}
            style={styles.searchInput}
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('common:clearSearch')}
              style={({ pressed }) => [styles.searchClear, pressed && styles.pressedSoft]}
            >
              <CloseIcon color={colors.textMuted} size={icon.xs} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {source === 'remote' ? <SyncBar active={syncActive} percent={sync?.percent ?? 0} /> : null}

      {showCategoryChips ? (
        <CategoryChips
          categories={categories}
          activeId={activeCategoryId}
          onSelect={onSelectCategory}
          onCreate={source === 'remote' ? onCreateCategory : undefined}
        />
      ) : null}

      {source === 'remote' ? (
        <FeedFilters
          unseenOnly={unseenOnly}
          unseenCount={unseenCount}
          hasHistory={hasHistory}
          onToggleUnseen={() => setUnseenOnly((value) => !value)}
          hideShorts={hideShorts}
          shortsCount={detectedShorts.length}
          onToggleShorts={() => setHideShorts((value) => !value)}
          sort={sort}
          sortLabel={sortLabel}
          onOpenSort={() => setSortOpen(true)}
          onReset={resetFilters}
        />
      ) : null}

      <FlatList
        style={styles.list}
        data={listRows}
        keyExtractor={(item) => item.key}
        getItemLayout={getItemLayout}
        extraData={`${columns}-${cardWidth}-${shortsPosition}-${rowPadding}`}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            {isOffline && offlineSubtitle ? (
              <Text
                style={[
                  styles.listMeta,
                  { paddingHorizontal: sidePadding + GUTTER },
                ]}
              >
                {offlineSubtitle}
              </Text>
            ) : null}
            {error ? (
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
            ) : null}
          </>
        }
        ListEmptyComponent={
          visibleDownloadTasks.length > 0 ? null : isFirstLoad ? (
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
          ) : filtersApply && (unseenOnly || hideShorts) ? (
            <EmptyState
              title={t('home:filterEmptyTitle')}
              message={t('home:filterEmptyMessage')}
              actionLabel={t('home:filterReset')}
              onAction={resetFilters}
            />
          ) : (
            source === 'downloaded' ? (
              <EmptyState
                title={t('downloads:emptyTitle')}
                message={activeCategory
                  ? t('downloads:emptyCategoryMessage')
                  : t('downloads:emptyMessage')}
                actionLabel={t('downloads:goToCategories')}
                onAction={onOpenCategories}
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
          )
        }
        ListFooterComponent={
          source === 'remote' && visibleVideos.length > 0 ? (
            <View style={[styles.footer, { paddingHorizontal: sidePadding + GUTTER }]}>
              {loading ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : null}
              <Text style={styles.footerText} numberOfLines={1}>
                {t('home:video', { count: long.length })}
                {shorts.length > 0
                  ? ` · ${t('home:short', { count: shorts.length })}`
                  : ''}
                {' · '}
                {t('home:channel', { count: scopeChannelCount })}
                {failedChannels.length > 0
                  ? ` · ${t('home:failedChannels', { count: failedChannels.length })}`
                  : ''}
                {' · '}
                {savedAt ? timeAgo(savedAt, locale) : t('home:neverSynced')}
              </Text>
              <Pressable
                onPress={onRefresh}
                accessibilityRole="button"
                accessibilityLabel={t('home:refresh')}
                hitSlop={8}
                style={({ pressed }) => [styles.footerButton, pressed && styles.footerButtonPressed]}
              >
                <Text style={styles.footerAction}>{t('home:refresh')}</Text>
              </Pressable>
            </View>
          ) : null
        }
        refreshControl={
          source === 'remote' ? <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          /> : undefined
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
      />

      <ActionSheet
        visible={Boolean(menuVideo)}
        title={menuVideo?.title}
        message={menuVideo ? `${menuVideo.channelTitle} · ${timeAgo(menuVideo.publishedAt, locale)}` : null}
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
                ...(source === 'downloaded'
                  ? [{
                      key: 'remove-download',
                      label: t('offline:delete'),
                      hint: t('offline:deleteConfirmMessage', { title: menuVideo.title }),
                      destructive: true,
                      icon: <TrashIcon color={colors.danger} size={16} />,
                      onPress: () => {
                        setDownloadToRemove(menuDownload);
                        setMenuVideo(null);
                      },
                    }]
                  : onDownload
                    ? [menuDownload?.status === 'completed'
                      ? {
                          key: 'downloaded',
                          label: t('downloads:downloaded'),
                          hint: t('downloads:alreadyDownloaded'),
                          icon: <CheckIcon color={colors.accentText} size={16} />,
                          onPress: () => setMenuVideo(null),
                        }
                      : menuDownload?.status === 'queued' || menuDownload?.status === 'downloading'
                        ? {
                            key: 'cancel-download',
                            label: t('downloads:cancelDownload'),
                            hint: t('downloads:downloadInProgress'),
                            destructive: true,
                            onPress: () => {
                              void DM.cancelDownload(menuDownload.id);
                              setMenuVideo(null);
                            },
                          }
                        : menuDownload?.status === 'failed'
                          ? {
                              key: 'retry-download',
                              label: t('common:retry'),
                              hint: t('downloads:downloadFailed'),
                              icon: <DownloadIcon color={colors.accentText} size={16} />,
                              onPress: () => {
                                void DM.retryDownload(menuDownload.id);
                                setMenuVideo(null);
                              },
                            }
                          : {
                              key: 'download',
                              label: t('home:downloadForOffline'),
                              hint: t('home:downloadHint'),
                              icon: <DownloadIcon color={colors.accentText} size={16} />,
                              onPress: () => {
                                const video = menuVideo;
                                setMenuVideo(null);
                                onDownload(video, activeCategoryId);
                              },
                            }]
                    : []),
              ]
            : []
        }
        onClose={() => setMenuVideo(null)}
      />

      <ActionSheet
        visible={sortOpen}
        title={t('home:sortTitle')}
        message={sortLabel}
        actions={SORT_OPTIONS.map((option) => ({
          key: option.key,
          label: t(`home:${option.labelKey}`),
          icon:
            sort === option.key ? (
              <CheckIcon color={colors.accentText} size={14} />
            ) : undefined,
          onPress: () => {
            setSort(option.key);
            setSortOpen(false);
          },
        }))}
        onClose={() => setSortOpen(false)}
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

      <ConfirmSheet
        visible={Boolean(downloadToRemove)}
        title={t('offline:deleteConfirmTitle')}
        message={t('offline:deleteConfirmMessage', { title: downloadToRemove?.title ?? '' })}
        confirmLabel={t('offline:delete')}
        destructive
        onConfirm={() => {
          const download = downloadToRemove;
          setDownloadToRemove(null);
          if (download) void DM.removeDownload(download.id);
        }}
        onCancel={() => setDownloadToRemove(null)}
      />
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: spacing.xs,
    flexGrow: 1,
  },
  listMeta: {
    paddingTop: 2,
    paddingBottom: spacing.sm,
    color: colors.textMuted,
    fontSize: fontSize.meta,
    fontWeight: '600',
  },
  gridRow: {
    flexDirection: 'row',
    gap: GAP,
    alignItems: 'flex-start',
  },
  downloadRowWrap: {
    width: '100%',
    maxWidth: 720 + GUTTER * 2,
    alignSelf: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  bannerText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: fontSize.meta,
    lineHeight: 17,
  },
  bannerAction: {
    color: colors.accentText,
    fontSize: fontSize.meta,
    fontWeight: '700',
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  searchInput: {
    flex: 1,
    padding: 0,
    color: colors.text,
    fontSize: fontSize.body,
  },
  searchClear: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  pressedSoft: {
    opacity: 0.6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  footerText: {
    flex: 1,
    color: colors.textFaint,
    fontSize: fontSize.caption,
  },
  footerButton: {
    height: 32,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  footerButtonPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  footerAction: {
    color: colors.accentText,
    fontSize: fontSize.label,
    fontWeight: '700',
  },
});
