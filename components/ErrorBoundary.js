import { Component } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '../src/shared/theme/tokens';
import { saveCrash } from '../services/crashLog';
import { useThemeStyles } from '../src/shared/theme/ThemeProvider';
import BrandMark from '../src/shared/ui/BrandMark';

/** Écran lisible quand quelque chose casse : plus de fermeture silencieuse. */
export function CrashScreen({ error, onRetry }) {
  const styles = useThemeStyles(baseStyles);
  const { t } = useTranslation();
  const message = String(error?.message ?? error ?? t('crash:unknown'));
  const stack = String(error?.stack ?? '').split('\n').slice(0, 12).join('\n');

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <BrandMark style={styles.brand} />
        <Text style={styles.title}>{t('crash:title')}</Text>
        <Text style={styles.lead}>
          {t('crash:lead')}
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('crash:error')}</Text>
          <Text style={styles.message} selectable>
            {message}
          </Text>
          {stack ? (
            <>
              <Text style={[styles.cardLabel, styles.stackLabel]}>{t('crash:trace')}</Text>
              <Text style={styles.stack} selectable>
                {stack}
              </Text>
            </>
          ) : null}
        </View>

        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Text style={styles.actionText}>{t('crash:retry')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    saveCrash(error, `boundary:${info?.componentStack ? 'component' : 'render'}`);
  }

  handleRetry = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      return <CrashScreen error={this.state.error} onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

const baseStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  brand: {
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  lead: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
  },
  card: {
    marginTop: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    gap: spacing.xs,
  },
  cardLabel: {
    color: colors.textFaint,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  message: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  stackLabel: {
    marginTop: spacing.md,
  },
  stack: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  action: {
    marginTop: spacing.md,
    height: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  actionPressed: {
    opacity: 0.85,
  },
  actionText: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '700',
  },
});
