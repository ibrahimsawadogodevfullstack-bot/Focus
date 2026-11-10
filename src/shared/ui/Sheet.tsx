import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontSize, radius, spacing } from '../theme/tokens';
import { useThemeStyles } from '../theme/ThemeProvider';

interface SheetProps {
  visible: boolean;
  title?: string;
  message?: string;
  titleAlign?: 'left' | 'center';
  messageAlign?: 'left' | 'center';
  onClose: () => void;
  children: ReactNode;
}

/**
 * Coquille commune des feuilles basses.
 *
 * Regroupe le voile, la poignée, le titre et les marges : les feuilles ne
 * doivent plus redéfinir chacune leur scrim, leur rayon ou leur gouttière.
 * Le contenu (actions, choix, boutons) reste à la charge de l'appelant.
 */
export default function Sheet({
  visible,
  title,
  message,
  titleAlign = 'left',
  messageAlign = 'left',
  onClose,
  children,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  const themedStyles = useThemeStyles(baseStyles);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={themedStyles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no"
        />

        <View style={[themedStyles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={themedStyles.grabber} />

          {title ? (
            <Text
              style={[themedStyles.title, titleAlign === 'center' && themedStyles.centered]}
              numberOfLines={2}
            >
              {title}
            </Text>
          ) : null}

          {message ? (
            <Text
              style={[themedStyles.message, messageAlign === 'center' && themedStyles.centered]}
            >
              {message}
            </Text>
          ) : null}

          {children}
        </View>
      </View>
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2, 4, 10, 0.72)',
  },
  sheet: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.lineStrong,
  },
  title: {
    marginTop: spacing.xs,
    color: colors.text,
    fontSize: fontSize.title,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  message: {
    marginTop: -spacing.xs,
    color: colors.textMuted,
    fontSize: fontSize.label,
    lineHeight: 18,
  },
  centered: {
    textAlign: 'center',
  },
});
