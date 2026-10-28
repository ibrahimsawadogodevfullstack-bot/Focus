import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ConfirmSheet from '../components/ConfirmSheet';
import EmptyState from '../components/EmptyState';
import { DownloadIcon, TrashIcon } from '../components/Icons';
import { colors, radius, spacing } from '../constants/theme';
import { thumbnailUri } from '../services/offline';
import { timeAgo } from '../utils/format';

/**
 * Cache hors ligne : titres, chaînes et miniatures du flux.
 * La vidéo elle-même n'est pas enregistrée (lecteur YouTube officiel).
 */
export default function OfflineScreen({
  offline,
  downloading,
  progress,
  feedCount,
  onDownload,
  onClear,
  onOpen,
}) {
  const [confirmClear, setConfirmClear] = useState(false);

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
        <Text style={styles.title}>Hors ligne</Text>
        <Text style={styles.subtitle}>
          Garde titres et miniatures de ton accueil en mémoire pour le consulter sans réseau.
        </Text>

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
            Les vidéos elles-mêmes ne sont pas enregistrées : le lecteur YouTube officiel
            l’interdit. La lecture demande une connexion ; la liste reste consultable.
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
        ) : (
          <EmptyState
            title="Rien hors ligne"
            message={
              feedCount > 0
                ? `Ton accueil contient ${feedCount} vidéos : lance le téléchargement pour les garder en cache.`
                : 'Ajoute des chaînes pour pouvoir mettre ton accueil en cache.'
            }
          />
        )}
      </ScrollView>

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
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
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
