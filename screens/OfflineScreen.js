import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ConfirmSheet from '../components/ConfirmSheet';
import EmptyState from '../components/EmptyState';
import {
  DownloadIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
} from '../components/Icons';
import ScreenHeader from '../components/ScreenHeader';
import { colors, radius, spacing } from '../constants/theme';
import { formatBytes } from '../services/localVideos';
import { thumbnailUri } from '../services/offline';
import { formatClock, timeAgo } from '../utils/format';

/**
 * Cache hors ligne : titres, chaînes et miniatures du flux.
 * La vidéo elle-même n'est pas enregistrée (lecteur YouTube officiel).
 */
export default function OfflineScreen({
  offline,
  downloads = [],
  localVideos = [],
  importing = false,
  downloading,
  progress,
  feedCount,
  onDownload,
  onClear,
  onOpen,
  onOpenDownload,
  onRemoveDownload,
  onImportLocal,
  onOpenLocal,
  onDeleteLocal,
}) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const videos = offline?.videos ?? [];
  const hasSnapshot = videos.length > 0;
  const channels = new Set(videos.map((video) => video.channelId)).size;
  const ratio = progress && progress.total > 0 ? progress.done / progress.total : 0;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Hors ligne"
          subtitle="Importe une vidéo de ton téléphone pour la lire sans réseau, ou garde les fiches de l’accueil en cache."
        />

        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Vidéos de l’appareil</Text>
          <View style={styles.sectionRule} />
          {localVideos.length > 0 ? (
            <Text style={styles.sectionCount}>{localVideos.length}</Text>
          ) : null}
        </View>

        <Pressable
          onPress={onImportLocal}
          disabled={importing}
          accessibilityRole="button"
          accessibilityLabel="Importer une vidéo de l’appareil"
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
            {importing ? 'Import en cours…' : 'Importer une vidéo'}
          </Text>
        </Pressable>

        {localVideos.length === 0 ? (
          <Text style={styles.emptyHint}>
            Choisis un fichier vidéo de ton téléphone : il sera lu sans réseau,
            même en mode avion.
          </Text>
        ) : (
          localVideos.map((video) => (
            <View key={video.id} style={styles.downloadRow}>
              <Pressable
                onPress={() => onOpenLocal(video)}
                accessibilityRole="button"
                accessibilityLabel={`Lire ${video.title}`}
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
                    {formatBytes(video.size)}
                    {video.duration > 0 ? ` · ${formatClock(video.duration)}` : ''} · hors ligne
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => setPendingDelete(video)}
                accessibilityRole="button"
                accessibilityLabel={`Supprimer ${video.title} de l’appareil`}
                hitSlop={6}
                style={({ pressed }) => [styles.remove, pressed && styles.rowPressed]}
              >
                <TrashIcon color={colors.textFaint} size={15} />
              </Pressable>
            </View>
          ))
        )}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Téléchargées</Text>
          <View style={styles.sectionRule} />
          {downloads.length > 0 ? (
            <Text style={styles.sectionCount}>{downloads.length}</Text>
          ) : null}
        </View>

        {downloads.length === 0 ? (
          <Text style={styles.emptyHint}>
            Aucune vidéo téléchargée. Sur l’accueil, touche « … » puis « Télécharger ».
          </Text>
        ) : (
          downloads.map((video) => (
            <View key={video.videoId} style={styles.downloadRow}>
              <Pressable
                onPress={() => onOpenDownload(video)}
                accessibilityRole="button"
                accessibilityLabel={`Ouvrir ${video.title}`}
                style={({ pressed }) => [styles.downloadMain, pressed && styles.rowPressed]}
              >
                <Image
                  source={{ uri: thumbnailUri(video.videoId) }}
                  style={styles.thumb}
                  resizeMode="cover"
                />
                <View style={styles.rowTexts}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {video.title}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {video.channelTitle} · {timeAgo(video.savedAt)}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => onRemoveDownload(video)}
                accessibilityRole="button"
                accessibilityLabel={`Supprimer le téléchargement de ${video.title}`}
                hitSlop={6}
                style={({ pressed }) => [styles.remove, pressed && styles.rowPressed]}
              >
                <TrashIcon color={colors.textFaint} size={15} />
              </Pressable>
            </View>
          ))
        )}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Tout l’accueil</Text>
          <View style={styles.sectionRule} />
        </View>

        <View style={styles.card}>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{videos.length}</Text>
              <Text style={styles.statLabel}>vidéos en cache</Text>
            </View>
            <View style={styles.statRule} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{channels}</Text>
              <Text style={styles.statLabel}>chaînes</Text>
            </View>
            <View style={styles.statRule} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{offline?.thumbs ?? 0}</Text>
              <Text style={styles.statLabel}>miniatures</Text>
            </View>
          </View>

          <Text style={styles.savedAt}>
            {hasSnapshot
              ? `Enregistré ${timeAgo(offline.savedAt)}`
              : 'Aucun enregistrement pour le moment'}
          </Text>

          {downloading ? (
            <View style={styles.progressBlock}>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {progress?.done ?? 0} / {progress?.total ?? 0} miniatures
                {progress?.failed ? ` · ${progress.failed} en échec` : ''}
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={onDownload}
              disabled={feedCount === 0}
              accessibilityRole="button"
              accessibilityLabel={hasSnapshot ? 'Mettre à jour le cache hors ligne' : 'Télécharger pour hors ligne'}
              accessibilityState={{ disabled: feedCount === 0 }}
              style={({ pressed }) => [
                styles.primary,
                feedCount === 0 && styles.primaryDisabled,
                pressed && feedCount > 0 && styles.primaryPressed,
              ]}
            >
              <DownloadIcon color={feedCount === 0 ? colors.textFaint : colors.onAccent} size={17} />
              <Text style={[styles.primaryText, feedCount === 0 && styles.primaryTextDisabled]}>
                {hasSnapshot ? 'Mettre à jour le cache' : 'Télécharger pour hors ligne'}
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
              <Text style={styles.clearText}>Vider le cache</Text>
            </Pressable>
          ) : null}

          {downloading ? (
            <View style={styles.downloadingRow}>
              <ActivityIndicator color={colors.accentText} size="small" />
              <Text style={styles.downloadingText}>Téléchargement en cours…</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.note}>
          <Text style={styles.noteText}>
            Les vidéos YouTube ne sont pas téléchargeables : le lecteur officiel l’interdit.
            Les fiches restent consultables hors ligne, et les vidéos importées de
            l’appareil se lisent vraiment sans connexion.
          </Text>
        </View>

        {hasSnapshot ? (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>En cache</Text>
              <View style={styles.sectionRule} />
            </View>

            {videos.map((video) => (
              <Pressable
                key={video.videoId}
                onPress={() => onOpen(video, videos)}
                accessibilityRole="button"
                accessibilityLabel={`${video.title} — ${video.channelTitle}`}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Image
                  source={{ uri: thumbnailUri(video.videoId) }}
                  style={styles.thumb}
                  resizeMode="cover"
                />
                <View style={styles.rowTexts}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {video.title}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {video.channelTitle} · {timeAgo(video.publishedAt)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        ) : feedCount === 0 ? (
          <EmptyState
            title="Rien hors ligne"
            message="Ajoute des chaînes pour pouvoir mettre ton accueil en cache."
          />
        ) : null}
      </ScrollView>

      <ConfirmSheet
        visible={Boolean(pendingDelete)}
        title="Supprimer cette vidéo ?"
        message={`« ${pendingDelete?.title ?? ''} » sera effacée de l’appareil pour libérer de l’espace.`}
        confirmLabel="Supprimer"
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
        title="Vider le cache hors ligne ?"
        message="Les titres et miniatures enregistrés seront supprimés. Ton accueil reste intact."
        confirmLabel="Vider le cache"
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
    height: 63,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
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
