import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '../src/shared/theme/tokens';
import { useThemeStyles } from '../src/shared/theme/ThemeProvider';

/**
 * Feuille d'actions en bas d'écran (même rendu Android, iOS et web).
 * `actions` : [{ key, label, hint, icon, destructive, onPress }].
 */
export default function ActionSheet({ visible, title, message, actions = [], onClose }) {
  const insets = useSafeAreaInsets();
  const styles = useThemeStyles(baseStyles);
  const { t } = useTranslation('common');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no"
        />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.grabber} />

          {title ? (
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
          ) : null}
          {message ? (
            <Text style={styles.message} numberOfLines={1}>
              {message}
            </Text>
          ) : null}

          <View style={styles.actions}>
            {actions.map((action) => (
              <Pressable
                key={action.key}
                onPress={action.onPress}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                style={({ pressed }) => [
                  styles.action,
                  action.destructive && styles.actionDanger,
                  pressed && styles.pressed,
                ]}
              >
                {action.icon ? <View style={styles.icon}>{action.icon}</View> : null}
                <View style={styles.texts}>
                  <Text
                    style={[styles.label, action.destructive && styles.labelDanger]}
                    numberOfLines={1}
                  >
                    {action.label}
                  </Text>
                  {action.hint ? (
                    <Text style={styles.hint} numberOfLines={2}>
                      {action.hint}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('cancel')}
            style={({ pressed }) => [styles.cancel, pressed && styles.cancelPressed]}
          >
            <Text style={styles.cancelText}>{t('cancel')}</Text>
          </Pressable>
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
    gap: spacing.sm,
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
    borderRadius: 2,
    backgroundColor: colors.lineStrong,
  },
  title: {
    marginTop: spacing.xs,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  message: {
    marginTop: -4,
    color: colors.textFaint,
    fontSize: 12.5,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  action: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  actionDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: 'rgba(255, 122, 143, 0.35)',
  },
  pressed: {
    opacity: 0.75,
  },
  icon: {
    width: 22,
    alignItems: 'center',
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: colors.text,
    fontSize: 14.5,
    fontWeight: '600',
  },
  labelDanger: {
    color: colors.danger,
  },
  hint: {
    color: colors.textFaint,
    fontSize: 11.5,
    lineHeight: 15,
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
