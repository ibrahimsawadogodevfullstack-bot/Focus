import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../constants/theme';
import { useThemeStyles } from '../services/ThemeProvider';

/**
 * Confirmation en feuille basse : même rendu sur Android, iOS et web
 * (Alert.alert n'affiche rien sur le web).
 */
export default function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  destructive = false,
  onConfirm,
  onCancel,
}) {
  const insets = useSafeAreaInsets();
  const themedStyles = useThemeStyles(styles);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={themedStyles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessible={false}
          importantForAccessibility="no"
        />

        <View style={[themedStyles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={themedStyles.grabber} />
          <Text style={themedStyles.title}>{title}</Text>
          {message ? <Text style={themedStyles.message}>{message}</Text> : null}

          <Pressable
            onPress={onConfirm}
            accessibilityRole="button"
            style={({ pressed }) => [
              themedStyles.action,
              destructive && themedStyles.actionDanger,
              pressed && themedStyles.actionPressed,
            ]}
          >
            <Text style={[themedStyles.actionText, destructive && themedStyles.actionTextDanger]}>
              {confirmLabel}
            </Text>
          </Pressable>

          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            style={({ pressed }) => [themedStyles.cancel, pressed && themedStyles.cancelPressed]}
          >
            <Text style={themedStyles.cancelText}>{cancelLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2, 4, 10, 0.72)',
  },
  sheet: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
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
    borderRadius: 2,
    backgroundColor: colors.lineStrong,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  message: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: -spacing.xs,
  },
  action: {
    height: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  actionDanger: {
    backgroundColor: colors.dangerSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 122, 143, 0.4)',
  },
  actionPressed: {
    opacity: 0.8,
  },
  actionText: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '700',
  },
  actionTextDanger: {
    color: colors.danger,
  },
  cancel: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  cancelPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 14.5,
    fontWeight: '600',
  },
});
