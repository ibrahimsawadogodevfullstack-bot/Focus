import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../src/shared/theme/tokens';
import { useThemeStyles } from '../src/shared/theme/ThemeProvider';

export default function ChoiceSheet({
  visible,
  title,
  choices,
  selectedValue,
  onChoose,
  onClose,
}) {
  const insets = useSafeAreaInsets();
  const themedStyles = useThemeStyles(styles);

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
          <Text style={themedStyles.title}>{title}</Text>
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
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
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
    fontSize: 14,
    fontWeight: '500',
  },
  choiceLabelSelected: {
    color: colors.accentText,
    fontWeight: '700',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
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
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
});
