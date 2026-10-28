import { useMemo } from 'react';
import {
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppBar from '../components/AppBar';
import CategoryChips from '../components/CategoryChips';
import EmptyState from '../components/EmptyState';
import FeedSkeleton from '../components/FeedSkeleton';
import VideoCard from '../components/VideoCard';
import { colors, spacing } from '../constants/theme';
import { withoutShorts } from '../services/filters';
import { formatDateShort, startOfDay, timeAgo } from '../utils/format';

const DAY = 24 * 60 * 60 * 1000;
const BUCKETS = [
  { key: 'today', title: "Aujourd'hui" },
  { key: 'yesterday', title: 'Hier' },
  { key: 'week', title: 'Cette semaine' },
  { key: 'older', title: 'Plus ancien' },
];

function buildSections(videos) {
  const today = startOfDay(Date.now());
  const groups = { today: [], yesterday: [], week: [], older: [] };

  for (const video of videos) {
    const published = video.publishedAt ?? 0;
    if (published >= today) groups.today.push(video);
    else if (published >= today - DAY) groups.yesterday.push(video);
    else if (published >= today - 6 * DAY) groups.week.push(video);
    else groups.older.push(video);
  }

  return BUCKETS.map((bucket) => ({ ...bucket, data: groups[bucket.key] })).filter(
    (section) => section.data.length > 0,
  );
}

export default function FeedScreen({
  videos,
  channels,
  categories,
  activeCategoryId,
  onSelectCategory,
  onOpenCategories,
  seenIds,
  loading,
  refreshing,
  error,
  fromCache,
  savedAt,
  failedChannels = [],
  hiddenShorts = 0,
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

  // Double filtre : les caches anciens peuvent encore contenir des Shorts.
  const cleanVideos = useMemo(() => withoutShorts(videos), [videos]);

  const visibleVideos = useMemo(() => {
    if (!scopeIds) return cleanVideos;
    return cleanVideos.filter((video) => scopeIds.has(video.channelId));
  }, [cleanVideos, scopeIds]);

  const sections = useMemo(() => buildSections(visibleVideos), [visibleVideos]);
  const seen = useMemo(() => new Set(seenIds), [seenIds]);
  const hasHistory = seenIds.length > 0;
  const scopeChannelCount = scopeIds ? scopeIds.size : channels.length;
  const isFirstLoad = loading && videos.length === 0;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <AppBar right={<Text style={styles.date}>{formatDateShort()}</Text>} />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.videoId}
        renderItem={({ item }) => (
          <VideoCard
            video={item}
            isNew={hasHistory && !seen.has(item.videoId)}
            onPress={() => onOpen(item, visibleVideos)}
          />
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.dayHeader}>
            <Text style={styles.dayText}>{section.title}</Text>
            <View style={styles.dayRule} />
          </View>
        )}
        ListHeaderComponent={
          <View>
            <View style={styles.titleBlock}>
              <Text style={styles.title} numberOfLines={2}>
                {activeCategory ? activeCategory.name : 'Tout le flux'}
              </Text>
              <Text style={styles.subtitle}>
                {visibleVideos.length} vidéo{visibleVideos.length > 1 ? 's' : ''} ·{' '}
                {scopeChannelCount} chaîne{scopeChannelCount > 1 ? 's' : ''}
                {failedChannels.length > 0 ? ` · ${failedChannels.length} en échec` : ''}
              </Text>
            </View>

            <CategoryChips
              categories={categories}
              activeId={activeCategoryId}
              onSelect={onSelectCategory}
              onManage={onOpenCategories}
            />

            {error ? (
              <View style={styles.banner}>
                <Text style={styles.bannerText}>
                  {fromCache
                    ? 'Hors ligne : le dernier flux enregistré est affiché.'
                    : 'Certaines chaînes n’ont pas répondu.'}
                </Text>
                <Pressable onPress={onRefresh} hitSlop={10} accessibilityRole="button">
                  <Text style={styles.bannerAction}>Réessayer</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isFirstLoad ? (
            <FeedSkeleton />
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
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        initialNumToRender={4}
        windowSize={7}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  date: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  titleBlock: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: 5,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1.1,
    lineHeight: 37,
  },
  subtitle: {
    color: colors.textFaint,
    fontSize: 13,
    fontWeight: '500',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.bg,
  },
  dayText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dayRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 14,
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
