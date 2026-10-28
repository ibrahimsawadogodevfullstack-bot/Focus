import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import ChannelChips from '../components/ChannelChips';
import VideoRow from '../components/VideoRow';
import { colors, spacing } from '../constants/theme';
import { timeAgo } from '../utils/format';

export default function FeedScreen({
  videos,
  channels,
  seenIds,
  loading,
  refreshing,
  error,
  fromCache,
  savedAt,
  onRefresh,
  onOpen,
}) {
  const [activeChannelId, setActiveChannelId] = useState(null);

  const filters = useMemo(() => {
    const titled = channels.filter((channel) => channel.title);
    return titled.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
  }, [channels]);

  const visibleVideos = useMemo(() => {
    if (!activeChannelId) return videos;
    return videos.filter((video) => video.channelId === activeChannelId);
  }, [videos, activeChannelId]);

  const seen = useMemo(() => new Set(seenIds), [seenIds]);
  // Premier lancement : tout marquer comme nouveau serait du bruit visuel.
  const hasHistory = seenIds.length > 0;

  if (loading && videos.length === 0) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingText}>Chargement des chaînes…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={visibleVideos}
        keyExtractor={(item) => item.videoId}
        renderItem={({ item }) => (
          <VideoRow
            video={item}
            isNew={hasHistory && !seen.has(item.videoId)}
            onPress={() => onOpen(item, visibleVideos)}
          />
        )}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Text style={styles.kicker}>MODE FOCUS</Text>
              <Text style={styles.heroTitle}>Ton flux, sans distraction</Text>
              <Text style={styles.heroSubtitle}>
                {videos.length} vidéos · {filters.length} chaînes · lecture intégrée
              </Text>
            </View>

            <ChannelChips
              channels={filters}
              activeChannelId={activeChannelId}
              onSelect={setActiveChannelId}
            />

            {error ? (
              <View style={styles.banner}>
                <Text style={styles.bannerText}>
                  {fromCache
                    ? 'Hors ligne : dernier flux enregistré affiché.'
                    : 'Certaines chaînes n’ont pas répondu.'}
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Aucune vidéo</Text>
            <Text style={styles.emptyText}>
              {activeChannelId
                ? 'Cette chaîne n’a rien publié récemment.'
                : 'Tire vers le bas pour recharger le flux.'}
            </Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {savedAt
                ? `Dernière synchronisation ${timeAgo(savedAt)}`
                : 'Jamais synchronisé'}
              {fromCache ? ' · cache local' : ''}
            </Text>
            <Pressable onPress={onRefresh} accessibilityRole="button">
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
        initialNumToRender={8}
        windowSize={9}
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
    color: colors.textMuted,
    fontSize: 14,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'android' ? spacing.lg : spacing.sm,
    paddingBottom: spacing.md,
    gap: 4,
  },
  kicker: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
  },
  banner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: spacing.md,
  },
  bannerText: {
    color: colors.text,
    fontSize: 12,
  },
  empty: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.xs,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    gap: 6,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  footerText: {
    color: colors.textFaint,
    fontSize: 11,
  },
  footerAction: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
});
