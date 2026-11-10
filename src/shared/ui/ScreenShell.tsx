import { ScrollView, StyleSheet, Text } from 'react-native';
import type { ReactNode, Ref } from 'react';
import type { ScrollViewProps, StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fontSize, spacing } from '../theme/tokens';
import { useThemeStyles } from '../theme/ThemeProvider';
import ScreenHeader from './ScreenHeader';

type ScreenShellProps = {
  title: string;
  /** Information secondaire, affichée dans le contenu et non dans la barre. */
  meta?: string;
  onBack?: () => void;
  right?: ReactNode;
  children: ReactNode;
  scrollRef?: Ref<ScrollView>;
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
  keyboardDismissMode?: ScrollViewProps['keyboardDismissMode'];
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Gabarit commun des pages secondaires.
 *
 * La barre de titre est un frère du `ScrollView`, jamais un enfant : elle reste
 * donc strictement immobile pendant le défilement et d'un onglet à l'autre.
 * Le contenu commence sous la barre, avec une marge unique de 16 px.
 */
export default function ScreenShell({
  title,
  meta,
  onBack,
  right,
  children,
  scrollRef,
  keyboardShouldPersistTaps,
  keyboardDismissMode,
  contentStyle,
}: ScreenShellProps) {
  const styles = useThemeStyles(baseStyles);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScreenHeader title={title} onBack={onBack} right={right} />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, contentStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode}
      >
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxxl + spacing.md,
    gap: spacing.lg,
  },
  meta: {
    marginTop: -spacing.xs,
    color: colors.textMuted,
    fontSize: fontSize.meta,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
