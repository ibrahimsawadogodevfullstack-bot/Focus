import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import CategoryChips from '../components/CategoryChips';
import { FocusMark } from '../components/FocusMark';
import { SlidersIcon } from '../components/Icons';
import VideoCard from '../components/VideoCard';
import { colors, radius, spacing } from '../constants/theme';
import { timeAgo } from '../utils/format';

export default function FeedScreen({
  videos,
  channels,
  categories,
  activeCategoryId,
  onSelectCategory,
  onManage,
  seenIds,
  loading,
  refreshing,
  error,
  fromCache,
  savedAt,
  failedChannels = [],
  onRefresh,
  onOpen,
}) {
  const activeCategory = useMemo(
    () => categories.find((category) => category.id === activeCategoryId) ?? null,
    [categories, activeCategoryId],
  );

  const scopeIds = useMemo(
    () => (activeCategory ? new Set(activeCategory.channelIds) : null),
    [activeCategory],
  );

  const visibleVideos = useMemo(() => {
    if (!scopeIds) return videos;
    return videos.filter((video) => scopeIds.has(video.channelId));
  }, [videos, scopeIds]);

  const scopeChannelCount = scopeIds ? scopeIds.size : channels.length;
  const seen = useMemo(() => new Set(seenIds), [seenIds]);
  const hasHistory = seenIds.length > 0;

  if (loading && videos.length === 0) {
    return (
      <SafeAreaView style={styles.center}>
        <FocusMark size={44} />
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.loadingText}>Mise au point…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={visibleVideos}
        keyExtractor={(item) => item.videoId}
        renderItem={({ item }) => (
          <VideoCard
            video={item}
            isNew={hasHistory && !seen.has(item.videoId)}
            onPress={() => onOpen(item, visibleVideos)}
          />
        )}
        ListHeaderComponent={
          <View>
            <View style={styles.brandRow}>
              <View style={styles.brand}>
                <FocusMark size={20} />
                <Text style={styles.wordmark}>focus</Text>
              </View>

              <Pressable
                onPress={onManage}
                accessibilityRole="button"
                accessibilityLabel="Bibliothèque : chaînes et catégories"
                style={({ pressed }) => [
                  styles.libraryButton,
                  pressed && styles.libraryButtonPressed,
                ]}
              >
                <SlidersIcon color={colors.textMuted} size={17} />
              </Pressable>
            </View>

            <View style={styles.titleBlock}>
              <Text style={styles.kicker}>
                {activeCategory ? 'CATÉGORIE' : 'FLUX'}
              </Text>
              <Text style={styles.title} numberOfLines={2}>
                {activeCategory ? activeCategory.name : 'Toutes les chaînes'}
              </Text>
              <Text style={styles.subtitle}>
                {visibleVideos.length} vidéo{visibleVideos.length > 1 ? 's' : ''} ·{' '}
                {scopeChannelCount} chaîne{scopeChannelCount > 1 ? 's' : ''}
                {failedChannels.length > 0
                  ? ` · ${failedChannels.length} en échec`
                  : ''}
              </Text>
            </View>

            <CategoryChips
              categories={categories}
              activeId={activeCategoryId}
              onSelect={onSelectCategory}
              onManage={onManage}
            />

            {error ? (
              <View style={styles.banner}>
                <Text style={styles.bannerText}>
                  {fromCache
                    ? 'Hors ligne — dernier flux enregistré affiché.'
                    : 'Certaines chaînes n’ont pas répondu.'}
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <FocusMark size={36} style={styles.emptyMark} />
            <Text style={styles.emptyTitle}>Rien à mettre au point</Text>
            <Text style={styles.emptyText}>
              {activeCategory
                ? 'Aucune vidéo récente pour cette catégorie. Ajoute-lui des chaînes.'
                : 'Tire vers le bas pour recharger, ou ajoute des chaînes.'}
            </Text>
            <Pressable onPress={onManage} style={styles.emptyAction}>
              <Text style={styles.emptyActionText}>Gérer la bibliothèque</Text>
            </Pressable>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {savedAt
                ? `Synchronisé ${timeAgo(savedAt)}`
                : 'Jamais synchronisé'}
              {fromCache ? ' · cache local' : ''}
            </Text>
            <Pressable onPress={onRefresh} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.footerAction}>Actualiser</Text>
            </Pressable>
          </View>
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
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        windowSize={7}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  loadingText: {
    color: colors.textFaint,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  wordmark: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  libraryButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  libraryButtonPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  titleBlock: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: 4,
  },
  kicker: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 35,
  },
  subtitle: {
    color: colors.textFaint,
    fontSize: 12.5,
    fontWeight: '500',
    marginTop: 2,
  },
  banner: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  bannerText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    gap: spacing.sm,
  },
  emptyMark: {
    opacity: 0.5,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textFaint,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 260,
  },
  emptyAction: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  emptyActionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    gap: 4,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  footerText: {
    color: colors.textFaint,
    fontSize: 11,
  },
  footerAction: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
