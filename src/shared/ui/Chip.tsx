import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, fontSize, radius } from '../theme/tokens';
import { useThemeStyles } from '../theme/ThemeProvider';

type ChipSize = 'sm' | 'md';
type ChipTone = 'surface' | 'overlay';

interface ChipProps {
  label: string;
  /** Valeur secondaire, par exemple le tri courant. */
  value?: string;
  count?: number;
  /** Élément après le libellé (chevron, icône). */
  trailing?: ReactNode;
  active?: boolean;
  size?: ChipSize;
  tone?: ChipTone;
  onPress: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Puce unique de l'app.
 *
 * Une seule forme (pilule), un seul état actif, deux densités :
 * `md` pour les catégories, `sm` pour les filtres. La zone tactile atteint
 * 44 px sans agrandir le dessin.
 */
export default function Chip({
  label,
  value,
  count = 0,
  trailing,
  active = false,
  size = 'md',
  tone = 'surface',
  onPress,
  accessibilityLabel,
  style,
}: ChipProps) {
  const themedStyles = useThemeStyles(baseStyles);
  const overlay = tone === 'overlay';
  const compact = size === 'sm';

  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: compact ? 6 : 2, bottom: compact ? 6 : 2 }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        themedStyles.chip,
        compact ? themedStyles.sm : themedStyles.md,
        overlay ? themedStyles.overlay : themedStyles.surface,
        active && (overlay ? themedStyles.overlayActive : themedStyles.active),
        pressed && themedStyles.pressed,
        style,
      ]}
    >
      <Text
        style={[
          themedStyles.label,
          compact && themedStyles.labelCompact,
          overlay && themedStyles.labelOverlay,
          active && (overlay ? themedStyles.labelOnAccent : themedStyles.labelActive),
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>

      {value ? (
        <Text
          style={[
            themedStyles.value,
            active && (overlay ? themedStyles.labelOnAccent : themedStyles.valueActive),
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
      ) : null}

      {count > 0 ? (
        <View style={[themedStyles.count, active && themedStyles.countActive]}>
          <Text style={[themedStyles.countText, active && themedStyles.countTextActive]}>
            {count}
          </Text>
        </View>
      ) : null}

      {trailing}
    </Pressable>
  );
}

const baseStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  md: {
    height: 40,
    paddingHorizontal: 12,
    gap: 6,
  },
  sm: {
    height: 32,
    paddingHorizontal: 10,
    gap: 5,
  },
  surface: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
  },
  active: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  overlay: {
    borderColor: 'transparent',
    backgroundColor: 'rgba(233, 241, 255, 0.12)',
  },
  overlayActive: {
    backgroundColor: colors.accent,
  },
  pressed: {
    opacity: 0.75,
  },
  label: {
    fontSize: fontSize.label,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.1,
  },
  labelCompact: {
    fontSize: fontSize.meta,
  },
  labelOverlay: {
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.bg,
    fontWeight: '700',
  },
  labelOnAccent: {
    color: colors.onAccent,
    fontWeight: '700',
  },
  value: {
    fontSize: fontSize.meta,
    fontWeight: '500',
    color: colors.textFaint,
  },
  valueActive: {
    color: colors.bg,
  },
  count: {
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  countActive: {
    backgroundColor: 'rgba(5, 7, 14, 0.18)',
  },
  countText: {
    color: colors.accentText,
    fontSize: fontSize.micro,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  countTextActive: {
    color: colors.bg,
  },
});
