import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fontSize, radius } from '../theme/tokens';
import { useThemeStyles } from '../theme/ThemeProvider';
import Sheet from './Sheet';

interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation en feuille basse : même rendu sur Android, iOS et web
 * (Alert.alert n'affiche rien sur le web).
 */
export default function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const themedStyles = useThemeStyles(styles);
  const { t } = useTranslation('common');
  const confirmText = confirmLabel ?? t('confirm');
  const cancelText = cancelLabel ?? t('cancel');

  return (
    <Sheet
      visible={visible}
      title={title}
      message={message}
      titleAlign="center"
      messageAlign="center"
      onClose={onCancel}
    >
      <Pressable
        onPress={onConfirm}
        accessibilityRole="button"
        accessibilityLabel={confirmText}
        style={({ pressed }) => [
          themedStyles.action,
          destructive && themedStyles.actionDanger,
          pressed && themedStyles.actionPressed,
        ]}
      >
        <Text style={[themedStyles.actionText, destructive && themedStyles.actionTextDanger]}>
          {confirmText}
        </Text>
      </Pressable>

      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={cancelText}
        style={({ pressed }) => [themedStyles.cancel, pressed && themedStyles.cancelPressed]}
      >
        <Text style={themedStyles.cancelText}>{cancelText}</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
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
    fontSize: fontSize.body,
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
    fontSize: fontSize.body,
    fontWeight: '600',
  },
});
