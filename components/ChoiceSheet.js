import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, fontSize, radius, spacing } from '../src/shared/theme/tokens';
import { useThemeStyles } from '../src/shared/theme/ThemeProvider';
import Sheet from '../src/shared/ui/Sheet';

export default function ChoiceSheet({
  visible,
  title,
  choices,
  selectedValue,
  onChoose,
  onClose,
}) {
  const themedStyles = useThemeStyles(styles);
  const { t } = useTranslation('common');

  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <View style={themedStyles.choices}>
        {choices.map((choice, index) => {
          const checked = choice.value === selectedValue;
          return (
            <Pressable
              key={choice.value}
              onPress={() => onChoose(choice.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              style={({ pressed }) => [
                themedStyles.choice,
                index < choices.length - 1 && themedStyles.divider,
                checked && themedStyles.choiceSelected,
                pressed && themedStyles.pressed,
              ]}
            >
              <Text style={[themedStyles.choiceLabel, checked && themedStyles.choiceLabelSelected]}>
                {choice.label}
              </Text>
              <View style={[themedStyles.radio, checked && themedStyles.radioSelected]}>
                {checked ? <View style={themedStyles.radioDot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('cancel')}
        style={({ pressed }) => [themedStyles.cancel, pressed && themedStyles.cancelPressed]}
      >
        <Text style={themedStyles.cancelText}>{t('cancel')}</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  choices: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  choice: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  choiceSelected: {
    backgroundColor: colors.accentSoft,
  },
  pressed: {
    opacity: 0.75,
  },
  choiceLabel: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '500',
  },
  choiceLabelSelected: {
    color: colors.accentText,
    fontWeight: '700',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.accent,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
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
