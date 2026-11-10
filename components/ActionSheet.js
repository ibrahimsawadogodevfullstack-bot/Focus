import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, fontSize, radius, spacing } from '../src/shared/theme/tokens';
import { useThemeStyles } from '../src/shared/theme/ThemeProvider';
import Sheet from '../src/shared/ui/Sheet';

/**
 * @typedef {Object} ActionSheetAction
 * @property {string} key
 * @property {string} label
 * @property {string} [hint]
 * @property {import('react').ReactNode} [icon]
 * @property {boolean} [destructive]
 * @property {() => void} onPress
 */

/**
 * Feuille d'actions en bas d'écran (même rendu Android, iOS et web).
 * `actions` : [{ key, label, hint, icon, destructive, onPress }].
 *
 * @param {Object} props
 * @param {boolean} props.visible
 * @param {string} [props.title]
 * @param {string|null} [props.message]
 * @param {ActionSheetAction[]} [props.actions]
 * @param {() => void} props.onClose
 */
export default function ActionSheet({ visible, title, message, actions = [], onClose }) {
  const styles = useThemeStyles(baseStyles);
  const { t } = useTranslation('common');

  return (
    <Sheet visible={visible} title={title} message={message} onClose={onClose}>
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
    </Sheet>
  );
}

const baseStyles = StyleSheet.create({
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
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  labelDanger: {
    color: colors.danger,
  },
  hint: {
    color: colors.textFaint,
    fontSize: fontSize.caption,
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
    fontSize: fontSize.body,
    fontWeight: '600',
  },
});
