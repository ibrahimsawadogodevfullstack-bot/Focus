import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../constants/theme';

const THUMB_STEPS = ['maxresdefault', 'sddefault', 'hqdefault'];

/** Largeur d'une carte Short : 150 à 180 px sur mobile. */
export const SHORT_CARD_WIDTH = 156;

/**
 * Carte Short (9:16), destinée uniquement à la rangée horizontale.
 * Elle ne doit jamais être utilisée dans la grille des vidéos longues : son
 * ratio n'y aurait aucun sens, et c'est précisément ce qui produisait
 * l'affichage « image verticale dans une carte large ».
 */
export default function ShortCard({ video, width = SHORT_CARD_WIDTH, onPress, isNew }) {
  const [thumbStep, setThumbStep] = useState(0);
  const [failed, setFailed] = useState(false);

  const source = video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/${THUMB_STEPS[thumbStep]}.jpg`;

  const handleThumbError = () => {
    if (thumbStep < THUMB_STEPS.length - 1) setThumbStep((step) => step + 1);
    else setFailed(true);
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Short : ${video.title} — ${video.channelTitle}`}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
    >
      <View style={styles.thumbWrap}>
        {failed ? (
          <View style={styles.placeholder} />
        ) : (
          <Image
            source={{ uri: source }}
            style={styles.thumb}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
            onError={handleThumbError}
          />
        )}

        {isNew ? <View style={styles.newDot} /> : null}
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {video.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingBottom: spacing.sm,
  },
  pressed: {
    opacity: 0.8,
  },
  thumbWrap: {
    width: '100%',
    aspectRatio: 9 / 16,
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
    backgroundColor: colors.surfaceAlt,
  },
  newDot: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  title: {
    marginTop: spacing.sm,
    color: colors.text,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17,
    minHeight: 34,
  },
});
