import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import ConfirmSheet from '../src/shared/ui/ConfirmSheet';
import EmptyState from '../src/shared/ui/EmptyState';
import {
  DownloadIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
} from '../src/shared/ui/Icons';
import ScreenHeader from '../src/shared/ui/ScreenHeader';
import VideoThumbnail from '../src/shared/ui/media/VideoThumbnail';
import { colors, radius, spacing } from '../src/shared/theme/tokens';
import { FORMAT_SHORT, formatOf } from '../src/domain/videoFormat';
import { formatBytes } from '../services/localVideos';
import { formatClock, timeAgo } from '../src/shared/utils/format';

/** Vignette de liste : 16:9 pour une vidéo, 9:16 pour un Short. */
function OfflineThumb({ video, formats }) {
  const format = formatOf(video, formats);
  return (
    <VideoThumbnail
      videoId={video.videoId}
      thumbnail={video.thumbnail}
      format={format}
      radius={radius.sm}
      style={format === FORMAT_SHORT ? styles.shortThumb : styles.thumb}
    />
  );
}

function groupByCategory(videos, categories, uncategorizedName) {
  const known = new Map((categories ?? []).map((category) => [category.id, category.name]));
  const groups = new Map();

  for (const video of videos) {
    const assigned = Array.isArray(video.categories) && video.categories.length > 0
      ? video.categories.map((category) => ({ id: category.id, name: category.name }))
      : [{ id: 'uncategorized', name: uncategorizedName }];

    for (const category of assigned) {
      const name = known.get(category.id) ?? category.name;
      if (!groups.has(category.id)) groups.set(category.id, { id: category.id, name, videos: [] });
      groups.get(category.id).videos.push(video);
    }
  }

  return [...groups.values()].sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Bibliothèque hors ligne : fichiers locaux, téléchargements directs disponibles
 * et cache des fiches du flux.
 */
export default function OfflineScreen({
  offline,
  downloads = [],
  localVideos = [],
  importing = false,
  downloading,
  progress,
  formats = {},
  feedCount,
  onDownload,
  onClear,
  onOpen,
  onOpenDownload,
  onRemoveDownload,
  onImportLocal,
  onOpenLocal,
  onDeleteLocal,
  categories = [],
}) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const { t, i18n } = useTranslation(['offline', 'common']);
  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'fr';

  const videos = offline?.videos ?? [];
  const hasSnapshot = videos.length > 0;
  const channels = new Set(videos.map((video) => video.channelId)).size;
  const downloadGroups = groupByCategory(downloads, categories, t('offline:emptyGroup'));
  const ratio = progress && progress.total > 0 ? progress.done / progress.total : 0;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title={t('offline:title')}
          subtitle={t('offline:subtitle')}
        />

        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>{t('offline:deviceVideos')}</Text>
          <View style={styles.sectionRule} />
          {localVideos.length > 0 ? (
            <Text style={styles.sectionCount}>{localVideos.length}</Text>
          ) : null}
        </View>

        <Pressable
          onPress={onImportLocal}
          disabled={importing}
          accessibilityRole="button"
          accessibilityLabel={t('offline:deviceImport')}
          style={({ pressed }) => [
            styles.importButton,
            importing && styles.importButtonBusy,
            pressed && styles.rowPressed,
          ]}
        >
          {importing ? (
            <ActivityIndicator color={colors.accentText} size="small" />
          ) : (
            <PlusIcon color={colors.accentText} size={14} />
          )}
          <Text style={styles.importText}>
            {importing ? t('offline:importing') : t('offline:importVideo')}
          </Text>
        </Pressable>

        {localVideos.length === 0 ? (
          <Text style={styles.emptyHint}>
            {t('offline:deviceHint')}
          </Text>
        ) : (
          localVideos.map((video) => (
            <View key={video.id} style={styles.downloadRow}>
              <Pressable
                onPress={() => onOpenLocal(video)}
                accessibilityRole="button"
                accessibilityLabel={t('offline:readVideo', { title: video.title })}
                style={({ pressed }) => [styles.downloadMain, pressed && styles.rowPressed]}
              >
                <View style={styles.localThumb}>
                  <View style={styles.localPlay}>
                    <PlayIcon color={colors.accentText} size={15} />
                  </View>
                </View>
                <View style={styles.rowTexts}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {video.title}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {t('offline:deviceVideoMeta', {
                      size: `${formatBytes(video.size)}${video.duration > 0 ? ` · ${formatClock(video.duration)}` : ''}`,
                    })}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => setPendingDelete(video)}
                accessibilityRole="button"
                accessibilityLabel={t('offline:removeDevice', { title: video.title })}
                hitSlop={6}
                style={({ pressed }) => [styles.remove, pressed && styles.rowPressed]}
              >
                <TrashIcon color={colors.textFaint} size={15} />
              </Pressable>
            </View>
          ))
        )}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>{t('offline:downloads')}</Text>
          <View style={styles.sectionRule} />
          {downloads.length > 0 ? (
            <Text style={styles.sectionCount}>{downloads.length}</Text>
          ) : null}
        </View>

        {downloads.length === 0 ? (
          <Text style={styles.emptyHint}>
            {t('offline:downloadHint')}
          </Text>
        ) : (
          downloadGroups.map((group) => (
            <View key={group.id} style={styles.categoryBlock}>
              <Text style={styles.categoryTitle}>{group.name}</Text>
              {group.videos.map((video) => (
                <View key={`${group.id}-${video.videoId}`} style={styles.downloadRow}>
                  <Pressable
                    onPress={() => onOpenDownload(video)}
                    accessibilityRole="button"
                    accessibilityLabel={t('offline:openVideo', { title: video.title })}
                    style={({ pressed }) => [styles.downloadMain, pressed && styles.rowPressed]}
                  >
                    <OfflineThumb video={video} formats={formats} />
                    <View style={styles.rowTexts}>
                      <Text style={styles.rowTitle} numberOfLines={2}>
                        {video.title}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {video.channelTitle} · {timeAgo(video.savedAt, locale)}
                      </Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => onRemoveDownload(video)}
                    accessibilityRole="button"
                    accessibilityLabel={t('offline:removeDownload', { title: video.title })}
                    hitSlop={6}
                    style={({ pressed }) => [styles.remove, pressed && styles.rowPressed]}
                  >
                    <TrashIcon color={colors.textFaint} size={15} />
                  </Pressable>
                </View>
              ))}
            </View>
          ))
        )}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>{t('offline:cache')}</Text>
          <View style={styles.sectionRule} />
        </View>

        <View style={styles.card}>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{videos.length}</Text>
              <Text style={styles.statLabel}>{t('offline:videosCached')}</Text>
            </View>
            <View style={styles.statRule} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{channels}</Text>
              <Text style={styles.statLabel}>{t('offline:channels')}</Text>
            </View>
            <View style={styles.statRule} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{offline?.thumbs ?? 0}</Text>
              <Text style={styles.statLabel}>{t('offline:miniatures')}</Text>
            </View>
          </View>

          <Text style={styles.savedAt}>
            {hasSnapshot
              ? t('offline:savedAt', { time: timeAgo(offline.savedAt, locale) })
              : t('offline:neverSaved')}
          </Text>

          {downloading ? (
            <View style={styles.progressBlock}>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {t('offline:cacheProgress', {
                  done: progress?.done ?? 0,
                  total: progress?.total ?? 0,
                })}
                {progress?.failed ? t('offline:cacheFailed', { count: progress.failed }) : ''}
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={onDownload}
              disabled={feedCount === 0}
              accessibilityRole="button"
              accessibilityLabel={
                hasSnapshot ? t('offline:updateCache') : t('offline:downloadForOffline')
              }
              accessibilityState={{ disabled: feedCount === 0 }}
              style={({ pressed }) => [
                styles.primary,
                feedCount === 0 && styles.primaryDisabled,
                pressed && feedCount > 0 && styles.primaryPressed,
              ]}
            >
              <DownloadIcon color={feedCount === 0 ? colors.textFaint : colors.onAccent} size={17} />
              <Text style={[styles.primaryText, feedCount === 0 && styles.primaryTextDisabled]}>
                {hasSnapshot ? t('offline:updateCache') : t('offline:downloadForOffline')}
              </Text>
            </Pressable>
          )}

          {hasSnapshot && !downloading ? (
            <Pressable
              onPress={() => setConfirmClear(true)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.clear, pressed && styles.clearPressed]}
            >
              <TrashIcon color={colors.danger} size={14} />
              <Text style={styles.clearText}>{t('offline:clearCache')}</Text>
            </Pressable>
          ) : null}

          {downloading ? (
            <View style={styles.downloadingRow}>
              <ActivityIndicator color={colors.accentText} size="small" />
              <Text style={styles.downloadingText}>{t('offline:downloading')}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.note}>
          <Text style={styles.noteText}>{t('offline:note')}</Text>
        </View>

        {hasSnapshot ? (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>{t('offline:cache')}</Text>
              <View style={styles.sectionRule} />
            </View>

            {videos.map((video) => (
              <Pressable
                key={video.videoId}
                onPress={() => onOpen(video, videos)}
                accessibilityRole="button"
                accessibilityLabel={t('offline:openVideo', { title: video.title })}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <OfflineThumb video={video} formats={formats} />
                <View style={styles.rowTexts}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {video.title}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {video.channelTitle} · {timeAgo(video.publishedAt, locale)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        ) : feedCount === 0 ? (
          <EmptyState
            title={t('offline:nothingOffline')}
            message={t('offline:nothingOfflineMessage')}
          />
        ) : null}
      </ScrollView>

      <ConfirmSheet
        visible={Boolean(pendingDelete)}
        title={t('offline:deleteConfirmTitle')}
        message={t('offline:deleteConfirmMessage', { title: pendingDelete?.title ?? '' })}
        confirmLabel={t('offline:delete')}
        destructive
        onConfirm={() => {
          const video = pendingDelete;
          setPendingDelete(null);
          if (video) onDeleteLocal(video);
        }}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmSheet
        visible={confirmClear}
        title={t('offline:clearOfflineConfirmTitle')}
        message={t('offline:clearOfflineConfirmMessage')}
        confirmLabel={t('offline:clearOffline')}
        destructive
        onConfirm={() => {
          setConfirmClear(false);
          onClear();
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  card: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  statLabel: {
    color: colors.textFaint,
    fontSize: 10.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  statRule: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: colors.line,
  },
  savedAt: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  primary: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  primaryPressed: {
    opacity: 0.85,
  },
  primaryDisabled: {
    backgroundColor: colors.surfaceAlt,
  },
  primaryText: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '700',
  },
  primaryTextDisabled: {
    color: colors.textFaint,
  },
  clear: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  clearPressed: {
    opacity: 0.7,
  },
  clearText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  progressBlock: {
    gap: spacing.sm,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  progressText: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  downloadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  downloadingText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  note: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  noteText: {
    color: colors.textFaint,
    fontSize: 11.5,
    lineHeight: 17,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.sm,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
  },
  sectionCount: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: '700',
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentLine,
  },
  importButtonBusy: {
    opacity: 0.7,
  },
  importText: {
    color: colors.accentText,
    fontSize: 13.5,
    fontWeight: '700',
  },
  localThumb: {
    width: 112,
    height: 63,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  localPlay: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  emptyHint: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 18,
    paddingVertical: spacing.sm,
  },
  downloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  categoryBlock: {
    marginBottom: spacing.sm,
  },
  categoryTitle: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xs,
    color: colors.accentText,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  downloadMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  remove: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  thumb: {
    width: 112,
  },
  shortThumb: {
    height: 63,
  },
  rowTexts: {
    flex: 1,
    gap: 4,
    paddingTop: 2,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  rowMeta: {
    color: colors.textFaint,
    fontSize: 11.5,
    fontWeight: '500',
  },
});
