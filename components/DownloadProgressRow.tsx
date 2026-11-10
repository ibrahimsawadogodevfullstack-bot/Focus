import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, fontSize, radius, spacing } from '../src/shared/theme/tokens';
import { useThemeStyles } from '../src/shared/theme/ThemeProvider';
import type { DownloadRecord } from '../src/db/downloads';

/**
 * Codes d'erreur remontés par le module natif, traduits pour l'utilisateur.
 * Le message technique reste affiché en dessous, en petit.
 */
const ERROR_KEYS: Record<string, string> = {
  ERR_YTDLP_STORAGE: 'errorStorage',
  ERR_YTDLP_NETWORK: 'errorNetwork',
  ERR_YTDLP_UNAVAILABLE: 'errorUnavailable',
  ERR_YTDLP_INVALID_URL: 'errorInvalidUrl',
  ERR_YTDLP_INIT: 'errorInit',
  ERR_YTDLP_OUTPUT: 'errorOutput',
  ERR_YTDLP_CANCELED: 'errorCanceled',
  ERR_YTDLP_BAD_ARGUMENT: 'errorUnknown',
  ERR_YTDLP_VERSION: 'errorInit',
  ERR_YTDLP_FAILED: 'errorUnknown',
  ERR_PLATFORM: 'errorPlatform',
};

export default function DownloadProgressRow({
  download,
  onCancel,
  onRetry,
}: {
  download: DownloadRecord;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const styles = useThemeStyles(baseStyles);
  const { t } = useTranslation(['downloads', 'common']);
  const percent = Math.round((download.progress ?? 0) * 100);
  const isActive = download.status === 'downloading' || download.status === 'queued';
  const errorKey = download.errorCode ? ERROR_KEYS[download.errorCode] : undefined;
  const errorTitle = errorKey
    ? t(`downloads:${errorKey}`)
    : t('downloads:downloadFailed');

  return (
    <View style={styles.row}>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${percent}%` }]} />
      </View>
      <View style={styles.meta}>
        <Text style={styles.percent}>{percent}%</Text>
        <Text style={styles.title} numberOfLines={1}>
          {download.title}
        </Text>
      </View>
      {download.status === 'failed' ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>{errorTitle}</Text>
          {download.errorMessage ? (
            <Text style={styles.errorDetail} numberOfLines={4}>
              {download.errorMessage}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.actions}>
        {isActive ? (
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          >
            <Text style={styles.btnText}>{t('common:cancel')}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          >
            <Text style={styles.btnText}>{t('common:retry')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  row: { padding: spacing.md, gap: spacing.sm },
  barTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: colors.accent },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  percent: { color: colors.text, fontWeight: '700', fontSize: fontSize.label, width: 44 },
  title: { flex: 1, color: colors.textMuted, fontSize: fontSize.label },
  errorBox: { gap: 2 },
  errorTitle: { color: colors.danger, fontSize: fontSize.meta, fontWeight: '600' },
  errorDetail: { color: colors.textFaint, fontSize: fontSize.caption },
  actions: { flexDirection: 'row', gap: spacing.sm },
  btn: {
    paddingHorizontal: spacing.md,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: { opacity: 0.7 },
  btnText: { color: colors.text, fontSize: fontSize.label, fontWeight: '600' },
});
