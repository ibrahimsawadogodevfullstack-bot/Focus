import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../constants/theme';
import ChannelAvatar from './ChannelAvatar';
import { timeAgo } from '../utils/format';
import { DownloadIcon, MoreIcon } from './Icons';

const THUMB_STEPS = ['maxresdefault', 'sddefault', 'hqdefault'];

/** Hauteur du bloc texte : 2 lignes de titre + 1 ligne secondaire. */
const TITLE_HEIGHT = 40;
const META_HEIGHT = 17;

/**
 * Carte vidéo longue (16:9) : miniature, puis avatar + titre + chaîne.
 *
 * Deux règles qui garantissent une grille alignée :
 *   - la carte ne porte aucun padding horizontal (c'est la grille qui l'impose) ;
 *   - le bloc texte a une hauteur minimale, donc un titre d'une ligne donne la
 *     même hauteur de carte qu'un titre de deux lignes.
 */
export default function VideoCard({
  video,
  isNew,
  downloaded,
  saving,
  channelAvatar,
  onPress,
  onMore,
  width,
}) {
  const [thumbStep, setThumbStep] = useState(0);
  const [failed, setFailed] = useState(false);

  // La miniature du flux d'abord, puis les tailles connues de YouTube : la
  // dernière qui répond est conservée, et un échec total affiche un placeholder
  // au bon ratio (jamais un trou noir, jamais une image étirée).
  const sources = useMemo(() => {
    const list = [];
    if (video.thumbnail) list.push(video.thumbnail);
    for (const step of THUMB_STEPS) {
      list.push(`https://i.ytimg.com/vi/${video.videoId}/${step}.jpg`);
    }
    return list;
  }, [video.thumbnail, video.videoId]);

  const label = `${video.title} — ${video.channelTitle}, ${timeAgo(video.publishedAt)}${
    saving ? ', enregistrement hors ligne en cours' : ''
  }`;

  const handleThumbError = () => {
    if (thumbStep < sources.length - 1) setThumbStep((step) => step + 1);
    else setFailed(true);
  };

  const initial = (video.channelTitle || '?').trim().charAt(0).toUpperCase();

  return (
    <View style={[styles.card, width ? { width } : null]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.thumbWrap, pressed && styles.pressed]}
      >
        {failed ? (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>{initial}</Text>
          </View>
        ) : (
          <Image
            source={{ uri: sources[thumbStep] }}
            style={styles.thumb}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
            onError={handleThumbError}
          />
        )}

        {isNew ? (
          <View style={styles.newBadge}>
            <View style={styles.newDot} />
            <Text style={styles.badgeText}>Nouveau</Text>
          </View>
        ) : null}

        {downloaded && !saving ? (
          <View style={styles.offlineBadge}>
            <DownloadIcon color={colors.text} size={11} thickness={2} />
            <Text style={styles.badgeText}>Hors ligne</Text>
          </View>
        ) : null}

        {saving ? (
          <View style={styles.savingBadge}>
            <Text style={styles.savingText}>Enregistrement…</Text>
          </View>
        ) : null}
      </Pressable>

      <View style={styles.row}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Ouvrir ${video.title}`}
          style={({ pressed }) => [styles.info, pressed && styles.pressed]}
        >
          <ChannelAvatar uri={channelAvatar} name={video.channelTitle} size={36} />

          <View style={styles.texts}>
            <Text style={styles.title} numberOfLines={2}>
              {video.title}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {`${video.channelTitle} · ${timeAgo(video.publishedAt)}`}
            </Text>
          </View>
        </Pressable>

        {onMore ? (
          <Pressable
            onPress={onMore}
            accessibilityRole="button"
            accessibilityLabel={`Options pour ${video.channelTitle}`}
            style={({ pressed }) => [styles.more, pressed && styles.morePressed]}
          >
            <MoreIcon color={colors.textMuted} size={15} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingBottom: spacing.lg,
  },
  pressed: {
    opacity: 0.8,
  },
  thumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  placeholderText: {
    color: colors.textFaint,
    fontSize: 40,
    fontWeight: '800',
  },
  newBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: 'rgba(5, 7, 14, 0.82)',
  },
  offlineBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: 'rgba(5, 7, 14, 0.82)',
  },
  savingBadge: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 7, 14, 0.82)',
  },
  savingText: {
    color: colors.accentText,
    fontSize: 10.5,
    fontWeight: '700',
  },
  badgeText: {
    color: colors.text,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  newDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accent,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  info: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  texts: {
    flex: 1,
    gap: 3,
    paddingTop: 1,
    minHeight: TITLE_HEIGHT + META_HEIGHT + 3,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: -0.2,
    minHeight: TITLE_HEIGHT,
  },
  meta: {
    color: colors.textFaint,
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: META_HEIGHT,
  },
  more: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  morePressed: {
    backgroundColor: colors.surface,
  },
});
