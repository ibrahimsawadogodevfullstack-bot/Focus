import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ActionSheet from '../components/ActionSheet';
import AppBar from '../components/AppBar';
import CategoryChips from '../components/CategoryChips';
import ConfirmSheet from '../components/ConfirmSheet';
import EmptyState from '../components/EmptyState';
import FeedSkeleton from '../components/FeedSkeleton';
import SyncBar from '../components/SyncBar';
import VideoCard from '../components/VideoCard';
import { DownloadIcon, TrashIcon } from '../components/Icons';
import { colors, spacing } from '../constants/theme';
import { withoutShorts } from '../services/filters';
import { timeAgo } from '../utils/format';

const normalize = (value) =>
  (value || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export default function FeedScreen({
  videos,
  channels,
  categories,
  activeCategoryId,
  onSelectCategory,
  onOpenCategories,
  onOpenLibrary,
  seenIds,
  avatars = {},
  loading,
  refreshing,
  sync,
  error,
  fromCache,
  savedAt,
  failedChannels = [],
  hiddenShorts = 0,
  onRefresh,
  downloads = [],
  downloadProgress = {},
  onOpen,
  onToggleDownload,
  onRemoveChannel,
}) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [menuVideo, setMenuVideo] = useState(null);
  const [menuChannel, setMenuChannel] = useState(null);

  const menuDownloaded = Boolean(
    menuVideo && downloads.some((video) => video.videoId === menuVideo.videoId),
  );

  const activeCategory = useMemo(
    () => categories.find((category) => category.id === activeCategoryId) ?? null,
    [categories, activeCategoryId],
  );

  const scopeIds = useMemo(
    () => (activeCategory ? new Set(activeCategory.channelIds) : null),
    [activeCategory],
  );

  // Double filtre : les caches anciens peuvent encore contenir des Shorts.
  const cleanVideos = useMemo(() => withoutShorts(videos), [videos]);

  const scopedVideos = useMemo(() => {
    if (!scopeIds) return cleanVideos;
    return cleanVideos.filter((video) => scopeIds.has(video.channelId));
  }, [cleanVideos, scopeIds]);

  const visibleVideos = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return scopedVideos;
    return scopedVideos.filter(
      (video) =>
        normalize(video.title).includes(needle) ||
        normalize(video.channelTitle).includes(needle),
    );
  }, [query, scopedVideos]);

  const seen = useMemo(() => new Set(seenIds), [seenIds]);
  const hasHistory = seenIds.length > 0;
  const scopeChannelCount = scopeIds ? scopeIds.size : channels.length;
  const isFirstLoad = loading && videos.length === 0;

  const syncActive = Boolean(sync?.active);
  const syncLabel = syncActive
    ? `${sync.done ?? 0}/${sync.total ?? 0} · ${sync.percent ?? 0} %`
    : '';

  const toggleSearch = useCallback(() => {
    setSearching((current) => {
      if (current) setQuery('');
      return !current;
    });
  }, []);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <AppBar
        searching={searching}
        query={query}
        onChangeQuery={setQuery}
        onToggleSearch={toggleSearch}
        onOpenLibrary={onOpenLibrary}
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
        data={visibleVideos}
        keyExtractor={(item) => item.videoId}
        renderItem={({ item }) => (
          <VideoCard
            video={item}
            isNew={hasHistory && !seen.has(item.videoId)}
            onPress={() => onOpen(item, visibleVideos)}
            downloaded={downloads.some((video) => video.videoId === item.videoId)}
            downloadPercent={downloadProgress[item.videoId]}
            channelAvatar={avatars[item.channelId]}
            onMore={
              onRemoveChannel || onToggleDownload
                ? () => setMenuVideo(item)
                : undefined
            }
          />
        )}
        ListHeaderComponent={
          error ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>
                {fromCache
                  ? 'Hors ligne : la dernière liste enregistrée est affichée.'
                  : 'Certaines chaînes n’ont pas répondu.'}
              </Text>
              <Pressable onPress={onRefresh} hitSlop={10} accessibilityRole="button">
                <Text style={styles.bannerAction}>Réessayer</Text>
              </Pressable>
            </View>
          ) : null
        }
        ListEmptyComponent={
          isFirstLoad ? (
            <FeedSkeleton />
          ) : query.trim() ? (
            <EmptyState
              title="Aucun résultat"
              message={`Aucune vidéo ne correspond à « ${query.trim()} ».`}
              actionLabel="Effacer la recherche"
              onAction={toggleSearch}
            />
          ) : (
            <EmptyState
              title={activeCategory ? 'Catégorie vide' : 'Rien à afficher'}
              message={
                activeCategory
                  ? 'Aucune vidéo récente pour ces chaînes. Ajoute-en une à la catégorie.'
                  : 'Tire vers le bas pour actualiser, ou ajoute des chaînes à ta bibliothèque.'
              }
              actionLabel={activeCategory ? 'Modifier la catégorie' : 'Gérer mes chaînes'}
              onAction={onOpenCategories}
            />
          )
        }
        ListFooterComponent={
          visibleVideos.length > 0 ? (
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                {visibleVideos.length} vidéo{visibleVideos.length > 1 ? 's' : ''} ·{' '}
                {scopeChannelCount} chaîne{scopeChannelCount > 1 ? 's' : ''}
                {failedChannels.length > 0 ? ` · ${failedChannels.length} en échec` : ''}
              </Text>
              <Text style={styles.footerText}>
                {savedAt ? `Synchronisé ${timeAgo(savedAt)}` : 'Jamais synchronisé'}
                {fromCache ? ' · cache local' : ''}
                {hiddenShorts > 0 ? ` · ${hiddenShorts} Shorts masqués` : ''}
              </Text>
              <Pressable
                onPress={onRefresh}
                accessibilityRole="button"
                style={({ pressed }) => [styles.footerButton, pressed && styles.footerButtonPressed]}
              >
                <Text style={styles.footerAction}>Actualiser</Text>
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
        contentContainerStyle={styles.listContent}
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
                {
                  key: 'download',
                  label: menuDownloaded ? 'Supprimer le téléchargement' : 'Télécharger',
                  hint: menuDownloaded
                    ? 'Retire la fiche de l’onglet Hors ligne'
                    : 'Garde la fiche et la miniature pour le hors ligne',
                  icon: <DownloadIcon color={colors.textMuted} size={17} />,
                  onPress: () => {
                    const video = menuVideo;
                    setMenuVideo(null);
                    onToggleDownload?.(video);
                  },
                },
                ...(onRemoveChannel
                  ? [
                      {
                        key: 'remove-channel',
                        label: 'Retirer la chaîne',
                        hint: 'Elle quittera ta bibliothèque et tes catégories',
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
              ]
            : []
        }
        onClose={() => setMenuVideo(null)}
      />

      <ConfirmSheet
        visible={Boolean(menuChannel)}
        title="Retirer cette chaîne ?"
        message={`« ${menuChannel?.title ?? ''} » quittera ta bibliothèque, ton accueil et tes catégories.`}
        confirmLabel="Retirer la chaîne"
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  listContent: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginHorizontal: spacing.md,
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
